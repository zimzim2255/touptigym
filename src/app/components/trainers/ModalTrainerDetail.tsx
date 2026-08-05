import { useState, useEffect } from "react";
import { Check, Trash2, Plus } from "lucide-react";
import { Modal, Tag, Btn, Field, inputCls } from "../shared/Primitives";
import { useApi } from "../../../hooks/useSupabase";

interface TrainerData {
  id: string;
  name: string;
  birth_date: string | null;
  id_card: string | null;
  photo: string | null;
  email: string | null;
  phone: string | null;
  specialty: string | null;
  user_id?: string | null;
  created_at: string;
}

export function ModalTrainerDetail({ trainerId, onClose, onUpdated }: { trainerId: string; onClose: () => void; onUpdated?: () => void }) {
  const api = useApi();
  const [trainer, setTrainer] = useState<TrainerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: "", birth_date: "", id_card: "", phone: "", email: "", specialty: "",
    password: "",
  });
  const [pwMsg, setPwMsg] = useState("");

  useEffect(() => {
    loadData();
  }, [trainerId]);

  async function loadData() {
    setLoading(true);
    try {
      const data = await api.trainers.getById(trainerId);
      setTrainer(data);
      setForm({
        name: data.name,
        birth_date: data.birth_date || "",
        id_card: data.id_card || "",
        phone: data.phone || "",
        email: data.email || "",
        specialty: data.specialty || "",
        password: "",
      });
      setPwMsg("");
    } catch (err: any) {
      console.error("Failed to load trainer:", err);
    } finally {
      setLoading(false);
    }
  }

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    if (!form.name || !form.email) return;
    try {
      await api.trainers.update(trainerId, {
        name: form.name,
        birth_date: form.birth_date || null,
        id_card: form.id_card || null,
        phone: form.phone || null,
        email: form.email,
        specialty: form.specialty || null,
      });

      // If the admin entered a new password, update the linked user account
      if (form.password && trainer?.user_id) {
        await api.users.update(trainer.user_id, { password: form.password });
        setPwMsg("Mot de passe mis à jour ✓");
      }

      setEditing(false);
      onUpdated?.();
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleDelete() {
    if (!confirm("Supprimer cet entraîneur ? Cette action est irréversible.")) return;
    try {
      await api.trainers.remove(trainerId);
      onUpdated?.();
      onClose();
    } catch (err: any) {
      alert(err.message);
    }
  }

  if (loading && !trainer) {
    return (
      <Modal title="Détails de l'Entraîneur" onClose={onClose}>
        <div className="p-6 text-sm text-slate-500 text-center">Chargement...</div>
      </Modal>
    );
  }

  if (!trainer) {
    return (
      <Modal title="Détails de l'Entraîneur" onClose={onClose}>
        <div className="p-6 text-sm text-red-500 text-center">Entraîneur introuvable.</div>
      </Modal>
    );
  }

  return (
    <Modal title={editing ? "Modifier l'Entraîneur" : "Détails de l'Entraîneur"} onClose={onClose} wide>
      {editing ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nom" required>
              <input className={inputCls} value={form.name} onChange={e => set("name", e.target.value)} />
            </Field>
            <Field label="Date de naissance">
              <input type="date" className={inputCls} value={form.birth_date} onChange={e => set("birth_date", e.target.value)} />
            </Field>
            <Field label="CIN">
              <input className={inputCls} value={form.id_card} onChange={e => set("id_card", e.target.value)} />
            </Field>
            <Field label="Téléphone">
              <input className={inputCls} value={form.phone} onChange={e => set("phone", e.target.value)} />
            </Field>
            <Field label="Email" required>
              <input type="email" className={inputCls} value={form.email} onChange={e => set("email", e.target.value)} />
            </Field>
            <Field label="Spécialité">
              <input className={inputCls} value={form.specialty} onChange={e => set("specialty", e.target.value)} />
            </Field>
            <Field label="Nouveau mot de passe (connexion)">
              <input
                type="password"
                className={inputCls}
                placeholder="Laisser vide pour ne pas changer"
                value={form.password}
                onChange={e => set("password", e.target.value)}
              />
              {pwMsg && <p className="text-xs text-emerald-600 mt-1">{pwMsg}</p>}
            </Field>
          </div>
          <div className="flex gap-3 pt-2 border-t border-slate-100">
            <Btn onClick={handleSave}><Check size={13} /> Enregistrer</Btn>
            <Btn variant="outline" onClick={() => setEditing(false)}>Annuler</Btn>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="border border-slate-200 divide-y divide-slate-100 text-sm">
            {[
              { label: "Nom", value: trainer.name },
              { label: "Email", value: trainer.email || "—" },
              { label: "Téléphone", value: trainer.phone || "—" },
              { label: "CIN", value: trainer.id_card || "—" },
              { label: "Spécialité", value: trainer.specialty || "—" },
              { label: "Date de naissance", value: trainer.birth_date || "—" },
              { label: "Créé le", value: new Date(trainer.created_at).toLocaleDateString() },
            ].map((row, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-slate-500">{row.label}</span>
                <span className="font-medium text-slate-900">{row.value}</span>
              </div>
            ))}
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