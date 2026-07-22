import { useState, useEffect } from "react";
import { Check, X, Plus } from "lucide-react";
import { Modal, Field, Btn, inputCls, selectCls } from "../shared/Primitives";
import { useApi } from "../../../hooks/useSupabase";

interface Trainer {
  id: string;
  name: string;
  specialty: string;
}

interface Props {
  onClose: () => void;
  onCreated?: () => void;
}

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
export function ModalAddExercice({ onClose, onCreated }: Props) {
  const api = useApi();
  const [loading, setLoading] = useState(false);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [coachId, setCoachId] = useState("");
  const [price, setPrice] = useState(0);
  const [slots, setSlots] = useState([{ day: "Lundi", start: "09:00", end: "10:00" }]);

  useEffect(() => {
    api.trainers.getAll().then(setTrainers).catch(console.error);
  }, []);

  function addSlot() {
    setSlots([...slots, { day: "Lundi", start: "09:00", end: "10:00" }]);
  }

  function updateSlot(i: number, field: "day" | "start" | "end", value: string) {
    setSlots(slots.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)));
  }

  function removeSlot(i: number) {
    if (slots.length > 1) setSlots(slots.filter((_, idx) => idx !== i));
  }

  async function handleSubmit() {
    if (!name || !coachId) return alert("Veuillez remplir tous les champs obligatoires");
    setLoading(true);
    try {
      // Create one exercise per slot
      for (const slot of slots) {
        await api.exercises.create({
          name,
          day: slot.day,
          type,
          start_time: slot.start,
          end_time: slot.end,
          coach_id: coachId,
          price,
        });
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
    <Modal title="Créer une Séance" onClose={onClose} wide>
      <div className="space-y-4">
        {/* Basic info */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nom de la séance" required>
            <input className={inputCls} placeholder="Ex: Football U8" value={name} onChange={e => setName(e.target.value)} />
          </Field>
          <Field label="Type de sport" required>
            <input className={inputCls} placeholder="Ex: Football, Basketball, Natation..." value={type} onChange={e => setType(e.target.value)} />
          </Field>
          <Field label="Coach / Entraîneur" required>
            <select className={selectCls} value={coachId} onChange={e => setCoachId(e.target.value)}>
              <option value="">Sélectionner...</option>
              {trainers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
          <Field label="Prix (Dhs)">
            <input type="number" className={inputCls} value={price} onChange={e => setPrice(Number(e.target.value))} />
          </Field>
        </div>

        {/* Multiple day/time slots */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Jours & Horaires</p>
            <Btn size="sm" variant="ghost" onClick={addSlot}><Plus size={12} /> Ajouter un créneau</Btn>
          </div>
          <div className="border border-slate-200 divide-y divide-slate-100">
            {slots.map((slot, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
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
            {loading ? "Création..." : <><Check size={13} /> Créer la séance</>}
          </Btn>
          <Btn variant="outline" onClick={onClose}>Annuler</Btn>
        </div>
      </div>
    </Modal>
  );
}