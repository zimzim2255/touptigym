import { useState, useMemo, useEffect } from "react";
import { CalendarCheck, Clock, HelpCircle } from "lucide-react";
import { PageWrap, Btn, Tag } from "../shared/Primitives";
import { useApi } from "../../../hooks/useSupabase";

const DAY_NAMES = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

interface Exercise {
  id: string;
  name: string;
  day: string;
  start_time: string;
  end_time: string;
  coach_id: string;
  type: string;
  created_at: string;
  trainers?: { name: string };
}

interface Props {
  openModal: (m: any) => void;
  setSelectedEx: (e: { id: string; name: string; day: string; start_time: string; end_time: string }) => void;
}

export function PageTrainerToday({ openModal, setSelectedEx }: Props) {
  const api = useApi();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data: Exercise[] = await api.exercises.getAll();
        setExercises(data);
      } catch (err: any) {
        console.error("Failed to load exercises:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const todayName = DAY_NAMES[new Date().getDay()];
  const today = useMemo(() => exercises.filter(e => e.day === todayName), [exercises, todayName]);
  const upcoming = useMemo(() => exercises.filter(e => e.day !== todayName), [exercises, todayName]);

  const formattedDate = new Date().toLocaleDateString("fr-FR", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  function handleMarkAttendance(ex: Exercise) {
    setSelectedEx({ id: ex.id, name: ex.name, day: ex.day, start_time: ex.start_time, end_time: ex.end_time });
    openModal("mark-attendance");
  }

  return (
    <PageWrap title="Activités du Jour" sub={formattedDate}>
      {loading ? (
        <div className="p-6 text-sm text-slate-500 text-center">Chargement des activités...</div>
      ) : today.length === 0 ? (
        <div className="p-6 text-sm text-slate-500 text-center">Aucune activité programmée aujourd'hui.</div>
      ) : (
        <div>
          <div className="space-y-2">
            {today.map(ex => (
              <div key={ex.id} className="bg-white border border-slate-200 px-4 py-3 flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm min-w-[90px]">
                  <Clock size={14} className="text-slate-400" />
                  <span className="font-mono text-xs text-slate-600">{ex.start_time}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{ex.name}</p>
                  <p className="text-xs text-slate-400">{ex.trainers?.name || "—"}</p>
                </div>
                <Btn size="sm" onClick={() => handleMarkAttendance(ex)}>
                  <CalendarCheck size={12} /> Marquer
                </Btn>
              </div>
            ))}
          </div>

          {upcoming.length > 0 && (
            <div className="mt-8">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Autres activités</p>
              <div className="divide-y divide-slate-200 border border-slate-200 bg-white">
                {upcoming.map(ex => (
                  <div key={ex.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                    <Tag color="default">{ex.day}</Tag>
                    <span className="font-mono text-xs text-slate-500">{ex.start_time}</span>
                    <span className="text-slate-700">{ex.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </PageWrap>
  );
}