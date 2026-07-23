import { useState, useEffect } from "react";
import { Check, Trash2, Plus } from "lucide-react";
import { Modal, Tag, Btn, Field, inputCls, selectCls } from "../shared/Primitives";
import { useApi } from "../../../hooks/useSupabase";

interface Trainer {
  id: string;
  name: string;
}

interface ExerciseData {
  id: string;
  name: string;
  day: string;
  type: string;
  start_time: string;
  end_time: string;
  coach_id: string;
  price: number;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  trainers?: { name: string };
}

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const SPORTS = ["Football", "Basketball", "Swimming", "Gymnastics", "Other"];

export function ModalExerciceDetail({ exerciseId, onClose, onUpdated, role }: { exerciseId: string; onClose: () => void; onUpdated?: () => void; role?: string }) {
  const api = useApi();
  const [ex, setEx] = useState<ExerciseData | null>(null);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: "", day: "Lundi", type: "Football", coach_id: "",
    start_time: "", end_time: "", price: 0,
  });

  useEffect(() => {
    loadData();
  }, [exerciseId]);

  async function loadData() {
    setLoading(true);
    try {
      const [data, trainersData] = await Promise.all([
        api.exercises.getById(exerciseId),
        api.trainers.getAll(),
      ]);
      setEx(data);
      setTrainers(trainersData);
      setForm({
        name: data.name,
        day: data.day,
        type: data.type,
        coach_id: data.coach_id || "",
        start_time: data.start_time,
        end_time: data.end_time,
        price: data.price || 0,
      });
    } catch (err: any) {
      console.error("Failed to load exercise:", err);
    } finally {
      setLoading(false);
    }
  }

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    if (!form.name || !form.coach_id) return;
    try {
      await api.exercises.update(exerciseId, {
        name: form.name,
        day: form.day,
        type: form.type,
        start_time: form.start_time,
        end_time: form.end_time,
        coach_id: form.coach_id,
        price: form.price,
      });
      setEditing(false);
      onUpdated?.();
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleDelete() {
    if (!confirm("Supprimer cette séance ? Cette action est irréversible.")) return;
    try {
      await api.exercises.remove(exerciseId);
      onUpdated?.();
      onClose();
    } catch (err: any) {
      alert(err.message);
    }
  }

  if (loading && !ex) {
    return (
      <Modal title="Détails de la Séance" onClose={onClose}>
        <div className="p-6 text-sm text-slate-500 text-center">Chargement...</div>
      </Modal>
    );
  }

  if (!ex) {
    return (
      <Modal title="Détails de la Séance" onClose={onClose}>
        <div className="p-6 text-sm text-red-500 text-center">Séance introuvable.</div>
      </Modal>
    );
  }

  return (
    <Modal title={editing ? "Modifier la Séance" : "Détails de la Séance"} onClose={onClose} wide>
      {editing ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nom" required>
              <input className={inputCls} value={form.name} onChange={e => set("name", e.target.value)} />
            </Field>
            <Field label="Jour" required>
              <select className={selectCls} value={form.day} onChange={e => set("day", e.target.value)}>
                {DAYS.map(d => <option key={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="Type de sport" required>
              <select className={selectCls} value={form.type} onChange={e => set("type", e.target.value)}>
                {SPORTS.map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Coach" required>
              <select className={selectCls} value={form.coach_id} onChange={e => set("coach_id", e.target.value)}>
                {trainers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
            <Field label="Horaire début" required>
              <input type="time" className={inputCls} value={form.start_time} onChange={e => set("start_time", e.target.value)} />
            </Field>
            <Field label="Horaire fin" required>
              <input type="time" className={inputCls} value={form.end_time} onChange={e => set("end_time", e.target.value)} />
            </Field>
            {role !== "trainer" && (
              <Field label="Prix (Dhs)">
                <input type="number" className={inputCls} value={form.price} onChange={e => set("price", e.target.value)} />
              </Field>
            )}
          </div>
          <div className="flex gap-3 pt-2 border-t border-slate-100">
            <Btn onClick={handleSave}><Check size={13} /> Enregistrer</Btn>
            <Btn variant="outline" onClick={() => setEditing(false)}>Annuler</Btn>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="border border-slate-200 divide-y divide-slate-100 text-sm">
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-slate-500">Nom</span>
              <span className="font-medium text-slate-900">{ex.name}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-slate-500">Jour</span>
              <span className="text-slate-900">{ex.day}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-slate-500">Horaire</span>
              <span className="font-mono text-xs text-slate-600">{ex.start_time} → {ex.end_time}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-slate-500">Type</span>
              <Tag color={ex.type === "Football" ? "green" : ex.type === "Basketball" ? "default" : ex.type === "Swimming" ? "blue" : "gray"}>{ex.type}</Tag>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-slate-500">Coach</span>
              <span className="text-slate-900">{ex.trainers?.name || "—"}</span>
            </div>
            {role !== "trainer" && (
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-slate-500">Prix</span>
                <span className="text-slate-900">{ex.price || 0} Dhs</span>
              </div>
            )}
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