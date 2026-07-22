import { useState, useMemo, useEffect, useCallback } from "react";
import { Search, Plus, Filter, Eye, Edit2, Trash2 } from "lucide-react";
import { PageWrap, Btn, inputCls } from "../shared/Primitives";
import { useApi } from "../../../hooks/useSupabase";
import { ModalType, Parent, Child } from "../../types";

interface Props {
  canEdit?: boolean;
  openModal: (m: ModalType) => void;
  setSelectedParent: (p: { id: string; name: string; editMode?: boolean }) => void;
  onRefresh?: number;
}

export function PageParents({ canEdit, openModal, setSelectedParent, onRefresh }: Props) {
  const api = useApi();
  const [q, setQ] = useState("");
  const [parents, setParents] = useState<Parent[]>([]);
  const [childrenMap, setChildrenMap] = useState<Record<string, Child[]>>({});
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState(0);

  const loadChildrenForParents = useCallback(async (parentsData: Parent[]) => {
    try {
      const allChildren: Child[] = await api.children.getAll();
      const map: Record<string, Child[]> = {};
      
      for (const p of parentsData) {
        try {
          const detail = await api.parents.getById(p.id);
          const linkedIds = (detail.parent_children || []).map((pc: any) => pc.child_id);
          map[p.id] = allChildren.filter(c => linkedIds.includes(c.id));
        } catch {
          map[p.id] = [];
        }
      }
      setChildrenMap(map);
    } catch (err) {
      console.error("Failed to load children:", err);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data: Parent[] = await api.parents.getAll();
      setParents(data);
      setCount(data.length);
      await loadChildrenForParents(data);
    } catch (err: any) {
      console.error("Failed to load parents:", err);
    } finally {
      setLoading(false);
    }
  }, [loadChildrenForParents]);

  useEffect(() => { refresh(); }, [refresh, onRefresh]);

  const list = useMemo(() => {
    if (!q) return parents;
    return parents.filter(p => 
      p.name.toLowerCase().includes(q.toLowerCase()) || 
      p.phone.includes(q)
    );
  }, [parents, q]);

  return (
    <PageWrap
      title="Gestion des Parents"
      sub={`${count} parents enregistrés`}
      action={canEdit && <Btn onClick={() => openModal("add-parent")}><Plus size={13} /> Ajouter</Btn>}
    >
      <div className="bg-white border border-slate-200">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher par nom, téléphone..." className={`${inputCls} pl-8`} />
          </div>
          <Btn size="sm" variant="ghost"><Filter size={12} /> Filtrer</Btn>
        </div>
        {loading ? (
          <div className="p-6 text-sm text-slate-500 text-center">Chargement...</div>
        ) : list.length === 0 ? (
          <div className="p-6 text-sm text-slate-500 text-center">Aucun parent trouvé.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {["Nom", "Téléphone", "Email", "CIN", "Enfants", ""].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map(p => {
                const pChildren = childrenMap[p.id] || [];
                return (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900">{p.name}</td>
                    <td className="px-4 py-3 text-slate-500">{p.phone}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{p.email || "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.id_card || "—"}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {pChildren.length > 0 
                        ? pChildren.map(c => c.name).join(", ")
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => { setSelectedParent({ id: p.id, name: p.name }); openModal("parent-detail"); }}
                          className="p-1 text-slate-400 hover:text-orange-500 transition-colors"><Eye size={13} /></button>
                        {canEdit && <>
                          <button onClick={() => { setSelectedParent({ id: p.id, name: p.name, editMode: true }); openModal("parent-detail"); }}
                            className="p-1 text-slate-400 hover:text-slate-700 transition-colors"><Edit2 size={13} /></button>
                          <button onClick={async () => {
                            if (confirm("Supprimer ce parent ?")) {
                              try {
                                await api.parents.remove(p.id);
                                refresh();
                              } catch (err: any) {
                                alert(err.message);
                              }
                            }
                          }} className="p-1 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
                        </>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </PageWrap>
  );
}