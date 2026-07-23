import { useState, useEffect, useMemo, useRef } from "react";
import { Check, X, Plus, Banknote, Landmark, FileText, Search } from "lucide-react";
import { Modal, Field, Btn, inputCls, selectCls, Tag } from "../shared/Primitives";
import { useApi } from "../../../hooks/useSupabase";
import type { Check as CheckType, Child } from "../../types";

type PaymentMethod = "espece" | "virement" | "cheque";

const METHOD_LABELS: Record<PaymentMethod, string> = {
  espece: "Espèce",
  virement: "Virement",
  cheque: "Chèque",
};

const METHOD_ICONS: Record<PaymentMethod, React.ElementType> = {
  espece: Banknote,
  virement: Landmark,
  cheque: FileText,
};

export function ModalPayRest({ subscription, onClose, onPaid }: { subscription: any; onClose: () => void; onPaid?: () => void }) {
  const api = useApi();
  const [loading, setLoading] = useState(false);
  const [especeAmount, setEspeceAmount] = useState(0);
  const [virementAmount, setVirementAmount] = useState(0);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [checks, setChecks] = useState<CheckType[]>([]);
  const [checkSearch, setCheckSearch] = useState("");
  const [showCheckSuggestions, setShowCheckSuggestions] = useState(false);
  const [selectedChecks, setSelectedChecks] = useState<{ check: CheckType; amount: number }[]>([]);
  const [newCheckNum, setNewCheckNum] = useState("");
  const [newCheckAmount, setNewCheckAmount] = useState("");
  const [newCheckBank, setNewCheckBank] = useState("");
  const [newCheckHolder, setNewCheckHolder] = useState("");
  const [newCheckDateEmission, setNewCheckDateEmission] = useState(new Date().toISOString().split("T")[0]);
  const [newCheckDateExecution, setNewCheckDateExecution] = useState("");
  const [savingCheck, setSavingCheck] = useState(false);
  const [newCheckCreated, setNewCheckCreated] = useState(false);
  const [showNewCheckForm, setShowNewCheckForm] = useState(false);
  const checkSearchRef = useRef<HTMLDivElement>(null);

  const restDue = (subscription?.amount - subscription?.discount + subscription?.insurance + subscription?.entry_fee) - (subscription?.paid_amount || 0);

  useEffect(() => {
    api.checks.getAll().then(setChecks).catch(console.error);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (checkSearchRef.current && !checkSearchRef.current.contains(e.target as Node)) {
        setShowCheckSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const availableChecks = useMemo(() => {
    const selectedIds = selectedChecks.map(s => s.check.id);
    return checks.filter(c => !c.used && !selectedIds.includes(c.id));
  }, [checks, selectedChecks]);

  const filteredChecks = availableChecks.filter(c =>
    c.number.toLowerCase().includes(checkSearch.toLowerCase()) ||
    (c.bank && c.bank.toLowerCase().includes(checkSearch.toLowerCase())) ||
    (c.account_holder && c.account_holder.toLowerCase().includes(checkSearch.toLowerCase()))
  );

  const totalChecksAmount = selectedChecks.reduce((sum, s) => sum + s.amount, 0);
  const totalPaid = especeAmount + virementAmount + totalChecksAmount;
  const remaining = restDue - totalPaid;

  function togglePaymentMethod(method: PaymentMethod) {
    setPaymentMethods(prev =>
      prev.includes(method) ? prev.filter(m => m !== method) : [...prev, method]
    );
    if (method === "espece") setEspeceAmount(0);
    if (method === "virement") setVirementAmount(0);
    if (method === "cheque") setSelectedChecks([]);
  }

  function handleSelectCheck(check: CheckType) {
    const rest = check.amount - check.montant_used;
    const maxAmount = Math.min(rest, remaining > 0 ? remaining : rest);
    setSelectedChecks(prev => [...prev, { check, amount: maxAmount }]);
    setCheckSearch("");
    setShowCheckSuggestions(false);
  }

  function removeSelectedCheck(checkId: string) {
    setSelectedChecks(prev => prev.filter(s => s.check.id !== checkId));
  }

  function updateCheckAmount(checkId: string, amount: number) {
    setSelectedChecks(prev => prev.map(s => {
      if (s.check.id !== checkId) return s;
      const rest = s.check.amount - s.check.montant_used;
      return { ...s, amount: Math.min(Math.max(0, amount), rest) };
    }));
  }

  async function handleCreateCheckInline() {
    if (!newCheckNum || !newCheckAmount || !newCheckBank || !newCheckHolder) {
      return alert("Veuillez remplir tous les champs du chèque");
    }
    setSavingCheck(true);
    try {
      const created = await api.checks.create({
        number: newCheckNum,
        amount: parseFloat(newCheckAmount),
        bank: newCheckBank,
        account_holder: newCheckHolder,
        date_emission: newCheckDateEmission || null,
        date_execution: newCheckDateExecution || null,
      });
      const updatedChecks = await api.checks.getAll();
      setChecks(updatedChecks);
      setNewCheckNum("");
      setNewCheckAmount("");
      setNewCheckBank("");
      setNewCheckHolder("");
      setNewCheckDateEmission(new Date().toISOString().split("T")[0]);
      setNewCheckDateExecution("");
      setNewCheckCreated(true);
      const freshCheck = updatedChecks.find((c: CheckType) => c.id === created.id);
      if (freshCheck) handleSelectCheck(freshCheck);
      setTimeout(() => setNewCheckCreated(false), 3000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingCheck(false);
    }
  }

  async function handleSubmit() {
    if (totalPaid <= 0) return alert("Veuillez saisir un montant à payer");
    setLoading(true);
    try {
      const checkIds = selectedChecks.map(s => s.check.id);
      const payment = await api.payments.create({
        subscription_id: subscription.id,
        amount: totalPaid,
        method: paymentMethods,
        check_ids: checkIds,
      });
      for (const sc of selectedChecks) {
        await api.checks.useCheck(sc.check.id, sc.amount, payment.id);
      }
      await api.subscriptions.update(subscription.id, {
        paid_amount: (subscription.paid_amount || 0) + totalPaid,
      });
      onPaid?.();
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Paiement du Reste" onClose={onClose} wide>
      <div className="space-y-5">
        <div className="border border-slate-200 p-4 bg-slate-50">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Enfant</span>
            <span className="font-medium">{subscription.children?.name || "—"}</span>
          </div>
          <div className="flex justify-between text-sm mt-2">
            <span className="text-slate-500">Reste à payer</span>
            <span className="text-pink-600 font-bold text-lg">{restDue.toLocaleString()} Dhs</span>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Moyen de paiement</p>
          <div className="flex gap-2 flex-wrap">
            {(["espece", "virement", "cheque"] as PaymentMethod[]).map(m => {
              const Icon = METHOD_ICONS[m];
              const isSelected = paymentMethods.includes(m);
              return (
                <button
                  key={m}
                  onClick={() => togglePaymentMethod(m)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm border font-medium transition-colors ${
                    isSelected ? "border-pink-500 bg-pink-50 text-pink-700" : "border-slate-300 text-slate-600 hover:border-slate-400"
                  }`}
                >
                  <Icon size={14} /> {METHOD_LABELS[m]} {isSelected && <Check size={12} className="text-pink-500" />}
                </button>
              );
            })}
          </div>
        </div>

        {paymentMethods.includes("espece") && (
          <Field label="Montant en Espèce (Dhs)">
            <input type="number" className={inputCls} value={especeAmount} onChange={e => setEspeceAmount(Math.max(0, Number(e.target.value)))} />
          </Field>
        )}

        {paymentMethods.includes("virement") && (
          <Field label="Montant Virement (Dhs)">
            <input type="number" className={inputCls} value={virementAmount} onChange={e => setVirementAmount(Math.max(0, Number(e.target.value)))} />
          </Field>
        )}

        {paymentMethods.includes("cheque") && (
          <div>
            <div className="border border-dashed border-slate-300 mb-3">
              <button onClick={() => setShowNewCheckForm(!showNewCheckForm)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-500 uppercase hover:bg-slate-50">
                <span><Plus size={11} className="inline mr-1" />Nouveau chèque</span>
                <span className={showNewCheckForm ? "rotate-45" : ""}><Plus size={12} /></span>
              </button>
              {showNewCheckForm && (
                <div className="px-3 pb-3 space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <input className={`${inputCls} text-xs`} placeholder="N°" value={newCheckNum} onChange={e => setNewCheckNum(e.target.value)} />
                    <input type="number" className={`${inputCls} text-xs`} placeholder="Montant" value={newCheckAmount} onChange={e => setNewCheckAmount(e.target.value)} />
                    <input className={`${inputCls} text-xs`} placeholder="Banque" value={newCheckBank} onChange={e => setNewCheckBank(e.target.value)} />
                    <input className={`${inputCls} text-xs`} placeholder="Titulaire" value={newCheckHolder} onChange={e => setNewCheckHolder(e.target.value)} />
                    <input type="date" className={`${inputCls} text-xs`} value={newCheckDateEmission} onChange={e => setNewCheckDateEmission(e.target.value)} />
                    <input type="date" className={`${inputCls} text-xs`} value={newCheckDateExecution} onChange={e => setNewCheckDateExecution(e.target.value)} />
                  </div>
                  <Btn size="sm" onClick={handleCreateCheckInline} disabled={savingCheck}>
                    {savingCheck ? "..." : <><Plus size={11} /> Créer</>}
                  </Btn>
                  {newCheckCreated && <span className="text-xs text-emerald-600"><Check size={10} /> Créé !</span>}
                </div>
              )}
            </div>

            <div className="relative mb-3" ref={checkSearchRef}>
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className={`${inputCls} pl-8`} placeholder="Rechercher un chèque..." value={checkSearch}
                onChange={e => { setCheckSearch(e.target.value); setShowCheckSuggestions(true); }}
                onFocus={() => setShowCheckSuggestions(true)} />
              {showCheckSuggestions && checkSearch && (
                <div className="absolute z-10 top-full left-0 right-0 bg-white border border-slate-200 shadow-lg max-h-48 overflow-y-auto">
                  {filteredChecks.map(c => {
                    const rest = c.amount - c.montant_used;
                    return (
                      <button key={c.id} onClick={() => handleSelectCheck(c)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-pink-50 flex items-center justify-between text-slate-700">
                        <div>
                          <span className="font-mono font-semibold">#{c.number}</span>
                          <span className="text-xs text-slate-400 ml-2">{c.bank || "—"}</span>
                        </div>
                        <span className="text-xs text-slate-500">{rest.toLocaleString()} Dhs</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {selectedChecks.length > 0 && selectedChecks.map(sc => (
              <div key={sc.check.id} className="flex items-center gap-3 bg-slate-50 border border-slate-200 p-3 mb-2">
                <div className="flex-1">
                  <p className="text-sm font-mono font-semibold">#{sc.check.number}</p>
                  <p className="text-xs text-slate-400">{sc.check.bank}</p>
                </div>
                <div className="w-32">
                  <input type="number" className={`${inputCls} text-sm`} value={sc.amount}
                    onChange={e => updateCheckAmount(sc.check.id, Number(e.target.value))}
                    max={sc.check.amount - sc.check.montant_used} />
                </div>
                <button onClick={() => removeSelectedCheck(sc.check.id)} className="p-1 text-slate-400 hover:text-red-500"><X size={14} /></button>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-slate-200 pt-3 space-y-1 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Reste à payer</span>
            <span className="font-semibold">{restDue.toLocaleString()} Dhs</span>
          </div>
          {paymentMethods.includes("espece") && especeAmount > 0 && (
            <div className="flex justify-between text-emerald-600"><span>Espèce</span><span>{especeAmount.toLocaleString()} Dhs</span></div>
          )}
          {paymentMethods.includes("virement") && virementAmount > 0 && (
            <div className="flex justify-between text-blue-600"><span>Virement</span><span>{virementAmount.toLocaleString()} Dhs</span></div>
          )}
          {paymentMethods.includes("cheque") && totalChecksAmount > 0 && (
            <div className="flex justify-between text-purple-600"><span>Chèque(s)</span><span>{totalChecksAmount.toLocaleString()} Dhs</span></div>
          )}
          <div className="flex justify-between font-semibold pt-1 border-t border-slate-100">
            <span className={remaining === 0 ? "text-emerald-600" : "text-red-500"}>{remaining === 0 ? "Payé" : "Reste"}</span>
            <span className={remaining === 0 ? "text-emerald-600" : "text-red-500"}>{Math.abs(remaining).toLocaleString()} Dhs</span>
          </div>
        </div>

        <div className="flex gap-3 pt-2 border-t border-slate-100">
          <Btn onClick={handleSubmit} disabled={loading}>{loading ? "Paiement..." : <><Check size={13} /> Payer</>}</Btn>
          <Btn variant="outline" onClick={onClose}>Annuler</Btn>
        </div>
      </div>
    </Modal>
  );
}