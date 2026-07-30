import { useState, useMemo, useEffect, useCallback } from "react";
import { Search, Plus, Filter, Eye, Edit2, Trash2, FolderPlus, Users, ArrowUpDown } from "lucide-react";
import { PageWrap, Btn, Tag, inputCls } from "../shared/Primitives";
import { useApi } from "../../../hooks/useSupabase";
import { ModalType, Group, Exercise, Child as ChildType } from "../../types";

interface Props {
  canCreate?: boolean;
  canEdit?: boolean;
  canViewPrice?: boolean;
  openModal: (m: ModalType) => void;
  setSelectedExercise: (e: { id: string; name: string }) => void;
  setSelectedGroup?: (g: any) => void;
  onRefresh?: number;
}

interface Trainer {
  id: string;
  name: string;
}

type SortField = "name" | "group" | "day" | "start_time" | "trainer";
type SortDir = "asc" | "desc";

export function PageExercices({ canCreate, canEdit, canViewPrice = true, openModal, setSelectedExercise, setSelectedGroup, onRefresh }: Props) {
  const api = useApi();
  const [q, setQ] = useState("");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"groupes" | "liste">("groupes");

  // Groupes view filters
  const [filterActivite, setFilterActivite] = useState("");
  const [filterGroupe, setFilterGroupe] = useState("");
  const [filterInstructeur, setFilterInstructeur] = useState("");
  const [filterJour, setFilterJour] = useState("");

  // Sort
  const [sortField, setSortField] = useState<SortField>("day");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Selection
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedExercise_2, setSelectedExercise_2] = useState<Exercise | null>(null);
  const [members, setMembers] = useState<ChildType[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [data, groupsData, trainersData] = await Promise.all([
        api.exercises.getAll(),
        api.groups.getAll(),
        api.trainers?.getAll() || Promise.resolve([]),
      ]);
      setExercises(data);
      setGroups(groupsData);
      if (trainersData) setTrainers(trainersData);
    } catch (err: any) {
      console.error("Failed to load:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh, onRefresh]);

  const filteredExercises = useMemo(() => {
    if (!q) return exercises;
    const lq = q.toLowerCase();
    return exercises.filter(ex =>
      ex.name.toLowerCase().includes(lq) ||
      ex.day.toLowerCase().includes(lq) ||
      ex.type.toLowerCase().includes(lq)
    );
  }, [exercises, q]);

  const allGroupItems = useMemo(() => {
    const items = new Set<string>();
    for (const g of groups) {
      try {
        if (g.description) {
          const parsed = JSON.parse(g.description);
          if (Array.isArray(parsed)) parsed.forEach((item: string) => items.add(item));
        }
      } catch { /* ignore */ }
    }
    return Array.from(items).sort();
  }, [groups]);

  const tableData = useMemo(() => {
    let list = [...exercises];
    if (filterActivite) list = list.filter(ex => ex.group_id === filterActivite);
    if (filterGroupe) list = list.filter(ex => ex.name === filterGroupe);
    if (filterInstructeur) list = list.filter(ex => ex.trainers?.name === filterInstructeur);
    if (filterJour) list = list.filter(ex => ex.day === filterJour);

    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") cmp = (a.groups?.name || "").localeCompare(b.groups?.name || "");
      else if (sortField === "group") cmp = a.name.localeCompare(b.name);
      else if (sortField === "day") cmp = DAYS.indexOf(a.day) - DAYS.indexOf(b.day);
      else if (sortField === "start_time") cmp = a.start_time.localeCompare(b.start_time);
      else if (sortField === "trainer") cmp = (a.trainers?.name || "").localeCompare(b.trainers?.name || "");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [exercises, filterActivite, filterGroupe, filterInstructeur, filterJour, sortField, sortDir]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  function SortHeader({ field, label }: { field: SortField; label: string }) {
    return (
      <th
        onClick={() => toggleSort(field)}
        className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer hover:text-slate-800 transition-colors select-none"
      >
        <div className="flex items-center gap-1">
          {label}
          <ArrowUpDown size={11} className={`text-slate-300 ${sortField === field ? "text-pink-500" : ""}`} />
        </div>
      </th>
    );
  }

  function selectRow(ex: Exercise) {
    if (selectedId === ex.id) {
      setSelectedId(null);
      setSelectedExercise_2(null);
      setMembers([]);
      return;
    }
    setSelectedId(ex.id);
    setSelectedExercise_2(ex);
    setLoadingMembers(true);
    api.attendance.getExerciseChildren(ex.id)
      .then((children: ChildType[]) => {
        setMembers(children);
      })
      .catch((err: any) => {
        console.error("Failed to load members:", err);
        setMembers([]);
      })
      .finally(() => {
        setLoadingMembers(false);
      });
  }

  async function handleDeleteExercise(id: string) {
    if (!confirm("Supprimer cette activité ?")) return;
    try {
      await api.exercises.remove(id);
      refresh();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleDeleteGroup(id: string) {
    if (!confirm("Supprimer ce groupe ?")) return;
    try {
      await api.groups.remove(id);
      refresh();
    } catch (err: any) {
      alert(err.message);
    }
  }

  const DAY_ORDER: Record<string, number> = {
    Lundi: 1, Mardi: 2, Mercredi: 3, Jeudi: 4, Vendredi: 5, Samedi: 6, Dimanche: 7,
  };

  const sorted = useMemo(() =>
    [...filteredExercises].sort((a, b) => (DAY_ORDER[a.day] || 0) - (DAY_ORDER[b.day] || 0)),
    [filteredExercises, DAY_ORDER]
  );

  const headers = ["Activité", "Groupe", "Jour", "Horaire", "Coach", ""];

  return (
    <PageWrap
      title="Activités"
      sub="Gérez vos groupes et activités"
      action={
        <div className="flex gap-2">
          {canCreate && (
            <>
              <Btn variant="outline" onClick={() => openModal("add-group" as any)}>
                <FolderPlus size={13} /> Créer une activité / groupe
              </Btn>
              <Btn onClick={() => openModal("add-exercice")}>
                <Plus size={13} /> Créer un groupe
              </Btn>
            </>
          )}
        </div>
      }
    >
      {/* View toggle */}
      <div className="flex gap-1 mb-4">
        <button
          onClick={() => setViewMode("groupes")}
          className={`px-3 py-1.5 text-xs font-medium border transition-colors ${
            viewMode === "groupes"
              ? "border-pink-500 bg-pink-50 text-pink-700"
              : "border-slate-200 text-slate-500 hover:border-slate-400"
          }`}
        >
          Groupes
        </button>
        <button
          onClick={() => setViewMode("liste")}
          className={`px-3 py-1.5 text-xs font-medium border transition-colors ${
            viewMode === "liste"
              ? "border-pink-500 bg-pink-50 text-pink-700"
              : "border-slate-200 text-slate-500 hover:border-slate-400"
          }`}
        >
          Liste
        </button>
      </div>

      {loading ? (
        <div className="p-6 text-sm text-slate-500 text-center">Chargement...</div>
      ) : viewMode === "groupes" ? (
        <div className="bg-white border border-slate-200">
          {/* Schedule Filters */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 flex-wrap">
            <select value={filterActivite} onChange={e => setFilterActivite(e.target.value)} className={`${inputCls} text-xs w-36`}>
              <option value="">Activité</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <select value={filterGroupe} onChange={e => setFilterGroupe(e.target.value)} className={`${inputCls} text-xs w-36`}>
              <option value="">Groupe</option>
              {allGroupItems.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
            <select value={filterInstructeur} onChange={e => setFilterInstructeur(e.target.value)} className={`${inputCls} text-xs w-36`}>
              <option value="">Instructeur</option>
              {trainers.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
            </select>
            <select value={filterJour} onChange={e => setFilterJour(e.target.value)} className={`${inputCls} text-xs w-32`}>
              <option value="">Jour</option>
              {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            {(filterActivite || filterGroupe || filterInstructeur || filterJour) && (
              <button onClick={() => { setFilterActivite(""); setFilterGroupe(""); setFilterInstructeur(""); setFilterJour(""); }}
                className="text-xs text-pink-600 hover:text-pink-800 font-medium">Réinitialiser</button>
            )}
          </div>

          {/* Master-Detail Layout */}
          <div className="flex">
            {/* Left: Training Sessions Table */}
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide w-12">#</th>
                    <SortHeader field="name" label="Activité" />
                    <SortHeader field="group" label="Groupe" />
                    <SortHeader field="day" label="Jour" />
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Horaire prévue</th>
                    <SortHeader field="trainer" label="Instructeur" />
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tableData.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-sm text-slate-500 text-center">Aucune activité trouvée.</td>
                    </tr>
                  ) : (
                    tableData.map((ex, i) => {
                      const isSelected = selectedId === ex.id;
                      return (
                        <tr
                          key={ex.id}
                          onClick={() => selectRow(ex)}
                          className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                            isSelected ? "bg-pink-50" : ""
                          }`}
                        >
                          <td className="px-4 py-3 text-xs text-slate-400 font-mono">{i + 1}</td>
                          <td className="px-4 py-3 font-medium text-slate-900">{ex.groups?.name || "—"}</td>
                          <td className="px-4 py-3 text-slate-600">{ex.name}</td>
                          <td className="px-4 py-3 text-slate-600">{ex.day}</td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-600">
                            <span className="text-slate-700 font-medium">{ex.start_time}</span>
                            <span className="text-slate-300 mx-1">→</span>
                            <span className="text-slate-700 font-medium">{ex.end_time}</span>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{ex.trainers?.name || "—"}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                              <button onClick={() => { setSelectedExercise({ id: ex.id, name: ex.name }); openModal("exercice-detail"); }}
                                className="p-1 text-slate-400 hover:text-pink-500 transition-colors" title="Voir"><Eye size={13} /></button>
                              {canEdit && <>
                                <button onClick={() => { setSelectedExercise({ id: ex.id, name: ex.name }); openModal("exercice-detail"); }}
                                  className="p-1 text-slate-400 hover:text-slate-700 transition-colors" title="Modifier"><Edit2 size={13} /></button>
                                <button onClick={() => handleDeleteExercise(ex.id)}
                                  className="p-1 text-slate-400 hover:text-red-500 transition-colors" title="Supprimer"><Trash2 size={13} /></button>
                              </>}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Right: Assigned Members Table */}
            <div className={`w-80 shrink-0 border-l border-slate-200 overflow-x-auto ${selectedId ? "" : "hidden"}`}>
              <div className="p-3 border-b border-slate-200 bg-slate-50">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Membres inscrits <span className="text-pink-500 font-bold">{loadingMembers ? "..." : `(${members.length})`}</span>
                </p>
                {selectedExercise_2 && (
                  <p className="text-[10px] text-slate-400 mt-0.5">{selectedExercise_2.groups?.name} — {selectedExercise_2.name}</p>
                )}
              </div>
              {loadingMembers ? (
                <div className="p-6 text-xs text-slate-400 text-center">Chargement...</div>
              ) : members.length === 0 ? (
                <div className="p-6 text-xs text-slate-400 text-center italic">Aucun membre inscrit</div>
              ) : (
                <div className="max-h-[400px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50">
                        <th className="text-left px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase">Prénom</th>
                        <th className="text-left px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase">Nom</th>
                        <th className="text-left px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {members.map((child: ChildType) => {
                        const nameParts = child.name.split(" ");
                        const first = nameParts[0] || "";
                        const last = nameParts.slice(1).join(" ") || "—";
                        return (
                          <tr key={child.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-3 py-2 text-xs text-slate-700 font-medium">{first}</td>
                            <td className="px-3 py-2 text-xs text-slate-700">{last}</td>
                            <td className="px-3 py-2">
                              {child.client_type === "VIP" ? (
                                <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 font-medium">VIP</span>
                              ) : (
                                <span className="text-[10px] text-slate-400">Standard</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
            <div className="relative flex-1 max-w-xs">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher par nom, jour, type..." className={`${inputCls} pl-8`} />
            </div>
            <Btn size="sm" variant="ghost"><Filter size={12} /> Filtrer</Btn>
          </div>
          {sorted.length === 0 ? (
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
                    <td className="px-4 py-3 font-medium text-slate-900">{ex.groups?.name || ex.name}</td>
                    <td className="px-4 py-3 text-slate-500">{ex.name}</td>
                    <td className="px-4 py-3 text-slate-500">{ex.day}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{ex.start_time}–{ex.end_time}</td>
                    <td className="px-4 py-3 text-slate-500">{ex.trainers?.name || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => { setSelectedExercise({ id: ex.id, name: ex.name }); openModal("exercice-detail"); }}
                          className="p-1 text-slate-400 hover:text-pink-500 transition-colors"><Eye size={13} /></button>
                        {canEdit && <>
                          <button onClick={() => { setSelectedExercise({ id: ex.id, name: ex.name }); openModal("exercice-detail"); }}
                            className="p-1 text-slate-400 hover:text-slate-700 transition-colors"><Edit2 size={13} /></button>
                          <button onClick={() => handleDeleteExercise(ex.id)}
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
      )}
    </PageWrap>
  );
}