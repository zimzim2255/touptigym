import { useState, useEffect } from "react";
import { Check, Trash2, Plus } from "lucide-react";
import { Modal, Tag, Btn, Field, inputCls } from "../shared/Primitives";
import { useApi } from "../../../hooks/useSupabase";

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
  children?: { name: string };
}

export function ModalSubscriptionDetail({ subscriptionId, onClose, onUpdated }: { subscriptionId: string; onClose: () => void; onUpdated?: () => void }) {
  const api = useApi();
  const [sub, setSub] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    type: "Session", sub_type: "", amount: 0, discount: 0,
    insurance: 0, entry_fee: 0, start_date: "", end_date: "",
  });

  useEffect(() => {
    loadData();
  }, [subscriptionId]);

  async function loadData() {
    setLoading(true);
    try {
      const data = await api.subscriptions.getById(subscriptionId);
      setSub(data);
      setForm({
        type: data.type,
        sub_type: data.sub_type || "",
        amount: data.amount,
        discount: data.discount,
        insurance: data.insurance,
        entry_fee: data.entry_fee,
        start_date: data.start_date,
        end_date: data.end_date,
      });
    } catch (err: any) {
      console.error("Failed to load subscription:", err);
    } finally {
      setLoading(false);
    }
  }

  function set(field: string, value: any) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    if (!form.amount || !form.start_date || !form.end_date) return;
    try {
      await api.subscriptions.update(subscriptionId, {
        type: form.type,
        sub_type: form.sub_type || null,
        amount: form.amount,
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

  const total = form.amount - form.discount + form.insurance + form.entry_fee;

  if (loading) {
    return (
      <Modal title="Détails de l'Abonnement" onClose={onClose}>
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

  return (
    <Modal title={editing ? "Modifier l'Abonnement" : "Détails de l'Abonnement"} onClose={onClose} wide>
      {editing ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Type" required>
              <select className={inputCls} value={form.type} onChange={e => set("type", e.target.value)}>
                <option>Session</option><option>Annuel</option>
              </select>
            </Field>
            <Field label="Sous-type">
              <input className={inputCls} value={form.sub_type} onChange={e => set("sub_type", e.target.value)} placeholder="Ex: 2 Act/sem" />
            </Field>
            <Field label="Montant (Dhs)" required>
              <input type="number" className={inputCls} value={form.amount} onChange={e => set("amount", Number(e.target.value))} />
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
          <div className="flex gap-3 pt-2 border-t border-slate-100">
            <Btn onClick={handleSave}><Check size={13} /> Enregistrer</Btn>
            <Btn variant="outline" onClick={() => setEditing(false)}>Annuler</Btn>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="border border-slate-200 p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Enfant</span><span className="font-medium text-slate-900">{sub.children?.name || "—"}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Type</span><span className="text-slate-900">{sub.type} {sub.sub_type ? `— ${sub.sub_type}` : ""}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Montant</span><span className="font-semibold text-slate-900">{sub.amount.toLocaleString()} Dhs</span></div>
            {sub.discount > 0 && <div className="flex justify-between text-orange-600"><span>Remise</span><span>−{sub.discount.toLocaleString()} Dhs</span></div>}
            {sub.insurance > 0 && <div className="flex justify-between"><span className="text-slate-500">Assurance</span><span className="text-slate-900">{sub.insurance.toLocaleString()} Dhs</span></div>}
            {sub.entry_fee > 0 && <div className="flex justify-between"><span className="text-slate-500">Droit d'entrée</span><span className="text-slate-900">{sub.entry_fee.toLocaleString()} Dhs</span></div>}
            <div className="flex justify-between border-t border-slate-300 pt-1 font-semibold"><span>Total</span><span>{(sub.amount - sub.discount + sub.insurance + sub.entry_fee).toLocaleString()} Dhs</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Validité</span><span className="text-xs text-slate-400">{sub.start_date} → {sub.end_date}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Statut</span>
              <Tag color={sub.status === "actif" ? "green" : sub.status === "expiré" ? "red" : "amber"}>{sub.status}</Tag>
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