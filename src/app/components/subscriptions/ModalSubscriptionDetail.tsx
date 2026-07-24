import { useState, useEffect, useRef, useMemo } from "react";
import { Check, Trash2, Plus, Eye, Search, X, Banknote, Landmark, FileText } from "lucide-react";
import { Modal, Tag, Btn, Field, inputCls } from "../shared/Primitives";
import { useApi } from "../../../hooks/useSupabase";
import { Child, Check as CheckType } from "../../types";

interface Exercise {
  id: string;
  name: string;
  day: string;
  start_time: string;
  end_time: string;
  type: string;
  trainers?: { name: string };
}

interface SubscriptionData {
  id: string;
  child_id: string;
  type: string;
  sub_type: string | null;
  amount: number;
  discount: number;
  insurance: number;
  entry_fee: number;
  status: string;
  exercises: string[];
  start_date: string;
  end_date: string;
  created_at: string;
  created_by?: string;
  confirmed_by?: string;
  children?: { name: string };
}

type PaymentMethod = "espece" | "virement" | "cheque";

const PRICE_TABLE: Record<string, Record<string, number>> = {
  "1": { Session: 3900, Annuel: 6600 },
  "2": { Session: 6300, Annuel: 10200 },
  "3": { Session: 8100, Annuel: 13800 },
  "4": { Session: 9300, Annuel: 16200 },
};

const ACTIVITY_LABELS: Record<string, string> = {
  "1": "1 activité/semaine",
  "2": "2 activités/semaine",
  "3": "3 activités/semaine",
  "4": "4 activités/semaine",
};

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

