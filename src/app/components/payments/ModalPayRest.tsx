import { useState, useEffect, useRef, useMemo } from "react";
import { Check, X, Plus, Banknote, Landmark, FileText, Search } from "lucide-react";
import { Modal, Field, Btn, inputCls } from "../shared/Primitives";
import { useApi } from "../../../hooks/useSupabase";
import { Check as CheckType } from "../../types";

interface Subscription {
  id: string;
  child_id: string;
  type: string;
  sub_type: string | null;
  amount: number;
  discount: number;
  insurance: number;
  entry_fee: number;
  paid_amount: number;
  status: string;
  children?: { name: string };
}

interface Props {
  subscription: Subscription;
  onClose: () => void;
  onPaid?: () => void;
}

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

export function ModalPayRest({ subscription, onClose, onPaid }: Props) {
  const api = useApi();
  const totalDue = subscription.amount - subscription.discount + subscription.insurance + subscription.entry_fee;
  const restDue = totalDue - (subscription.paid_amount || 0);

  const [amount, setAmount] = useState(restDue);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(false);

  // Check state
  const [checks, setChecks] = useState<CheckType[]>([]);
  const [checkSearch, setCheckSearch] = useState("");
  const [showCheckSuggestions, setShowCheckSuggestions] = useState(false);
  const [selectedChecks, setSelectedChecks] = useState<{ check: CheckType; amount: number }[]>([]);
  const [especeAmount, setEspeceAmount] = useState(0);
  const [virementAmount, setVirementAmount] = useState(0);
  const checkSearchRef = useRef<HTMLDivElement>(null);

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
    (c.bank && c.bank.toLowerCase().includes(checkSearch.toLowerCase()))
  );

  const totalChecksAmount = selectedChecks.reduce((sum, s) => sum + s.amount, 0);
  const totalPaid = especeAmount + virementAmount + totalChecksAmount;
  const remaining = amount - totalPaid;

  function togglePaymentMethod(m: PaymentMethod) {
    setPaymentMethods(prev =>
      prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
    );
    if (m === "espece") setEspeceAmount(0);
    if (m === "virement") setVirementAmount(0);
    if (m === "cheque") setSelectedChecks([]);
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

  function updateCheckAmount(checkId: string, amt: number) {
    setSelectedChecks(prev => prev.map(s => {
      if (s.check.id !== checkId) return s;
      const rest = s.check.amount - s.check.montant_used;
      return { ...s, amount: Math.min(Math.max(0, amt), rest) };
    }));
  }

  async function handleSubmit() {
    if (paymentMethods.length === 0) return alert("Sélectionnez un moyen de paiement");
    if (remaining > 0) return alert(`Il reste ${remaining} Dhs à payer`);

    setLoading(true);
    try {
      const checkIds = selectedChecks.map(s => s.check.id);
      await api.subscriptions.pay(subscription.id, {
        amount: totalPaid,
        method: paymentMethods,
        check_ids: checkIds,
      });

      // Update checks montant_used
      for (const sc of selectedChecks) {
        await api.checks.useCheck(sc.check.id, sc.amount);
      }

      onPaid?.();
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title={`Paiement - ${subscription.children?.name || "Abonnement"}`} onClose={onClose}>
      <div className="space-y-4">
        {/* Summary */}
        <div className="border border-slate-200 p-4 space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Total dû</span><span className="font-semibold">{totalDue.toLocaleString()} Dhs</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Déjà payé</span><span className="text-emerald-600">{(subscription.paid_amount || 0).toLocaleString()} Dhs</span></div>
          <div className="flex justify-between text-lg font-bold pt-1 border-t border-slate-100">
            <span className="text-orange-600">Reste à payer</span>
            <span className="text-orange-600">{restDue.toLocaleString()} Dhs</span>
          </div>
        </div>

        {/* Amount input */}
        <Field label="Montant à payer (Dhs)">
          <input type="number" className={inputCls} value={amount} onChange={e => setAmount(Math.min(Number(e.target.value), restDue))} max={restDue} />
        </Field>

        {/* Payment methods */}
        <div className="flex gap-2 flex-wrap">
          {(["espece", "virement", "cheque"] as PaymentMethod[]).map(m => {
            const Icon = METHOD_ICONS[m];
            const isSelected = paymentMethods.includes(m);
            return (
              <button key={m} onClick={() => togglePaymentMethod(m)}
                className={`flex items-center gap-2 px-4 py-2 text-sm border font-medium transition-colors ${
                  isSelected ? "border-orange-500 bg-orange-50 text-orange-700" : "border-slate-300 text-slate-600 hover:border-slate-400"
                }`}
              >
                <Icon size={14} /> {METHOD_LABELS[m]} {isSelected && <Check size={12} className="text-orange-500" />}
              </button>
            );
          })}
        </div>

        {/* Espèce */}
        {paymentMethods.includes("espece") && (
          <Field label="Montant Espèce"><input type="number" className={inputCls} value={especeAmount} onChange={e => setEspeceAmount(Math.max(0, Number(e.target.value)))} /></Field>
        )}

        {/* Virement */}
        {paymentMethods.includes("virement") && (
          <Field label="Montant Virement"><input type="number" className={inputCls} value={virementAmount} onChange={e => setVirementAmount(Math.max(0, Number(e.target.value)))} /></Field>
        )}

        {/* Chèques */}
        {paymentMethods.includes("cheque") && (
          <div>
            <div className="relative mb-2" ref={checkSearchRef}>
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className={`${inputCls} pl-8`} placeholder="Chercher un chèque..." value={checkSearch}
                onChange={e => { setCheckSearch(e.target.value); setShowCheckSuggestions(true); }}
                onFocus={() => setShowCheckSuggestions(true)}
              />
              {showCheckSuggestions && checkSearch && (
                <div className="absolute z-10 top-full left-0 right-0 bg-white border border-slate-200 shadow-lg max-h-40 overflow-y-auto">
                  {filteredChecks.length === 0 ? <div className="px-3 py-2 text-xs text-slate-400">Aucun chèque</div> : (
                    filteredChecks.map(c => (
                      <button key={c.id} onClick={() => handleSelectCheck(c)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-orange-50 flex items-center justify-between text-slate-700"
                      >
                        <span className="font-mono font-semibold">#{c.number}</span>
                        <span className="text-xs">{(c.amount - c.montant_used).toLocaleString()} Dhs</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            {selectedChecks.map(sc => (
              <div key={sc.check.id} className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-2 mb-1">
                <span className="text-xs font-mono font-semibold flex-1">#{sc.check.number}</span>
                <input type="number" className={`${inputCls} w-24 text-xs`} value={sc.amount}
                  onChange={e => updateCheckAmount(sc.check.id, Number(e.target.value))}
                />
                <button onClick={() => removeSelectedCheck(sc.check.id)} className="text-red-400 hover:text-red-600"><X size={14} /></button>
              </div>
            ))}
          </div>
        )}

        {/* Summary */}
        <div className="border-t border-slate-200 pt-2 space-y-1 text-sm">
          <div className="flex justify-between text-slate-600"><span>À payer</span><span className="font-semibold">{amount.toLocaleString()} Dhs</span></div>
          {especeAmount > 0 && <div className="flex justify-between text-emerald-600"><span>Espèce</span><span>{especeAmount.toLocaleString()} Dhs</span></div>}
          {virementAmount > 0 && <div className="flex justify-between text-blue-600"><span>Virement</span><span>{virementAmount.toLocaleString()} Dhs</span></div>}
          {totalChecksAmount > 0 && <div className="flex justify-between text-purple-600"><span>Chèque(s)</span><span>{totalChecksAmount.toLocaleString()} Dhs</span></div>}
          <div className={`flex justify-between font-semibold pt-1 border-t ${remaining === 0 ? "text-emerald-600" : "text-red-500"}`}>
            <span>{remaining === 0 ? "Payé" : "Reste"}</span>
            <span>{Math.abs(remaining).toLocaleString()} Dhs</span>
          </div>
        </div>

        <div className="flex gap-3 pt-2 border-t border-slate-100">
          <Btn onClick={handleSubmit} disabled={loading || remaining > 0}>
            {loading ? "Paiement..." : <><Check size={13} /> Confirmer le paiement</>}
          </Btn>
          <Btn variant="outline" onClick={onClose}>Annuler</Btn>
        </div>
      </div>
    </Modal>
  );
}