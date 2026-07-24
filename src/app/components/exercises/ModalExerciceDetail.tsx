import { useState, useEffect } from "react";
import { Check, Trash2, Plus, X } from "lucide-react";
import { Modal, Tag, Btn, Field, inputCls, selectCls } from "../shared/Primitives";
import { useApi } from "../../../hooks/useSupabase";
import { Group } from "../../types";

interface Trainer {
  id: string;
  name: string;
}

interface Slot {
  day: string;
  start: string;
  end: string;
  coach_id: string;
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
  group_id: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  trainers?: { name: string };
  groups?: { name: string; description: string };
}

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

export function ModalExerciceDetail({ exerciseId, onClose, onUpdated, role }: { exerciseId: string; onClose: () => void; onUpdated?: () => void; role?: string }) {
  const api = useApi();
  const [ex, setEx] = useState<ExerciseData | null>(null);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [groupId, setGroupId] = useState("");
  const [name, setName] = useState("");
  const [slots, setSlots] = useState<Slot[]>([{ day: "Lundi", start: "09:00", end: "10:00", coach_id: "" }]);

  useEffect(() => {
    loadData();
  }, [exerciseId]);

  async function loadData() {
    setLoading(true);
    try {
      const [data, trainersData, groupsData] = await Promise.all([
        api.exercises.getById(exerciseId),
        api.trainers.getAll(),
        api.groups.getAll(),
      ]);
      setEx(data);
      setTrainers(trainersData);
      setGroups(groupsData);
      setGroupId(data.group_id || "");
      setName(data.name);
      setSlots([{
        day: data.day,
        start: data.start_time,
        end: data.end_time,
        coach_id: data.coach_id || "",
      }]);
    } catch (err: any) {
      console.error("Failed to load exercise:", err);
    } finally {
      setLoading(false);
    }
  }

  const selectedGroup = groups.find(g => g.id === groupId);
  let groupItems: string[] = [];
  try {
    if (selectedGroup?.description) groupItems = JSON.parse(selectedGroup.description);
  } catch { groupItems = []; }

  function addSlot() {
    setSlots([...slots, { day: "Lundi", start: "09:00", end: "10:00", coach_id: "" }]);
  }

  function updateSlot(i: number, field: keyof Slot, value: string) {
    setSlots(slots.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)));
  }

  function removeSlot(i: number) {
    if (slots.length > 1) setSlots(slots.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    if (!name) return alert("Veuillez remplir tous les champs obligatoires");
    const hasCoach = slots.some(s => s.coach_id);
    if (!hasCoach) return alert("Au moins un créneau doit avoir un coach");
    setLoading(true);
    try {
      // Delete old exercise and recreate with new slots
      await api.exercises.remove(exerciseId);
      for (const slot of slots) {
        if (!slot.coach_id) continue;
        await api.exercises.create({
          name,
          day: slot.day,
          type: ex?.type || "",
          start_time: slot.start,
          end_time: slot.end,
          coach_id: slot.coach_id,
          group_id: groupId || null,
        });
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
    if (!confirm("Supprimer cette activité ? Cette action est irréversible.")) return;
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
      <Modal title="Détails de l'Activité" onClose={onClose}>
        <div className="p-6 text-sm text-slate-500 text-center">Chargement...</div>
      </Modal>
    );
  }

  if (!ex) {
    return (
      <Modal title="Détails de l'Activité" onClose={onClose}>
        <div className="p-6 text-sm text-red-500 text-center">Activité introuvable.</div>
      </Modal>
    );
  }

  return (
    <Modal title={editing ? "Modifier l'Activité" : "Détails de l'Activité"} onClose={onClose} wide>
      {editing ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Groupe" required>
              <select className={selectCls} value={groupId} onChange={e => { setGroupId(e.target.value); setName(""); }}>
                <option value="">Sélectionner un groupe...</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </Field>
            <Field label="Nom de l'activité" required>
              {groupId && groupItems.length > 0 ? (
                <select className={selectCls} value={name} onChange={e => setName(e.target.value)}>
                  <option value="">Sélectionner...</option>
                  {groupItems.map((item, i) => <option key={i} value={item}>{item}</option>)}
                </select>
              ) : (
                <input className={inputCls} placeholder="Ex: Football U8" value={name} onChange={e => setName(e.target.value)} />
              )}
            </Field>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Jours & Horaires</p>
              <Btn size="sm" variant="ghost" onClick={addSlot}><Plus size={12} /> Ajouter un créneau</Btn>
            </div>
            <div className="border border-slate-200 divide-y divide-slate-100">
              {slots.map((slot, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <select className={selectCls} value={slot.coach_id} onChange={e => updateSlot(i, "coach_id", e.target.value)}>
                    <option value="">Coach...</option>
                    {trainers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <select className={selectCls} value={slot.day} onChange={e => updateSlot(i, "day", e.target.value)}>
                    {DAYS.map(d => <option key={d}>{d}</option>)}
                  </select>
                  <input type="time" className={inputCls} value={slot.start} onChange={e => updateSlot(i, "start", e.target.value)} />
                  <span className="text-slate-400 text-sm">→</span>
                  <input type="time" className={inputCls} value={slot.end} onChange={e => updateSlot(i, "end", e.target.value)} />
                  {slots.length > 1 && (
                    <button onClick={() => removeSlot(i)} className="p-1 text-slate-400 hover:text-red-500 transition-colors shrink-0">
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2 border-t border-slate-100">
            <Btn onClick={handleSave} disabled={loading}>
              {loading ? "Enregistrement..." : <><Check size={13} /> Enregistrer</>}
            </Btn>
            <Btn variant="outline" onClick={() => setEditing(false)}>Annuler</Btn>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="border border-slate-200 divide-y divide-slate-100 text-sm">
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-slate-500">Groupe</span>
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
              <span className="text-slate-500">Activité</span>
              <span className="text-slate-900">{ex.groups?.name || "—"}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-slate-500">Coach</span>
              <span className="text-slate-900">{ex.trainers?.name || "—"}</span>
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