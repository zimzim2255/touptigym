import { useState, useMemo, useEffect, useCallback } from "react";
import { Search, Plus, Filter, Eye, Edit2, Trash2 } from "lucide-react";
import { PageWrap, Btn, Tag, inputCls, Pagination } from "../shared/Primitives";
import { useApi } from "../../../hooks/useSupabase";
import { ModalType } from "../../types";

interface Trainer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  id_card: string | null;
  specialty: string | null;
  created_at: string;
}

interface Props {
  canEdit?: boolean;
  openModal: (m: ModalType) => void;
  setSelectedTrainer: (t: { id: string; name: string }) => void;
  onRefresh?: number;
}

export function PageEntraineurs({ canEdit, openModal, setSelectedTrainer, onRefresh }: Props) {
  const api = useApi();
  const [q, setQ] = useState("");
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data: Trainer[] = await api.trainers.getAll();
      setTrainers(data);
      setCount(data.length);
    } catch (err: any) {
      console.error("Failed to load trainers:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh, onRefresh]);

  const list = useMemo(() => {
    if (!q) return trainers;
    const lq = q.toLowerCase();
    return trainers.filter(t =>
      t.name.toLowerCase().includes(lq) ||
      (t.specialty || "").toLowerCase().includes(lq) ||
      (t.email || "").toLowerCase().includes(lq)
    );
  }, [trainers, q]);

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return list.slice(start, start + PAGE_SIZE);
  }, [list, page]);

  useEffect(() => { setPage(1); }, [q]);

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cet entraîneur ?")) return;
    try {
      await api.trainers.remove(id);
      refresh();
    } catch (err: any) {
      alert(err.message);
    }
  }

  return (
    <PageWrap
      title="Entraîneurs"
      sub={`${count} entraîneurs`}
      action={canEdit && <Btn onClick={() => openModal("add-trainer")}><Plus size={13} /> Ajouter</Btn>}
    >
      <div className="bg-white border border-slate-200">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher par nom, spécialité..." className={`${inputCls} pl-8`} />
          </div>
          <Btn size="sm" variant="ghost"><Filter size={12} /> Filtrer</Btn>
        </div>
        {loading ? (
          <div className="p-6 text-sm text-slate-500 text-center">Chargement...</div>
        ) : list.length === 0 ? (
          <div className="p-6 text-sm text-slate-500 text-center">Aucun entraîneur trouvé.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {["Nom", "Spécialité", "Téléphone", "Email", ""].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginated.map(t => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">{t.name}</td>
                  <td className="px-4 py-3 text-slate-500">{t.specialty || "—"}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{t.phone || "—"}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{t.email || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => { setSelectedTrainer({ id: t.id, name: t.name }); openModal("trainer-detail"); }}
                        className="p-1 text-slate-400 hover:text-orange-500 transition-colors"><Eye size={13} /></button>
                      {canEdit && <>
                        <button onClick={() => { setSelectedTrainer({ id: t.id, name: t.name }); openModal("trainer-detail"); }}
                          className="p-1 text-slate-400 hover:text-slate-700 transition-colors"><Edit2 size={13} /></button>
                        <button onClick={() => handleDelete(t.id)}
                          className="p-1 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
                      </>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && list.length > 0 && (
          <Pagination total={list.length} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
        )}
      </div>
    </PageWrap>
  );
}
