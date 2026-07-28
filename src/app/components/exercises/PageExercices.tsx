import { useState, useMemo, useEffect, useCallback } from "react";
import { Search, Plus, Filter, Eye, Edit2, Trash2, FolderPlus, Users, ChevronDown, ChevronRight } from "lucide-react";
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

export function PageExercices({ canCreate, canEdit, canViewPrice = true, openModal, setSelectedExercise, setSelectedGroup, onRefresh }: Props) {
  const api = useApi();
  const [q, setQ] = useState("");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"groupes" | "liste">("groupes");

  // Expanded state for the hierarchical view in Groupes mode
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set());
  // Members per course (lazy loaded)
  const [courseMembers, setCourseMembers] = useState<Record<string, ChildType[]>>({});
  const [loadingMembers, setLoadingMembers] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [data, groupsData] = await Promise.all([
        api.exercises.getAll(),
        api.groups.getAll(),
      ]);
      setExercises(data);
      setGroups(groupsData);
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

  const filteredGroups = useMemo(() => {
    if (!q) return groups;
    const lq = q.toLowerCase();
    return groups.filter(g => g.name.toLowerCase().includes(lq));
  }, [groups, q]);

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

  // Get courses for a group
  function getCoursesForGroup(groupId: string): Exercise[] {
    return exercises.filter(ex => ex.group_id === groupId);
  }

  // Toggle group expand
  function toggleGroupExpand(groupId: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
        // Collapse all courses under this group
        const courseIds = getCoursesForGroup(groupId).map(c => c.id);
        setExpandedCourses(prevCourses => {
          const cNext = new Set(prevCourses);
          courseIds.forEach(cid => cNext.delete(cid));
          return cNext;
        });
      } else {
        next.add(groupId);
      }
      return next;
    });
  }

  // Toggle course expand and load members
  async function toggleCourseExpand(courseId: string) {
    setExpandedCourses(prev => {
      const next = new Set(prev);
      if (next.has(courseId)) {
        next.delete(courseId);
      } else {
        next.add(courseId);
        if (!courseMembers[courseId]) {
          loadCourseMembers(courseId);
        }
      }
      return next;
    });
  }

  async function loadCourseMembers(courseId: string) {
    setLoadingMembers(prev => new Set(prev).add(courseId));
    try {
      const children: ChildType[] = await api.attendance.getExerciseChildren(courseId);
      setCourseMembers(prev => ({ ...prev, [courseId]: children }));
    } catch (err: any) {
      console.error("Failed to load members:", err);
      setCourseMembers(prev => ({ ...prev, [courseId]: [] }));
    } finally {
      setLoadingMembers(prev => {
        const next = new Set(prev);
        next.delete(courseId);
        return next;
      });
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
        <div className="bg-white border border-slate-200 divide-y divide-slate-200">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
            <div className="relative flex-1 max-w-xs">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher..." className={`${inputCls} pl-8`} />
            </div>
          </div>

          {filteredGroups.length === 0 ? (
            <div className="p-6 text-sm text-slate-500 text-center">Aucun groupe trouvé.</div>
          ) : (
            filteredGroups.map(group => {
              const isExpanded = expandedGroups.has(group.id);
              const groupCourses = getCoursesForGroup(group.id);
              let items: string[] = [];
              try {
                if (group.description) items = JSON.parse(group.description);
              } catch { items = []; }

              return (
                <div key={group.id}>
                  {/* Group row - clickable to expand */}
                  <div
                    onClick={() => toggleGroupExpand(group.id)}
                    className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {isExpanded ? <ChevronDown size={14} className="text-slate-400 shrink-0" /> : <ChevronRight size={14} className="text-slate-400 shrink-0" />}
                      <FolderPlus size={14} className="text-slate-400 shrink-0" />
                      <span className="text-sm font-semibold text-slate-900">{group.name}</span>
                      <span className="text-xs text-slate-400">({groupCourses.length} cours)</span>
                      {items.length > 0 && (
                        <span className="text-xs text-slate-400 ml-1">{items.join(" · ")}</span>
                      )}
                    </div>
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <button onClick={() => { setSelectedGroup?.(group); openModal("edit-group" as any); }}
                        className="p-1 text-slate-400 hover:text-pink-500 transition-colors" title="Modifier">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => handleDeleteGroup(group.id)}
                        className="p-1 text-slate-400 hover:text-red-500 transition-colors" title="Supprimer">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Expanded courses under this group */}
                  {isExpanded && (
                    <div className="bg-slate-50 border-t border-slate-100">
                      {groupCourses.length === 0 ? (
                        <div className="px-12 py-3 text-xs text-slate-400 italic">Aucun cours dans ce groupe</div>
                      ) : (
                        groupCourses.map(course => {
                          const isCourseExpanded = expandedCourses.has(course.id);
                          const members = courseMembers[course.id];
                          const isLoading = loadingMembers.has(course.id);

                          return (
                            <div key={course.id}>
                              {/* Course row */}
                              <div
                                onClick={() => toggleCourseExpand(course.id)}
                                className="flex items-center justify-between px-12 py-2.5 text-sm hover:bg-white transition-colors cursor-pointer border-b border-slate-100"
                              >
                                <div className="flex items-center gap-2">
                                  {isCourseExpanded ? <ChevronDown size={12} className="text-slate-400" /> : <ChevronRight size={12} className="text-slate-400" />}
                                  <span className="font-medium text-slate-800">{course.name}</span>
                                  <span className="text-xs text-slate-400">{course.day} · {course.start_time}–{course.end_time}</span>
                                  {course.trainers?.name && (
                                    <span className="text-xs text-slate-400">({course.trainers.name})</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {members && (
                                    <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                                      <Users size={11} /> {members.length}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Expanded members under this course */}
                              {isCourseExpanded && (
                                <div className="px-16 py-2 bg-white border-b border-slate-50">
                                  {isLoading ? (
                                    <p className="text-xs text-slate-400">Chargement des membres...</p>
                                  ) : !members || members.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic">Aucun membre inscrit</p>
                                  ) : (
                                    <div className="space-y-1">
                                      <p className="text-xs font-semibold text-slate-500 mb-1">
                                        Membres ({members.length})
                                      </p>
                                      {members.map(child => (
                                        <div key={child.id} className="flex items-center gap-2 text-xs text-slate-700">
                                          <div className="w-5 h-5 bg-pink-100 flex items-center justify-center text-pink-700 text-[10px] font-bold rounded-full">
                                            {child.name.charAt(0).toUpperCase()}
                                          </div>
                                          <span>{child.name}</span>
                                          <span className="text-slate-400">{child.age} ans</span>
                                          {child.client_type === "VIP" && (
                                            <span className="text-[10px] px-1 py-0.5 bg-amber-100 text-amber-700 font-medium">VIP</span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
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