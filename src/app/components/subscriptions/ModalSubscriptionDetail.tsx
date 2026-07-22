import { useState, useEffect } from "react";
import { Check, Trash2, Plus, Eye } from "lucide-react";
import { Modal, Tag, Btn, Field, inputCls } from "../shared/Primitives";
import { useApi } from "../../../hooks/useSupabase";
import { Child } from "../../types";

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

export function ModalSubscriptionDetail({ subscriptionId, onClose, onUpdated }: { subscriptionId: string; onClose: () => void; onUpdated?: () => void }) {
  const api = useApi();
  const [sub, setSub] = useState<SubscriptionData | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    type: "Session",
    activities: "2",
    amount: 0,
    discount: 0,
    insurance: 0,
    entry_fee: 0,
    start_date: "",
    end_date: "",
  });

  useEffect(() => {
    loadData();
  }, [subscriptionId]);

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
        insurance: data.insurance,
        entry_fee: data.entry_fee,
        start_date: data.start_date,
        end_date: data.end_date,
      });
      // Load children for the child name display
      api.children.getAll().then(setChildren).catch(console.error);
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
  const total = baseAmount - form.discount + form.insurance + form.entry_fee;

  async function handleSave() {
    if (!form.start_date || !form.end_date) return;
    setLoading(true);
    try {
      await api.subscriptions.update(subscriptionId, {
        type: form.type,
        sub_type: `${form.activities} activités/semaine`,
        amount: baseAmount,
        discount: form.discount,
        insurance: form.insurance,
        entry_fee: form.entry_fee,
        start_date: form.start_date,
        end_date: form.end_date,
      });
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
        <div className="space-y-5">
          {/* ── Enfant info ── */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">1. Enfant</p>
            <div className="border border-slate-200 p-3 bg-slate-50">
              <p className="text-sm font-medium text-slate-900">{sub.children?.name || "—"}</p>
            </div>
          </div>

          {/* ── Type & Activités ── */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">2. Type d'abonnement</p>
            <div className="border border-slate-200 p-4 space-y-3">
              <div className="flex gap-2">
                {["Session", "Annuel"].map(t => (
                  <button key={t} onClick={() => set("type", t)}
                    className={`px-4 py-2 text-sm border font-medium transition-colors ${form.type === t ? "border-orange-500 bg-orange-500 text-white" : "border-slate-300 text-slate-600 hover:border-slate-400"}`}
                  >{t}</button>
                ))}
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Activités</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(ACTIVITY_LABELS).map(([key, label]) => (
                    <button key={key} onClick={() => set("activities", key)}
                      className={`px-3 py-2 text-xs border font-medium transition-colors text-left ${form.activities === key ? "border-orange-500 bg-orange-50 text-orange-700" : "border-slate-200 text-slate-600 hover:border-slate-400"}`}
                    >
                      <div>{label}</div>
                      <div className="text-orange-600 mt-0.5">{PRICE_TABLE[key][form.type].toLocaleString()} Dhs</div>
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
                      <span className={`font-semibold ${form.activities === act ? "text-orange-600" : ""}`}>{prices[form.type]?.toLocaleString()} Dhs</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Financial details ── */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">3. Détails financiers</p>
            <div className="border border-slate-200 p-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Montant de base (Dhs)">
                  <div className={`${inputCls} bg-slate-100 text-slate-600`}>{baseAmount.toLocaleString()} Dhs</div>
                </Field>
                <Field label="Remise (Dhs)">
                  <input type="number" className={inputCls} value={form.discount} onChange={e => set("discount", Number(e.target.value))} />
                </Field>
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
                <span className="text-lg font-bold text-orange-600">{total.toLocaleString()} Dhs</span>
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
                  <span className="text-orange-600">−{sub.discount.toLocaleString()} Dhs</span>
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
                <span className="text-lg font-bold text-orange-600">{displayTotal.toLocaleString()} Dhs</span>
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