export function ModalSubscriptionDetail({ subscriptionId, onClose, onUpdated }: { subscriptionId: string; onClose: () => void; onUpdated?: () => void }) {
  const api = useApi();
  const [sub, setSub] = useState<SubscriptionData | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [checks, setChecks] = useState<CheckType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    type: "Session",
    activities: "2",
    amount: 0,
    discount: 0,
    discountPercent: 0,
    discountType: "fixed" as "fixed" | "percent",
    insurance: 0,
    entry_fee: 0,
    start_date: "",
    end_date: "",
  });
  const [selectedExercises, setSelectedExercises] = useState<string[]>([]);
  const [exSearch, setExSearch] = useState("");

  // Payment state
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [checkSearch, setCheckSearch] = useState("");
  const [showCheckSuggestions, setShowCheckSuggestions] = useState(false);
  const [selectedChecks, setSelectedChecks] = useState<{ check: CheckType; amount: number }[]>([]);
  const [especeAmount, setEspeceAmount] = useState(0);
  const [virementAmount, setVirementAmount] = useState(0);
  // Inline check creation state
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

  useEffect(() => {
    loadData();
  }, [subscriptionId]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (checkSearchRef.current && !checkSearchRef.current.contains(e.target as Node)) {
        setShowCheckSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const data = await api.subscriptions.getById(subscriptionId);
      setSub(data);
      // Extract activities count from sub_type
      let activities = "2";
      if (data.sub_type) {
        const match = data.sub_type.match(/^(\d+)/);
        if (match) activities = match[1];
      }
      setForm({
        type: data.type,
        activities,
        amount: data.amount,
        discount: data.discount,
        discountPercent: 0,
        discountType: "fixed",
        insurance: data.insurance,
        entry_fee: data.entry_fee,
        start_date: data.start_date,
        end_date: data.end_date,
      });
      setSelectedExercises(data.exercises || []);
      // Load children for the child name display
      api.children.getAll().then(setChildren).catch(console.error);
      api.exercises.getAll().then(setExercises).catch(console.error);
      api.checks.getAll().then(setChecks).catch(console.error);
    } catch (err: any) {
      console.error("Failed to load subscription:", err);
    } finally {
      setLoading(false);
    }
  }

  function set(field: string, value: any) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  const baseAmount = editing ? (PRICE_TABLE[form.activities]?.[form.type] || 0) : sub?.amount || 0;
  const effectiveDiscount = editing
    ? (form.discountType === "percent"
        ? Math.round(baseAmount * (form.discountPercent / 100))
        : form.discount)
    : sub?.discount || 0;
  const total = baseAmount - effectiveDiscount + form.insurance + form.entry_fee;

  const filteredExercises = exercises.filter(ex =>
    ex.name.toLowerCase().includes(exSearch.toLowerCase())
  );

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
  const remaining = total - totalPaid;

  function toggleExercise(exId: string) {
    setSelectedExercises(prev =>
      prev.includes(exId) ? prev.filter(id => id !== exId) : [...prev, exId]
    );
  }

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
      // Refresh checks list and select the new check
      const updatedChecks = await api.checks.getAll();
      setChecks(updatedChecks);
      setNewCheckNum("");
      setNewCheckAmount("");
      setNewCheckBank("");
      setNewCheckHolder("");
      setNewCheckDateEmission(new Date().toISOString().split("T")[0]);
      setNewCheckDateExecution("");
      setNewCheckCreated(true);
      // Auto-select the created check
      const freshCheck = updatedChecks.find((c: CheckType) => c.id === created.id);
      if (freshCheck) {
        handleSelectCheck(freshCheck);
      }
      setTimeout(() => setNewCheckCreated(false), 3000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingCheck(false);
    }
  }

  async function handleSave() {
    if (!form.start_date || !form.end_date) return;
    setLoading(true);
    try {
      await api.subscriptions.update(subscriptionId, {
        type: form.type,
        sub_type: `${form.activities} activités/semaine`,
        amount: baseAmount,
        discount: effectiveDiscount,
        insurance: form.insurance,
        entry_fee: form.entry_fee,
        exercises: selectedExercises,
        start_date: form.start_date,
        end_date: form.end_date,
      });

      // Create payment if there's a payment
      if (totalPaid > 0) {
        const checkIds = selectedChecks.map(s => s.check.id);
        const payment = await api.payments.create({
          subscription_id: subscriptionId,
          amount: totalPaid,
          method: paymentMethods,
          check_ids: checkIds,
        });

        // Update checks montant_used
        for (const sc of selectedChecks) {
          await api.checks.useCheck(sc.check.id, sc.amount, payment.id);
        }
      }

      setEditing(false);
      onUpdated?.();
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Supprimer cet abonnement ? Cette action est irréversible.")) return;
    try {
      await api.subscriptions.remove(subscriptionId);
      onUpdated?.();
      onClose();
    } catch (err: any) {
      alert(err.message);
    }
  }

  const linkedChild = children.find(c => c.id === sub?.child_id);

  if (loading && !sub) {
    return (
      <Modal title={editing ? "Modifier l'Abonnement" : "Détails de l'Abonnement"} onClose={onClose}>
        <div className="p-6 text-sm text-slate-500 text-center">Chargement...</div>
      </Modal>
    );
  }

  if (!sub) {
    return (
      <Modal title="Détails de l'Abonnement" onClose={onClose}>
        <div className="p-6 text-sm text-red-500 text-center">Abonnement introuvable.</div>
      </Modal>
    );
  }

  const statusColor = sub.status === "actif" ? "green" : sub.status === "expiré" || sub.status === "résilié" ? "red" : "amber";
  const displayTotal = sub.amount - sub.discount + sub.insurance + sub.entry_fee;

  return (
    <Modal title={editing ? "Modifier l'Abonnement" : "Détails de l'Abonnement"} onClose={onClose} wide>
      {editing ? (
        <div className="space-y-5 max-h-[80vh] overflow-y-auto pr-1">
          {/* ── Section 1 : Enfant info ── */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">1. Enfant</p>
            <div className="border border-slate-200 p-3 bg-slate-50">
              <p className="text-sm font-medium text-slate-900">{sub.children?.name || "—"}</p>
            </div>
          </div>

          {/* ── Section 2 : Type & Activités ── */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">2. Type d'abonnement</p>
            <div className="border border-slate-200 p-4 space-y-3">
              <div className="flex gap-2">
                {["Session", "Annuel"].map(t => (
                  <button key={t} onClick={() => set("type", t)}
                    className={`px-4 py-2 text-sm border font-medium transition-colors ${form.type === t ? "border-pink-500 bg-pink-500 text-white" : "border-slate-300 text-slate-600 hover:border-slate-400"}`}
                  >{t}</button>
                ))}
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Activités</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(ACTIVITY_LABELS).map(([key, label]) => (
                    <button key={key} onClick={() => set("activities", key)}
                      className={`px-3 py-2 text-xs border font-medium transition-colors text-left ${form.activities === key ? "border-pink-500 bg-pink-50 text-pink-700" : "border-slate-200 text-slate-600 hover:border-slate-400"}`}
                    >
                      <div>{label}</div>
                      <div className="text-pink-600 mt-0.5">{PRICE_TABLE[key][form.type].toLocaleString()} Dhs</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-500 mb-2">Tarifs {form.type}</p>
                <div className="grid grid-cols-2 gap-1 text-xs text-slate-700">
                  {Object.entries(PRICE_TABLE).map(([act, prices]) => (
                    <div key={act} className="flex justify-between px-1">
                      <span>{ACTIVITY_LABELS[act]}</span>
                      <span className={`font-semibold ${form.activities === act ? "text-pink-600" : ""}`}>{prices[form.type]?.toLocaleString()} Dhs</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 3 : Activités incluses ── */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">3. Activités incluses</p>
            <div className="border border-slate-200 p-4">
              <div className="relative mb-3">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className={`${inputCls} pl-8`}
                  placeholder="Rechercher une activité..."
                  value={exSearch}
                  onChange={e => setExSearch(e.target.value)}
                />
              </div>
              <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 border border-slate-200">
                {filteredExercises.length === 0 ? (
                  <div className="px-3 py-3 text-xs text-slate-400 text-center">Aucune activité trouvée</div>
                ) : (
                  filteredExercises.map(ex => {
                    const isSelected = selectedExercises.includes(ex.id);
                    return (
                      <button
                        key={ex.id}
                        onClick={() => toggleExercise(ex.id)}
                        className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors ${
                          isSelected ? "bg-emerald-50 text-emerald-800" : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <div>
                          <span className="font-medium">{ex.name}</span>
                          <span className="text-xs text-slate-400 ml-2">{ex.day} · {ex.start_time}–{ex.end_time}</span>
                          <span className="text-xs text-slate-400 ml-1">({ex.trainers?.name || "—"})</span>
                        </div>
                        <div className={`w-4 h-4 border flex items-center justify-center ${
                          isSelected ? "bg-emerald-500 border-emerald-500" : "border-slate-300"
                        }`}>
                          {isSelected && <Check size={10} className="text-white" />}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
              {selectedExercises.length > 0 && (
                <p className="text-xs text-emerald-600 mt-2">{selectedExercises.length} activité(s) sélectionnée(s)</p>
              )}
            </div>
          </div>

          {/* ── Section 4 : Financial details ── */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">4. Détails financiers</p>
            <div className="border border-slate-200 p-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Montant de base (Dhs)">
                  <div className={`${inputCls} bg-slate-100 text-slate-600`}>{baseAmount.toLocaleString()} Dhs</div>
                </Field>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-slate-500 mb-1">Remise</p>
                      {form.discountType === "percent" ? (
                        <div className="relative">
                          <input type="number" className={`${inputCls} pr-8`} value={form.discountPercent} onChange={e => set("discountPercent", Number(e.target.value))} placeholder="0" min="0" max="100" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
                        </div>
                      ) : (
                        <input type="number" className={inputCls} value={form.discount} onChange={e => set("discount", Number(e.target.value))} placeholder="0" />
                      )}
                    </div>
                    <div className="flex gap-1 pt-5">
                      <button
                        type="button"
                        onClick={() => { set("discountType", "fixed"); set("discountPercent", 0); }}
                        className={`px-2 py-1 text-xs border font-medium transition-colors ${form.discountType === "fixed" ? "border-pink-500 bg-pink-50 text-pink-700" : "border-slate-200 text-slate-500 hover:border-slate-400"}`}
                      >Dhs</button>
                      <button
                        type="button"
                        onClick={() => { set("discountType", "percent"); set("discount", 0); }}
                        className={`px-2 py-1 text-xs border font-medium transition-colors ${form.discountType === "percent" ? "border-pink-500 bg-pink-50 text-pink-700" : "border-slate-200 text-slate-500 hover:border-slate-400"}`}
                      >%</button>
                    </div>
                  </div>
                  {form.discountType === "percent" && form.discountPercent > 0 && (
                    <p className="text-xs text-slate-500 -mt-2 mb-2">{form.discountPercent}% = {Math.round(baseAmount * form.discountPercent / 100).toLocaleString()} Dhs de remise</p>
                  )}
                </div>
                <Field label="Assurance (Dhs)">
                  <input type="number" className={inputCls} value={form.insurance} onChange={e => set("insurance", Number(e.target.value))} />
                </Field>
                <Field label="Droit d'entrée (Dhs)">
                  <input type="number" className={inputCls} value={form.entry_fee} onChange={e => set("entry_fee", Number(e.target.value))} />
                </Field>
                <Field label="Date début" required>
                  <input type="date" className={inputCls} value={form.start_date} onChange={e => set("start_date", e.target.value)} />
                </Field>
                <Field label="Date fin" required>
                  <input type="date" className={inputCls} value={form.end_date} onChange={e => set("end_date", e.target.value)} />
                </Field>
              </div>
              <div className="mt-3 border-t border-slate-200 pt-3 flex justify-between items-center">
                <span className="text-sm font-semibold text-slate-700">Total à payer</span>
                <span className="text-lg font-bold text-pink-600">{total.toLocaleString()} Dhs</span>
              </div>
            </div>
          </div>

          {/* ── Section 5 : Paiement ── */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">5. Moyen de paiement</p>
            <div className="border border-slate-200 p-4 space-y-4">
              {/* Payment method selection */}
              <div className="flex gap-2 flex-wrap">
                {(["espece", "virement", "cheque"] as PaymentMethod[]).map(m => {
                  const Icon = METHOD_ICONS[m];
                  const isSelected = paymentMethods.includes(m);
                  return (
                    <button
                      key={m}
                      onClick={() => togglePaymentMethod(m)}
                      className={`flex items-center gap-2 px-4 py-2.5 text-sm border font-medium transition-colors ${
                        isSelected
                          ? "border-pink-500 bg-pink-50 text-pink-700"
                          : "border-slate-300 text-slate-600 hover:border-slate-400"
                      }`}
                    >
                      <Icon size={14} />
                      {METHOD_LABELS[m]}
                      {isSelected && <Check size={12} className="text-pink-500" />}
                    </button>
                  );
                })}
              </div>

              {/* Espèce amount */}
              {paymentMethods.includes("espece") && (
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Montant en Espèce (Dhs)">
                    <input
                      type="number"
                      className={inputCls}
                      value={especeAmount}
                      onChange={e => setEspeceAmount(Math.max(0, Number(e.target.value)))}
                      placeholder="0"
                    />
                  </Field>
                </div>
              )}

              {/* Virement amount */}
              {paymentMethods.includes("virement") && (
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Montant Virement (Dhs)">
                    <input
                      type="number"
                      className={inputCls}
                      value={virementAmount}
                      onChange={e => setVirementAmount(Math.max(0, Number(e.target.value)))}
                      placeholder="0"
                    />
                  </Field>
                </div>
              )}

              {/* Chèque selection */}
              {paymentMethods.includes("cheque") && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase">Chèques</p>
                  </div>

                  {/* ── Compact: Add new check ── */}
                  <div className="mb-3 border border-dashed border-slate-300">
                    <button
                      onClick={() => setShowNewCheckForm(!showNewCheckForm)}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-500 uppercase hover:bg-slate-50 transition-colors"
                    >
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
                        <div className="flex items-center gap-2">
                          <Btn size="sm" onClick={handleCreateCheckInline} disabled={savingCheck}>
                            {savingCheck ? "..." : <><Plus size={11} /> Créer</>}
                          </Btn>
                          {newCheckCreated && (
                            <span className="text-xs text-emerald-600 flex items-center gap-1">
                              <Check size={10} /> Créé !
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Search checks */}
                  <div className="relative mb-3" ref={checkSearchRef}>
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      className={`${inputCls} pl-8`}
                      placeholder="Rechercher un chèque par numéro, banque..."
                      value={checkSearch}
                      onChange={e => { setCheckSearch(e.target.value); setShowCheckSuggestions(true); }}
                      onFocus={() => setShowCheckSuggestions(true)}
                    />
                    {showCheckSuggestions && checkSearch && (
                      <div className="absolute z-10 top-full left-0 right-0 bg-white border border-slate-200 shadow-lg max-h-48 overflow-y-auto">
                        {filteredChecks.length === 0 ? (
                          <div className="px-3 py-2 text-xs text-slate-400">Aucun chèque disponible</div>
                        ) : (
                          filteredChecks.map(c => {
                            const rest = c.amount - c.montant_used;
                            return (
                              <button
                                key={c.id}
                                onClick={() => handleSelectCheck(c)}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-pink-50 transition-colors flex items-center justify-between text-slate-700"
                              >
                                <div>
                                  <span className="font-mono font-semibold">#{c.number}</span>
                                  <span className="text-xs text-slate-400 ml-2">{c.bank || "—"}</span>
                                </div>
                                <div className="text-xs">
                                  <span className="text-slate-500">{rest.toLocaleString()} Dhs</span>
                                  <span className="text-slate-300 ml-1">disponible</span>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>

                  {/* Selected checks */}
                  {selectedChecks.length > 0 && (
                    <div className="space-y-2">
                      {selectedChecks.map(sc => {
                        const rest = sc.check.amount - sc.check.montant_used;
                        return (
                          <div key={sc.check.id} className="flex items-center gap-3 bg-slate-50 border border-slate-200 p-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-mono font-semibold text-slate-900">#{sc.check.number}</p>
                              <p className="text-xs text-slate-400">{sc.check.bank} — {sc.check.account_holder}</p>
                              <p className="text-xs text-slate-400">Disponible: {rest.toLocaleString()} Dhs</p>
                            </div>
                            <div className="w-32">
                              <Field label="Montant">
                                <input
                                  type="number"
                                  className={`${inputCls} text-sm`}
                                  value={sc.amount}
                                  onChange={e => updateCheckAmount(sc.check.id, Number(e.target.value))}
                                  max={rest}
                                />
                              </Field>
                            </div>
                            <button
                              onClick={() => removeSelectedCheck(sc.check.id)}
                              className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Payment summary */}
              <div className="border-t border-slate-200 pt-3 space-y-1 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Total à payer</span>
                  <span className="font-semibold">{total.toLocaleString()} Dhs</span>
                </div>
                {paymentMethods.includes("espece") && especeAmount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Espèce</span>
                    <span>{especeAmount.toLocaleString()} Dhs</span>
                  </div>
                )}
                {paymentMethods.includes("virement") && virementAmount > 0 && (
                  <div className="flex justify-between text-blue-600">
                    <span>Virement</span>
                    <span>{virementAmount.toLocaleString()} Dhs</span>
                  </div>
                )}
                {paymentMethods.includes("cheque") && totalChecksAmount > 0 && (
                  <div className="flex justify-between text-purple-600">
                    <span>Chèque(s) ({selectedChecks.length})</span>
                    <span>{totalChecksAmount.toLocaleString()} Dhs</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold pt-1 border-t border-slate-100">
                  <span className={remaining === 0 ? "text-emerald-600" : "text-red-500"}>
                    {remaining === 0 ? "Payé" : "Reste à payer"}
                  </span>
                  <span className={remaining === 0 ? "text-emerald-600" : "text-red-500"}>
                    {Math.abs(remaining).toLocaleString()} Dhs
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2 border-t border-slate-100">
            <Btn onClick={handleSave} disabled={loading}><Check size={13} /> Enregistrer</Btn>
            <Btn variant="outline" onClick={() => { setEditing(false); loadData(); }}>Annuler</Btn>
          </div>
        </div>
      ) : (
        <div className="space-y-5">

          {/* ── Enfant info ── */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">1. Enfant</p>
            <div className="border border-slate-200 p-3 bg-slate-50 flex items-center justify-between">
              <span className="font-medium text-slate-900">{sub.children?.name || "—"}</span>
              <Tag color={statusColor}>{sub.status}</Tag>
            </div>
          </div>

          {/* ── Subscription type ── */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">2. Type d'abonnement</p>
            <div className="border border-slate-200 divide-y divide-slate-100">
              <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-slate-500">Type</span>
                <span className="font-medium text-slate-900">{sub.type}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-slate-500">Forfait</span>
                <span className="text-slate-900">{sub.sub_type || "—"}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-slate-500">Validité</span>
                <span className="text-slate-400 text-xs">{sub.start_date} → {sub.end_date}</span>
              </div>
            </div>
          </div>

          {/* ── Financial details ── */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">3. Détails financiers</p>
            <div className="border border-slate-200 divide-y divide-slate-100">
              <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-slate-500">Montant de base</span>
                <span className="font-semibold text-slate-900">{sub.amount.toLocaleString()} Dhs</span>
              </div>
              {sub.discount > 0 && (
                <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-slate-500">Remise</span>
                  <span className="text-pink-600">−{sub.discount.toLocaleString()} Dhs</span>
                </div>
              )}
              {sub.insurance > 0 && (
                <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-slate-500">Assurance</span>
                  <span className="text-slate-900">{sub.insurance.toLocaleString()} Dhs</span>
                </div>
              )}
              {sub.entry_fee > 0 && (
                <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-slate-500">Droit d'entrée</span>
                  <span className="text-slate-900">{sub.entry_fee.toLocaleString()} Dhs</span>
                </div>
              )}
              <div className="flex items-center justify-between px-4 py-2.5 text-sm border-t-2 border-slate-300 bg-slate-50">
                <span className="font-semibold text-slate-700">Total</span>
                <span className="text-lg font-bold text-pink-600">{displayTotal.toLocaleString()} Dhs</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2 border-t border-slate-100">
            <Btn variant="outline" onClick={() => setEditing(true)}><Plus size={13} /> Modifier</Btn>
            <Btn variant="danger" onClick={handleDelete}><Trash2 size={13} /> Supprimer</Btn>
            <Btn variant="outline" onClick={onClose}>Fermer</Btn>
          </div>
        </div>
      )}
    </Modal>
  );
}