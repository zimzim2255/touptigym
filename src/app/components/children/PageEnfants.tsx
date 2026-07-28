import { useState, useMemo, useEffect, useCallback } from "react";
import { Search, Plus, Filter, Eye, Edit2, Trash2, X, Cake } from "lucide-react";
import { PageWrap, Btn, Tag, inputCls, selectCls } from "../shared/Primitives";
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
  const [showFilters, setShowFilters] = useState(false);

  // Filter states
  const [filterGender, setFilterGender] = useState("");
  const [filterSchoolType, setFilterSchoolType] = useState("");
  const [filterClientType, setFilterClientType] = useState("");
  const [filterAgeMin, setFilterAgeMin] = useState("");
  const [filterAgeMax, setFilterAgeMax] = useState("");

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
    let filtered = children;

    // Text search
    if (q) {
      const lq = q.toLowerCase();
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(lq) ||
        (c.school && c.school.toLowerCase().includes(lq)) ||
        (c.address && c.address.toLowerCase().includes(lq))
      );
    }

    // Gender filter
    if (filterGender) {
      filtered = filtered.filter(c => c.gender === filterGender);
    }

    // School type filter
    if (filterSchoolType) {
      filtered = filtered.filter(c => c.school_type === filterSchoolType);
    }

    // Client type filter
    if (filterClientType) {
      filtered = filtered.filter(c => c.client_type === filterClientType);
    }

    // Age range filter
    if (filterAgeMin) {
      filtered = filtered.filter(c => c.age >= parseInt(filterAgeMin));
    }
    if (filterAgeMax) {
      filtered = filtered.filter(c => c.age <= parseInt(filterAgeMax));
    }

    return filtered;
  }, [children, q, filterGender, filterSchoolType, filterClientType, filterAgeMin, filterAgeMax]);

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  function clearFilters() {
    setFilterGender("");
    setFilterSchoolType("");
    setFilterClientType("");
    setFilterAgeMin("");
    setFilterAgeMax("");
  }

  const hasActiveFilters = filterGender || filterSchoolType || filterClientType || filterAgeMin || filterAgeMax;

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
          <Btn size="sm" variant="ghost" onClick={() => setShowFilters(!showFilters)}>
            <Filter size={12} /> Filtrer {hasActiveFilters && <span className="ml-1 w-2 h-2 bg-pink-500 rounded-full inline-block" />}
          </Btn>
          {hasActiveFilters && (
            <Btn size="sm" variant="ghost" onClick={clearFilters}>
              <X size={12} /> Effacer
            </Btn>
          )}
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">Sexe</p>
                <select className={selectCls} value={filterGender} onChange={e => setFilterGender(e.target.value)}>
                  <option value="">Tous</option>
                  <option value="Garçon">Garçon</option>
                  <option value="Fille">Fille</option>
                </select>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">Type École</p>
                <select className={selectCls} value={filterSchoolType} onChange={e => setFilterSchoolType(e.target.value)}>
                  <option value="">Tous</option>
                  <option value="Bilingue">Bilingue</option>
                  <option value="Mission">Mission</option>
                  <option value="Autre">Autre</option>
                </select>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">Client</p>
                <select className={selectCls} value={filterClientType} onChange={e => setFilterClientType(e.target.value)}>
                  <option value="">Tous</option>
                  <option value="Normal">Normal</option>
                  <option value="VIP">VIP</option>
                </select>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">Âge min</p>
                <input type="number" className={`${inputCls} w-20`} value={filterAgeMin} onChange={e => setFilterAgeMin(e.target.value)} placeholder="0" min="0" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">Âge max</p>
                <input type="number" className={`${inputCls} w-20`} value={filterAgeMax} onChange={e => setFilterAgeMax(e.target.value)} placeholder="99" min="0" />
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="p-6 text-sm text-slate-500 text-center">Chargement...</div>
        ) : list.length === 0 ? (
          <div className="p-6 text-sm text-slate-500 text-center">Aucun enfant trouvé.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {["Nom", "Âge", "Sexe", "Date anniversaire", "École", "Type École", "Client", "Statut", ""].map(h => (
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
                  <td className="px-4 py-3 text-slate-500">
                    <span className="flex items-center gap-1">
                      <Cake size={12} className="text-pink-400" />
                      {formatDate(c.birth_date)}
                    </span>
                  </td>
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