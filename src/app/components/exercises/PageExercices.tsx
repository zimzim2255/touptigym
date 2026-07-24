import { useState, useMemo, useEffect, useCallback } from "react";
import { Search, Plus, Filter, Eye, Edit2, Trash2, CalendarCheck } from "lucide-react";
import { PageWrap, Btn, Tag, inputCls } from "../shared/Primitives";
import { useApi } from "../../../hooks/useSupabase";
import { ModalType } from "../../types";

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
  canCreate?: boolean;
  canEdit?: boolean;
  canViewPrice?: boolean;
  openModal: (m: ModalType) => void;
  setSelectedExercise: (e: { id: string; name: string }) => void;
  onRefresh?: number;
}

export function PageExercices({ canCreate, canEdit, canViewPrice = true, openModal, setSelectedExercise, onRefresh }: Props) {
  const api = useApi();
  const [q, setQ] = useState("");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data: Exercise[] = await api.exercises.getAll();
      setExercises(data);
      setCount(data.length);
    } catch (err: any) {
      console.error("Failed to load exercises:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh, onRefresh]);

  const list = useMemo(() => {
    if (!q) return exercises;
    const lq = q.toLowerCase();
    return exercises.filter(ex =>
      ex.name.toLowerCase().includes(lq) ||
      ex.day.toLowerCase().includes(lq) ||
      ex.type.toLowerCase().includes(lq)
    );
  }, [exercises, q]);

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cette activité ?")) return;
    try {
      await api.exercises.remove(id);
      refresh();
    } catch (err: any) {
      alert(err.message);
    }
  }

  const DAY_ORDER: Record<string, number> = {
    Lundi: 1, Mardi: 2, Mercredi: 3, Jeudi: 4, Vendredi: 5, Samedi: 6, Dimanche: 7,
  };

  const sorted = useMemo(() =>
    [...list].sort((a, b) => (DAY_ORDER[a.day] || 0) - (DAY_ORDER[b.day] || 0)),
    [list, DAY_ORDER]
  );

  const headers = canViewPrice
    ? ["Nom", "Jour", "Horaire", "Type", "Coach", "Prix", ""]
    : ["Nom", "Jour", "Horaire", "Type", "Coach", ""];

  return (
    <PageWrap
      title="Activités"
      sub={`${count} activités programmées`}
      action={canCreate && <Btn onClick={() => openModal("add-exercice")}><Plus size={13} /> Créer une activité</Btn>}
    >
      <div className="bg-white border border-slate-200">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher par nom, jour, type..." className={`${inputCls} pl-8`} />
          </div>
          <Btn size="sm" variant="ghost"><Filter size={12} /> Filtrer</Btn>
        </div>
        {loading ? (
          <div className="p-6 text-sm text-slate-500 text-center">Chargement...</div>
        ) : sorted.length === 0 ? (
          <div className="p-6 text-sm text-slate-500 text-center">Aucune activité trouvée.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {headers.map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.map(ex => (
                <tr key={ex.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">{ex.name}</td>
                  <td className="px-4 py-3 text-slate-500">{ex.day}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{ex.start_time}–{ex.end_time}</td>
                  <td className="px-4 py-3">
                    <Tag color={ex.type === "Football" ? "green" : ex.type === "Basketball" ? "default" : ex.type === "Swimming" ? "blue" : "gray"}>{ex.type}</Tag>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{ex.trainers?.name || "—"}</td>
                  {canViewPrice && (
                    <td className="px-4 py-3 text-slate-500">{ex.price || 0} Dhs</td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => { setSelectedExercise({ id: ex.id, name: ex.name }); openModal("exercice-detail"); }}
                        className="p-1 text-slate-400 hover:text-pink-500 transition-colors"><Eye size={13} /></button>
                      {canEdit && <>
                        <button onClick={() => { setSelectedExercise({ id: ex.id, name: ex.name }); openModal("exercice-detail"); }}
                          className="p-1 text-slate-400 hover:text-slate-700 transition-colors"><Edit2 size={13} /></button>
                        <button onClick={() => handleDelete(ex.id)}
                          className="p-1 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
                      </>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </PageWrap>
  );
}