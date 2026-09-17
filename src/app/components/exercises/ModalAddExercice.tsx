import { useState, useEffect } from "react";
import { Check, X, Plus } from "lucide-react";
import { Modal, Field, Btn, inputCls, selectCls } from "../shared/Primitives";
import { useApi } from "../../../hooks/useSupabase";
import { Group } from "../../types";

interface Trainer {
  id: string;
  name: string;
  specialty: string;
}

interface Slot {
  day: string;
  start: string;
  end: string;
  coach_id: string;
}

interface Props {
  onClose: () => void;
  onCreated?: () => void;
  role?: string;
}

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
export function ModalAddExercice({ onClose, onCreated, role }: Props) {
  const api = useApi();
  const [loading, setLoading] = useState(false);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [slots, setSlots] = useState<Slot[]>([{ day: "Lundi", start: "09:00", end: "10:00", coach_id: "" }]);

  useEffect(() => {
    api.trainers.getAll().then(setTrainers).catch(console.error);
    api.groups.getAll().then(setGroups).catch(console.error);
  }, []);

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

  async function handleSubmit() {
    if (!name) return alert("Veuillez remplir tous les champs obligatoires");
    if (!type.trim()) return alert("Veuillez indiquer le type d'activité");
    const hasCoach = slots.some(s => s.coach_id);
    if (!hasCoach) return alert("Au moins un créneau doit avoir un coach");
    setLoading(true);
    try {
      for (const slot of slots) {
        if (!slot.coach_id) continue;
        const payload: any = {
          name,
          day: slot.day,
          type,
          start_time: slot.start,
          end_time: slot.end,
          coach_id: slot.coach_id,
          group_id: groupId || null,
        };
        await api.exercises.create(payload);
      }
      onCreated?.();
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Créer une Activité" onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Type d'activité" required>
            <input className={inputCls} placeholder="Ex: Football, Danse, Judo..." value={type} onChange={e => setType(e.target.value)} />
          </Field>
          <Field label="Activité" required>
            <select className={selectCls} value={groupId} onChange={e => { setGroupId(e.target.value); setName(""); }}>
              <option value="">Sélectionner un groupe...</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </Field>
          <Field label="Groupe" required>
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
          <Btn onClick={handleSubmit} disabled={loading}>
            {loading ? "Création..." : <><Check size={13} /> Créer un horaires</>}
          </Btn>
          <Btn variant="outline" onClick={onClose}>Annuler</Btn>
        </div>
      </div>
    </Modal>
  );
}