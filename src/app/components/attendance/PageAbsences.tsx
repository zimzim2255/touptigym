import { useState, useEffect, useMemo, useCallback } from "react";
import { Filter, Check, X } from "lucide-react";
import { PageWrap, Tag, inputCls, selectCls, Btn, Field, Modal } from "../shared/Primitives";
import { useApi } from "../../../hooks/useSupabase";

interface Absence {
  id: string;
  child_id: string;
  exercise_id: string;
  date: string;
  type: string;
  justified: boolean;
  justification: string | null;
  created_at: string;
  children?: { name: string };
  exercises?: { name: string };
}

interface Props {
  openModal: (m: any) => void;
  setSelectedAbsence: (a: Absence) => void;
}

export function PageAbsences({ openModal, setSelectedAbsence }: Props) {
  const api = useApi();
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data: Absence[] = await api.attendance.getAbsences();
      setAbsences(data);
    } catch (err: any) {
      console.error("Failed to load absences:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const list = useMemo(() => {
    if (!filterType) return absences;
    return absences.filter(a => a.type === filterType);
  }, [absences, filterType]);

  return (
    <PageWrap title="Présences & Absences" sub="Historique des présences">
      <div className="flex gap-2 flex-wrap">
        <select
          className={`${selectCls} text-xs max-w-32`}
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
        >
          <option value="">Tous les types</option>
          <option value="absence">Absence</option>
          <option value="retard">Retard</option>
          <option value="depart_anticipe">Départ anticipé</option>
        </select>
      </div>

      {loading ? (
        <div className="p-6 text-sm text-slate-500 text-center">Chargement...</div>
      ) : list.length === 0 ? (
        <div className="p-6 text-sm text-slate-500 text-center">Aucune absence trouvée.</div>
      ) : (
        <div className="bg-white border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {["Enfant", "Date", "Exercice", "Type", "Justifié", ""].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map(a => (
                <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">{a.children?.name || "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{a.date}</td>
                  <td className="px-4 py-3 text-slate-500">{a.exercises?.name || "—"}</td>
                  <td className="px-4 py-3">
                    <Tag color={a.type === "absence" ? "red" : a.type === "retard" ? "amber" : "blue"}>
                      {a.type.replace("_", " ")}
                    </Tag>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {a.justified ? (
                        <Check size={13} className="text-emerald-500" />
                      ) : (
                        <X size={13} className="text-red-400" />
                      )}
                      {a.justified && a.justification && (
                        <span className="text-xs text-slate-400 truncate max-w-24">{a.justification}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {!a.justified && (
                      <button
                        onClick={() => { setSelectedAbsence(a); openModal("justify-absence"); }}
                        className="text-xs text-orange-600 hover:underline"
                      >
                        Justifier
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageWrap>
  );
}