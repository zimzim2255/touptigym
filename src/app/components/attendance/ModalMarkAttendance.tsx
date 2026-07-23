import { useState, useEffect } from "react";
import { Check, X, Eye } from "lucide-react";
import { Modal, Btn, inputCls, selectCls, Field, Tag } from "../shared/Primitives";
import { useApi } from "../../../hooks/useSupabase";

interface Exercise {
  id: string;
  name: string;
  day: string;
  start_time: string;
  end_time: string;
}

interface EnrolledChild {
  id: string;
  name: string;
  gender: string;
  age: number;
  client_type: string;
  photo: string | null;
}

interface Props {
  exercice: Exercise;
  onClose: () => void;
  onSaved?: () => void;
}

export function ModalMarkAttendance({ exercice, onClose, onSaved }: Props) {
  const api = useApi();
  const [children, setChildren] = useState<EnrolledChild[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Record<string, "present" | "absent">>({});
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [error, setError] = useState("");
  const [alreadyRecorded, setAlreadyRecorded] = useState(false);
  const [existingAbsences, setExistingAbsences] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Check if attendance already recorded for today
        const today = new Date().toISOString().split('T')[0];
        const result = await api.attendance.checkAttendance(exercice.id, today);
        const absMap: Record<string, string> = {};
        // result is { marked: boolean, absences: [{ child_id, type }] }
        if (result?.marked === true) {
          setAlreadyRecorded(true);
          if (result.absences && Array.isArray(result.absences)) {
            result.absences.forEach((a: { child_id: string; type: string }) => { absMap[a.child_id] = a.type; });
            setExistingAbsences(absMap);
          }
        }

        // Load enrolled children
        const data: EnrolledChild[] = await api.attendance.getExerciseChildren(exercice.id);
        setChildren(data);

        // Set status based on existing data or defaults
        const defaults: Record<string, "present" | "absent"> = {};
        data.forEach(c => {
          defaults[c.id] = absMap[c.id] ? "absent" : "present";
        });
        setStatus(defaults);
      } catch (err: any) {
        console.error("Failed to load data:", err);
        setError("Impossible de charger les données.");
      } finally {
        setLoading(false);
      }
    })();
  }, [exercice.id]);

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      // Always save: record absences for absent children
      const absences = children
        .filter(c => status[c.id] === "absent")
        .map(c => ({ child_id: c.id, type: "absence" }));

      // Always call the API to mark this exercise+date as recorded (overwrites if already exists)
      await api.attendance.markAttendance({
        exercise_id: exercice.id,
        date,
        absences,
      });

      onClose();
      onSaved?.();
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Présence — ${exercice.name} (${exercice.day} ${exercice.start_time}–${exercice.end_time})`} onClose={onClose} wide>
      <div className="space-y-3">
        <Field label="Date">
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className={inputCls}
          />
        </Field>

        {alreadyRecorded && (
          <div className="p-3 bg-amber-50 border border-amber-200 text-xs text-amber-700 flex items-center gap-2">
            <Eye size={14} /> Présence déjà enregistrée — vous pouvez la modifier
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>
        )}

        {loading ? (
          <div className="p-6 text-sm text-slate-500 text-center">Chargement des enfants inscrits...</div>
        ) : children.length === 0 ? (
          <div className="p-6 text-sm text-slate-500 text-center">Aucun enfant inscrit à cette séance.</div>
        ) : (
          <>
            <p className="text-sm text-slate-600">{children.length} enfant(s) inscrit(s) :</p>
            <div className="border border-slate-200 divide-y divide-slate-100 max-h-64 overflow-y-auto">
              {children.map(child => {
                const s = status[child.id];
                const isAbsent = existingAbsences[child.id];
                return (
                  <div key={child.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                        {child.name[0]}
                      </div>
                      <span className="text-sm text-slate-800">{child.name}</span>
                      {isAbsent && (
                        <Tag color="red">Absent</Tag>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setStatus(p => ({ ...p, [child.id]: "present" }))}
                        className={`px-3 py-1.5 text-xs font-medium border transition-colors ${
                          s === "present"
                            ? "bg-emerald-500 text-white border-emerald-500"
                            : "border-slate-300 text-slate-600 hover:border-emerald-400"
                        }`}
                      >
                        <Check size={11} className="inline mr-1" />Présent
                      </button>
                      <button
                        onClick={() => setStatus(p => ({ ...p, [child.id]: "absent" }))}
                        className={`px-3 py-1.5 text-xs font-medium border transition-colors ${
                          s === "absent"
                            ? "bg-red-500 text-white border-red-500"
                            : "border-slate-300 text-slate-600 hover:border-red-400"
                        }`}
                      >
                        <X size={11} className="inline mr-1" />Absent
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="flex gap-3 pt-2 border-t border-slate-100">
          <Btn className="w-full justify-center" onClick={handleSave} disabled={saving || loading}>
            <Check size={13} /> {saving ? "Enregistrement..." : alreadyRecorded ? "Mettre à jour" : "Enregistrer"}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}