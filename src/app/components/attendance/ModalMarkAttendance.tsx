import { useState, useEffect } from "react";
import { Check, X } from "lucide-react";
import { Modal, Btn, Tag } from "../shared/Primitives";
import { useApi } from "../../../hooks/useSupabase";

interface Exercise {
  id: string;
  name: string;
  day: string;
  start_time: string;
  end_time: string;
}

interface EnrolledChild {
  child_id: string;
  children?: { name: string };
}

interface Props {
  exercice: Exercise;
  onClose: () => void;
  onSaved?: () => void;
}

export function ModalMarkAttendance({ exercice, onClose, onSaved }: Props) {
  const api = useApi();
  const [children, setChildren] = useState<EnrolledChild[]>([]);
  const [absences, setAbsences] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const result = await api.attendance.checkAttendance(exercice.id, today);
        const absMap: Record<string, string> = {};
        if (result && result.length > 0) {
          setExisting(result);
          result.forEach((a: any) => {
            absMap[a.child_id] = a.type;
          });
        }
        setAbsences(absMap);

        // Load enrolled children
        const data: EnrolledChild[] = await api.attendance.getExerciseChildren(exercice.id);
        setChildren(data);
      } catch (err: any) {
        console.error("Failed to load data:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [exercice.id]);

  function toggleAbsence(childId: string, type: string) {
    setAbsences(prev => {
      const next = { ...prev };
      if (next[childId] === type) {
        delete next[childId];
      } else {
        next[childId] = type;
      }
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const date = new Date().toISOString().split('T')[0];
      const absencesList = Object.entries(absences).map(([child_id, type]) => ({
        child_id,
        type,
      }));
      await api.attendance.markAttendance({
        exercise_id: exercice.id,
        date,
        absences: absencesList,
      });
      onSaved?.();
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Présence — ${exercice.name} (${exercice.day} ${exercice.start_time}–${exercice.end_time})`} onClose={onClose} wide>
      <div className="space-y-3">
        {loading ? (
          <div className="p-6 text-sm text-slate-500 text-center">Chargement...</div>
        ) : children.length === 0 ? (
          <div className="p-6 text-sm text-slate-500 text-center">Aucun enfant inscrit à cette activité.</div>
        ) : (
          <>
            <div className="flex gap-2 text-xs text-slate-500 px-1">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-emerald-500 inline-block" /> Présent</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-red-500 inline-block" /> Absent</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-amber-500 inline-block" /> Retard</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-blue-500 inline-block" /> Départ anticipé</span>
            </div>
            <div className="border border-slate-200 divide-y divide-slate-100">
              {children.map((c) => {
                const status = absences[c.child_id] || "present";
                const isPresent = !absences[c.child_id];
                return (
                  <div key={c.child_id} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm text-slate-800">{c.children?.name || "Inconnu"}</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => toggleAbsence(c.child_id, "absence")}
                        className={`px-2.5 py-1 text-xs border transition-colors ${status === "absence" ? "bg-red-500 text-white border-red-500" : "border-slate-200 text-slate-400 hover:border-red-300"}`}
                      >
                        Absent
                      </button>
                      <button
                        onClick={() => toggleAbsence(c.child_id, "retard")}
                        className={`px-2.5 py-1 text-xs border transition-colors ${status === "retard" ? "bg-amber-500 text-white border-amber-500" : "border-slate-200 text-slate-400 hover:border-amber-300"}`}
                      >
                        Retard
                      </button>
                      <button
                        onClick={() => toggleAbsence(c.child_id, "depart_anticipe")}
                        className={`px-2.5 py-1 text-xs border transition-colors ${status === "depart_anticipe" ? "bg-blue-500 text-white border-blue-500" : "border-slate-200 text-slate-400 hover:border-blue-300"}`}
                      >
                        Départ
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3 pt-2 border-t border-slate-100">
              <Btn onClick={handleSave} disabled={saving}>
                {saving ? "Enregistrement..." : <><Check size={13} /> Enregistrer</>}
              </Btn>
              <Btn variant="outline" onClick={onClose}>Annuler</Btn>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}