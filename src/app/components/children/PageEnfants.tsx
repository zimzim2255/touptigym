import { useState, useMemo, useEffect, useCallback } from "react";
import { Search, Plus, Filter, Eye, Edit2, Trash2 } from "lucide-react";
import { PageWrap, Btn, Tag, inputCls } from "../shared/Primitives";
import { useApi } from "../../../hooks/useSupabase";
import { ModalType, Child } from "../../types";

interface Props {
  canEdit?: boolean;
  openModal: (m: ModalType) => void;
  setSelectedChild: (c: { id: string; name: string }) => void;
  onRefresh?: number; // triggers re-fetch
}

export function PageEnfants({ canEdit, openModal, setSelectedChild, onRefresh }: Props) {
  const api = useApi();
  const [q, setQ] = useState("");
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data: Child[] = await api.children.getAll(q || undefined);
      setChildren(data);
      setCount(data.length);
    } catch (err: any) {
      console.error("Failed to load children:", err);
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => { refresh(); }, [refresh, onRefresh]);

  const list = useMemo(() => {
    if (!q) return children;
    return children.filter(c => c.name.toLowerCase().includes(q.toLowerCase()));
  }, [children, q]);

  return (
    <PageWrap
      title="Gestion des Enfants"
      sub={`${count} enfants inscrits`}
      action={canEdit && <Btn onClick={() => openModal("add-child")}><Plus size={13} /> Ajouter</Btn>}
    >
      <div className="bg-white border border-slate-200">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher par nom ou école..." className={`${inputCls} pl-8`} />
          </div>
          <Btn size="sm" variant="ghost"><Filter size={12} /> Filtrer</Btn>
        </div>
        {loading ? (
          <div className="p-6 text-sm text-slate-500 text-center">Chargement...</div>
        ) : list.length === 0 ? (
          <div className="p-6 text-sm text-slate-500 text-center">Aucun enfant trouvé.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {["Nom", "Âge", "Sexe", "École", "Type École", "Client", "Statut", ""].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map(c => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                  <td className="px-4 py-3 text-slate-500">{c.age} ans</td>
                  <td className="px-4 py-3 text-slate-500">{c.gender === "Garçon" ? "G" : "F"}</td>
                  <td className="px-4 py-3 text-slate-500">{c.school || "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{c.school_type || "—"}</td>
                  <td className="px-4 py-3"><Tag color={c.client_type === "VIP" ? "default" : "gray"}>{c.client_type}</Tag></td>
                  <td className="px-4 py-3"><Tag color="green">Actif</Tag></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => { setSelectedChild({ id: c.id, name: c.name }); openModal("child-detail"); }}
                        className="p-1 text-slate-400 hover:text-orange-500 transition-colors"><Eye size={13} /></button>
                      {canEdit && <>
                        <button className="p-1 text-slate-400 hover:text-slate-700 transition-colors"><Edit2 size={13} /></button>
                        <button className="p-1 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
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