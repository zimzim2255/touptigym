import { useState, useEffect, useMemo, useCallback } from "react";
import { CalendarCheck } from "lucide-react";
import { PageWrap, Btn, Tag, inputCls } from "../shared/Primitives";
import { useApi } from "../../../hooks/useSupabase";

interface Exercise {
  id: string;
  name: string;
  day: string;
  type: string;
  start_time: string;
  end_time: string;
  coach_id: string;
  price: number;
  created_at: string;
  trainers?: { name: string };
}

interface Props {
  openModal: (m: any) => void;
  setSelectedEx: (e: { id: string; name: string; day: string; start_time: string; end_time: string }) => void;
}

const DAY_NAMES = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

export function PageTrainerToday({ openModal, setSelectedEx }: Props) {
  const api = useApi();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data: Exercise[] = await api.exercises.getAll();
      setExercises(data);
    } catch (err: any) {
      console.error("Failed to load exercises:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const todayName = DAY_NAMES[new Date().getDay()];
  const today = useMemo(() => exercises.filter(e => e.day === todayName), [exercises, todayName]);
  const upcoming = useMemo(() => exercises.filter(e => e.day !== todayName), [exercises, todayName]);

  const dateStr = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const formattedDate = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

  return (
    <PageWrap title="Exercices du Jour" sub={formattedDate}>
      {loading ? (
        <div className="p-6 text-sm text-slate-500 text-center">Chargement des exercices...</div>
      ) : today.length === 0 ? (
        <div className="p-6 text-sm text-slate-500 text-center">Aucun exercice programmé aujourd'hui.</div>
      ) : (
        <div className="divide-y divide-slate-200 border border-slate-200 bg-white">
          {today.map(ex => (
            <div key={ex.id} className="px-5 py-4 flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-slate-900">{ex.name}</p>
                <p className="text-sm text-slate-500 mt-0.5">
                  Coach : {ex.trainers?.name || "—"} · {ex.start_time}–{ex.end_time}
                </p>
              </div>
              <Btn size="sm" onClick={() => {
                setSelectedEx({ id: ex.id, name: ex.name, day: ex.day, start_time: ex.start_time, end_time: ex.end_time });
                openModal("mark-attendance");
              }}>
                <CalendarCheck size={13} /> Marquer la présence
              </Btn>
            </div>
          ))}
        </div>
      )}

      {upcoming.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Autres exercices</p>
          <div className="divide-y divide-slate-200 border border-slate-200 bg-white">
            {upcoming.map(ex => (
              <div key={ex.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-700">{ex.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{ex.day} · {ex.start_time}–{ex.end_time}</p>
                </div>
                <Tag>{ex.type}</Tag>
              </div>
            ))}
          </div>
        </div>
      )}
    </PageWrap>
  );
}