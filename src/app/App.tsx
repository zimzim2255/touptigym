import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { ModalAddChild, ModalChildDetail, PageEnfants } from "./components/children";
import { ModalAddParent, ModalParentDetail, PageParents } from "./components/parents";
import { ModalAddSubscription, ModalSubscriptionDetail, PageAbonnements } from "./components/subscriptions";
import { ModalAddExercice, ModalExerciceDetail, PageExercices, ModalAddGroup, ModalEditGroup } from "./components/exercises";
import { ModalAddTrainer, ModalTrainerDetail, PageEntraineurs } from "./components/trainers";
import { ModalAddCheck, ModalCheckDetail, PageChecks } from "./components/checks";
import { PagePaiements, ModalPayRest } from "./components/payments";
import { PageAbsences, PageTrainerToday, ModalMarkAttendance } from "./components/attendance";
import { Tag, Btn, Field, inputCls, selectCls, Modal, PageWrap } from "./components/shared";
import { useApi } from "../hooks/useSupabase";
import type { UrgentRequest, Child as ChildType, Exercise as ExerciseType, Check as CheckType } from "./types";
import {
  Baby, CreditCard, Dumbbell, Shield, AlertCircle, CalendarCheck,
  Banknote, Settings, LayoutDashboard, LogOut, Search, Plus, Check,
  X, Clock, Users, Fingerprint, Activity, TrendingUp, UserCheck,
  Bell, Filter, Eye, Edit2, Trash2, CheckCircle, XCircle, RefreshCw,
  ChevronRight, Menu, ArrowLeft, ChevronLeft,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell,
} from "recharts";

type Role = "admin" | "worker" | "trainer";
type ModalType =
  | null
  | "add-child" | "child-detail"
  | "add-parent" | "parent-detail"
  | "add-subscription" | "subscription-detail"
  | "add-check" | "check-detail"
  | "add-trainer" | "trainer-detail"
  | "justify-absence"
  | "add-request"
  | "mark-attendance"
  | "add-exercice" | "exercice-detail"
  | "add-group" | "edit-group";

type AbsenceItem = { id: string; enfant: string; exercice: string; date: string; type: string; justifie: boolean; justificatif: string };

// ─── Add Subscription Modal is imported from ./components/subscriptions ───────

// ─── Add Trainer Modal is imported from ./components/trainers ─────────────────

// ─── Justify Absence Modal ────────────────────────────────────────────────────
function ModalJustifyAbsence({ absence, onClose }: { absence: AbsenceItem; onClose: () => void }) {
  return (
    <Modal title="Justification d'Absence" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-700 font-medium">{absence.enfant} — {absence.exercice} — {absence.date}</p>
        <Field label="Type">
          <select className={selectCls} defaultValue={absence.type}>
            <option value="absence">Absence</option>
            <option value="retard">Retard</option>
            <option value="depart_anticipe">Départ anticipé</option>
          </select>
        </Field>
        <Field label="Motif">
          <textarea className={`${inputCls} h-24 resize-none`} placeholder="Description du motif..." defaultValue={absence.justificatif} />
        </Field>
        <Field label="Justificatif (optionnel)">
          <input type="file" className={inputCls} />
        </Field>
        <div className="flex gap-3 pt-2 border-t border-slate-100">
          <Btn><Check size={13} /> Justifier</Btn>
          <Btn variant="outline" onClick={onClose}>Annuler</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ─── Add Request Modal (connected to API) ─────────────────────────────────────
function ModalAddRequest({ onClose, onCreated }: { onClose: () => void; onCreated?: () => void }) {
  const api = useApi();
  const [childId, setChildId] = useState("");
  const [exerciseId, setExerciseId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [childrenList, setChildrenList] = useState<ChildType[]>([]);
  const [exercisesList, setExercisesList] = useState<ExerciseType[]>([]);
  const [searchEx, setSearchEx] = useState("");
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.children.getAll().then(setChildrenList).catch(() => {});
    api.exercises.getAll().then(setExercisesList).catch(() => {});
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredExercises = useMemo(() => {
    if (!searchEx) return exercisesList;
    return exercisesList.filter(e => e.name.toLowerCase().includes(searchEx.toLowerCase()));
  }, [exercisesList, searchEx]);

  const selectedExercise = exercisesList.find(e => e.id === exerciseId);

  const handleSubmit = async () => {
    if (!childId || !exerciseId || !date) return;
    setLoading(true);
    try {
      await api.requests.create({ child_id: childId, exercise_id: exerciseId, date, notes: notes || null });
      onCreated?.();
      onClose();
    } catch (err: any) {
      console.error("Failed to create request:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Créer une Demande Urgente" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Enfant">
          <select className={selectCls} value={childId} onChange={e => setChildId(e.target.value)}>
            <option value="">Sélectionner un enfant</option>
            {childrenList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Date">
          <input type="date" className={inputCls} value={date} onChange={e => setDate(e.target.value)} />
        </Field>
        <div className="border border-slate-200 p-3" ref={searchRef}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-500 uppercase">Activité</p>
          </div>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className={`${inputCls} pl-8`}
              placeholder="Rechercher des activités..."
              value={searchEx}
              onChange={e => { setSearchEx(e.target.value); setShowResults(true); }}
              onFocus={() => setShowResults(true)}
            />
          </div>
          {showResults && searchEx && (
            <div className="mt-1 border border-slate-200 divide-y divide-slate-100 max-h-40 overflow-y-auto">
              {filteredExercises.length === 0 ? (
                <div className="px-3 py-2 text-xs text-slate-400">Aucune activité trouvée</div>
              ) : (
                filteredExercises.map(e => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => { setExerciseId(e.id); setSearchEx(e.name); setShowResults(false); }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors ${exerciseId === e.id ? "bg-emerald-50 text-emerald-700" : "text-slate-600"}`}
                  >
                    <span className="font-medium">{e.name}</span>
                    <span className="text-slate-400 ml-2">{e.day} {e.start_time}–{e.end_time}</span>
                  </button>
                ))
              )}
            </div>
          )}
          {selectedExercise && !showResults && (
            <div className="mt-2 p-2 bg-emerald-50 text-xs text-emerald-700 flex items-center gap-1.5">
              <Check size={11} /> {selectedExercise.name} — {selectedExercise.day} {selectedExercise.start_time}–{selectedExercise.end_time}
            </div>
          )}
        </div>
        <Field label="Notes (optionnel)">
          <textarea className={`${inputCls} h-20 resize-none`} placeholder="Description de la demande..." value={notes} onChange={e => setNotes(e.target.value)} />
        </Field>
        <div className="flex gap-3 pt-2 border-t border-slate-100">
          <Btn onClick={handleSubmit} disabled={loading}>
            {loading ? "Envoi..." : "Envoyer"}
          </Btn>
          <Btn variant="outline" onClick={onClose}>Annuler</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ─── Page: Overview (with real data) ──────────────────────────────────────────
const ATTENDANCE_DATA = [
  { jour: "Lun", presents: 18, absents: 3 },
  { jour: "Mar", presents: 21, absents: 2 },
  { jour: "Mer", presents: 15, absents: 4 },
  { jour: "Jeu", presents: 20, absents: 1 },
  { jour: "Ven", presents: 24, absents: 2 },
  { jour: "Sam", presents: 19, absents: 5 },
];
const REVENUE_DATA = [
  { mois: "Jan", montant: 42000 },
  { mois: "Fév", montant: 38000 },
  { mois: "Mar", montant: 55000 },
  { mois: "Avr", montant: 61000 },
  { mois: "Mai", montant: 48000 },
  { mois: "Jun", montant: 70000 },
  { mois: "Jul", montant: 65000 },
];
const SPORT_PIE = [
  { name: "Football", value: 38 },
  { name: "Gym", value: 22 },
  { name: "Basketball", value: 25 },
  { name: "Natation", value: 15 },
];
const PIE_COLORS = ["#D75077", "#92CC8D", "#3b82f6", "#8b5cf6"];

function PageOverview({ openModal }: { openModal: (m: ModalType) => void }) {
  const api = useApi();
  const [requests, setRequests] = useState<UrgentRequest[]>([]);

  useEffect(() => {
    api.requests.getAll()
      .then((data: UrgentRequest[]) => setRequests(data.slice(0, 5)))
      .catch(() => {});
  }, []);

  return (
    <PageWrap title="Tableau de Bord" sub="Mardi 22 Juillet 2026">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-200">
        {[
          { label: "Enfants actifs", value: "47", sub: "+3 ce mois", icon: Baby },
          { label: "Abonnements", value: "43", sub: "4 en attente", icon: CreditCard },
          { label: "Présents aujourd'hui", value: "31", sub: "sur 36 prévus", icon: UserCheck },
          { label: "Recettes (Jul)", value: "65 000 Dhs", sub: "↑12% vs juin", icon: Banknote },
        ].map((s, i) => (
          <div key={i} className="bg-white p-5 flex items-start gap-3">
            <s.icon size={18} className="text-pink-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{s.label}</p>
              <p className="text-2xl font-bold text-slate-900 mt-1" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{s.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white border border-slate-200 p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Présences cette semaine</p>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={ATTENDANCE_DATA} barSize={14} barGap={3}>
              <XAxis dataKey="jour" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", fontSize: 12 }} cursor={{ fill: "rgba(215,80,119,0.04)" }} />
              <Bar dataKey="presents" name="Présents" fill="#D75077" radius={0} />
              <Bar dataKey="absents" name="Absents" fill="#f5b7c9" radius={0} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-slate-200 p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Répartition par sport</p>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie data={SPORT_PIE} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value" paddingAngle={2}>
                {SPORT_PIE.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1 mt-2">
            {SPORT_PIE.map((d, i) => (
              <div key={d.name} className="flex justify-between text-xs">
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 inline-block" style={{ background: PIE_COLORS[i] }} /><span className="text-slate-500">{d.name}</span></div>
                <span className="font-medium text-slate-800">{d.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white border border-slate-200 p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Recettes mensuelles (Dhs)</p>
          <ResponsiveContainer width="100%" height={170}>
            <LineChart data={REVENUE_DATA}>
              <XAxis dataKey="mois" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", fontSize: 12 }} />
              <Line type="monotone" dataKey="montant" stroke="#D75077" strokeWidth={2} dot={{ fill: "#D75077", r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-slate-200 p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Demandes urgentes</p>
          <div className="divide-y divide-slate-100">
            {requests.length === 0 ? (
              <p className="py-2.5 text-xs text-slate-400">Aucune demande</p>
            ) : (
              requests.map(r => (
                <div key={r.id} className="py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-slate-800">{r.children?.name || "Inconnu"}</p>
                    <Tag color={r.status === "approuvée" ? "green" : r.status === "rejetée" ? "red" : "amber"}>{r.status}</Tag>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 leading-snug">{r.notes || "Aucune note"}</p>
                </div>
              ))
            )}
          </div>
          <button onClick={() => openModal("add-request")} className="mt-2 text-xs text-pink-600 hover:underline flex items-center gap-1"><Plus size={11} /> Nouvelle demande</button>
        </div>
      </div>
    </PageWrap>
  );
}

// ─── Page: Demandes Urgentes (connected to API) ───────────────────────────────
function PageDemandes({ canValidate, openModal, onRefresh }: {
  canValidate?: boolean;
  openModal: (m: ModalType) => void;
  onRefresh?: number;
}) {
  const api = useApi();
  const [requests, setRequests] = useState<UrgentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data: UrgentRequest[] = await api.requests.getAll();
      setRequests(data);
    } catch (err: any) {
      console.error("Failed to load requests:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, onRefresh]);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      await api.requests.approve(id);
      await load();
    } catch (err: any) {
      console.error("Failed to approve:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionLoading(id);
    try {
      await api.requests.reject(id);
      await load();
    } catch (err: any) {
      console.error("Failed to reject:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const pendingCount = requests.filter(r => r.status === "en_attente").length;

  return (
    <PageWrap
      title="Demandes Urgentes"
      sub={`${requests.length} demandes (${pendingCount} en attente)`}
      action={<Btn onClick={() => openModal("add-request")}><Plus size={13} /> Nouvelle demande</Btn>}
    >
      <div className="bg-white border border-slate-200">
        {loading ? (
          <div className="p-6 text-sm text-slate-500 text-center">Chargement...</div>
        ) : requests.length === 0 ? (
          <div className="p-6 text-sm text-slate-500 text-center">Aucune demande urgente.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {["Enfant", "Date", "Activité", "Demandeur", "Notes", "Statut", ...(canValidate ? ["Actions"] : [])].filter(Boolean).map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.map(r => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">{r.children?.name || "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{r.date}</td>
                  <td className="px-4 py-3 text-slate-500">{r.exercises?.name || "—"}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{r.users?.name || "—"}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs max-w-48 truncate">{r.notes || "—"}</td>
                  <td className="px-4 py-3">
                    <Tag color={r.status === "approuvée" ? "green" : r.status === "rejetée" ? "red" : "amber"}>
                      {r.status}
                    </Tag>
                  </td>
                  {canValidate && (
                    <td className="px-4 py-3">
                      {r.status === "en_attente" && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleApprove(r.id)}
                            disabled={actionLoading === r.id}
                            className="flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 text-xs border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                          >
                            <Check size={10} /> Approuver
                          </button>
                          <button
                            onClick={() => handleReject(r.id)}
                            disabled={actionLoading === r.id}
                            className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 text-xs border border-red-200 hover:bg-red-100 disabled:opacity-50 transition-colors"
                          >
                            <X size={10} /> Rejeter
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </PageWrap>
  );
}

// ─── Page: Accès ZKTeco (connected to API) ─────────────────────────────────────
function PageAcces() {
  const api = useApi();
  const [devices, setDevices] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ today_total: 0, total_devices: 0, today_unknown: 0, recent: [] });
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayStr, setTodayStr] = useState("");

  useEffect(() => {
    const now = new Date();
    setTodayStr(now.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [deviceData, statsData] = await Promise.all([
        api.zkteco.getDevices().catch(() => []),
        api.zkteco.getStats().catch(() => ({ today_total: 0, total_devices: 0, today_unknown: 0, recent: [] })),
      ]);
      setDevices(deviceData);
      setStats(statsData);
      setLogs(statsData.recent || []);
    } catch (err: any) {
      console.error("Failed to load ZKTeco data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = () => load();

  const formatTime = (isoStr: string) => {
    if (!isoStr) return "—";
    try {
      return new Date(isoStr).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return isoStr;
    }
  };

  const formatDate = (isoStr: string) => {
    if (!isoStr) return "—";
    try {
      return new Date(isoStr).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
    } catch {
      return isoStr;
    }
  };

  const mapStatusLabel = (status: string): string => {
    switch (status) {
      case "granted": return "autorisé";
      case "denied_no_subscription": return "refusé (abonnement)";
      case "denied_unknown_user": return "refusé (inconnu)";
      default: return status;
    }
  };

  const mapStatusColor = (status: string): "green" | "red" | "amber" => {
    if (status === "granted") return "green";
    if (status === "denied_unknown_user") return "amber";
    return "red";
  };

  const mapTypeLabel = (type: string): string => {
    switch (type) {
      case "entry": return "Entrée";
      case "exit": return "Sortie";
      case "unknown_pin": return "PIN inconnu";
      default: return type;
    }
  };

  const unknownCount = logs.filter(l => l.status === "denied_unknown_user").length;
  const deniedCount = logs.filter(l => l.status && l.status !== "granted").length;

  return (
    <PageWrap
      title="Contrôle d'Accès ZKTeco"
      sub={`SpeedFace-V5L — ${devices.length} appareil(s) enregistré(s)`}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-200">
        {devices.length > 0 ? devices.slice(0, 4).map((d: any) => (
          <div key={d.id} className="bg-white p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2 h-2 ${d.status === "online" ? "bg-emerald-500" : "bg-red-500"}`} />
              <span className={`text-xs font-semibold ${d.status === "online" ? "text-emerald-700" : "text-red-600"}`}>
                {d.status === "online" ? "En ligne" : "Hors ligne"}
              </span>
            </div>
            <p className="text-xs text-slate-500 truncate">{d.name || d.ip_address || "Appareil ZKTeco"}</p>
            {d.last_seen && (
              <p className="text-[10px] text-slate-400 mt-0.5">Dernier contact: {formatTime(d.last_seen)}</p>
            )}
          </div>
        )) : (
          <>
            <div className="bg-white p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 bg-slate-300" />
                <span className="text-xs font-semibold text-slate-400">En attente</span>
              </div>
              <p className="text-xs text-slate-400">Aucun appareil enregistré</p>
            </div>
            <div className="bg-white p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 bg-slate-300" />
                <span className="text-xs font-semibold text-slate-400">En attente</span>
              </div>
              <p className="text-xs text-slate-400">L'appareil s'enregistre automatiquement</p>
            </div>
          </>
        )}
        <div className="bg-white p-4 flex items-center gap-3">
          <Activity size={16} className="text-pink-500 shrink-0" />
          <div>
            <p className="text-xs text-slate-500 uppercase font-semibold tracking-wide">Passages aujourd'hui</p>
            <p className="text-xl font-bold text-slate-900" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{stats.today_total || 0}</p>
          </div>
        </div>
        <div className="bg-white p-4 flex items-center gap-3">
          <Shield size={16} className="text-pink-500 shrink-0" />
          <div>
            <p className="text-xs text-slate-500 uppercase font-semibold tracking-wide">Refus aujourd'hui</p>
            <p className="text-xl font-bold text-slate-900" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{deniedCount}</p>
          </div>
        </div>
      </div>

      {unknownCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 px-4 py-3">
          <p className="text-xs font-semibold text-amber-700 uppercase mb-2">Alertes — PIN inconnus</p>
          <div className="space-y-1">
            {logs.filter(l => l.status === "denied_unknown_user").slice(0, 5).map((log: any, i: number) => (
              <p key={i} className="text-sm text-amber-800">
                ⚠ {formatTime(log.event_time)} — Tentative avec PIN inconnu (ID: {log.raw_data?.pin || "?"})
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Logs d'accès — {todayStr ? `Aujourd'hui ${todayStr}` : "Temps réel"}
          </p>
          <button onClick={handleRefresh} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 transition-colors">
            <RefreshCw size={11} /> Actualiser
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {["Date/Heure", "Enfant", "Type", "Statut", "Appareil"].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-sm text-slate-400 text-center">Chargement des logs...</td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-sm text-slate-400 text-center">
                  Aucun log d'accès pour le moment. Configurez le PUSH SDK sur l'appareil.
                </td>
              </tr>
            ) : (
              logs.map((log: any, i: number) => (
                <tr key={log.id || i} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-slate-700 text-xs">
                    {formatDate(log.event_time)} {formatTime(log.event_time)}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {log.children?.name || `PIN #${log.raw_data?.pin || "?"}`}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{mapTypeLabel(log.event_type)}</td>
                  <td className="px-4 py-3">
                    <Tag color={mapStatusColor(log.status)}>{mapStatusLabel(log.status)}</Tag>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400 truncate max-w-32">
                    {log.device_id || "SpeedFace-V5L"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </PageWrap>
  );
}

// ─── Page: Tarifs ─────────────────────────────────────────────────────────────
function PageTarifs() {
  const rows = [
    { act: "1 activité", session: 3900, annuel: 6600 },
    { act: "2 activités", session: 6300, annuel: 10200 },
    { act: "3 activités", session: 8100, annuel: 13800 },
    { act: "4 activités", session: 9300, annuel: 16200 },
  ];
  const remises = [
    { nom: "2ème enfant", valeur: "−10%", actif: true },
    { nom: "3ème enfant", valeur: "−20%", actif: true },
    { nom: "Fidélité 2 ans", valeur: "−5%", actif: false },
    { nom: "Promotion été", valeur: "−15%", actif: false },
  ];
  return (
    <PageWrap title="Tarifs & Paramètres" sub="Grille tarifaire — éditable">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-slate-200">
          <div className="px-4 py-3 border-b border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tarifs d'abonnement</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Activités</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Session (24 sem)</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Annuel (48 sem)</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-slate-700">{r.act}</td>
                  <td className="px-4 py-2.5"><input className="w-24 px-2 py-1 border border-slate-200 text-sm text-slate-900 font-medium focus:outline-none focus:border-pink-400" defaultValue={r.session} /></td>
                  <td className="px-4 py-2.5"><input className="w-24 px-2 py-1 border border-slate-200 text-sm text-slate-900 font-medium focus:outline-none focus:border-pink-400" defaultValue={r.annuel} /></td>
                  <td className="px-4 py-2.5"><button className="text-pink-500 hover:text-pink-700 text-xs font-medium">Sauv.</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t border-slate-200 space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Frais supplémentaires</p>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-slate-600 w-44">Droit d'entrée</span>
              <input className="w-20 px-2 py-1 border border-slate-200 text-sm font-medium focus:outline-none focus:border-pink-400" defaultValue="700" />
              <span className="text-slate-400 text-xs">Dhs</span>
              <button className="text-pink-500 text-xs font-medium">Sauv.</button>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-slate-600 w-44">Assurance & Carte membre</span>
              <input className="w-20 px-2 py-1 border border-slate-200 text-sm font-medium focus:outline-none focus:border-pink-400" defaultValue="300" />
              <span className="text-slate-400 text-xs">Dhs</span>
              <button className="text-pink-500 text-xs font-medium">Sauv.</button>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Remises & Réductions</p>
            <Btn size="sm"><Plus size={11} /> Ajouter</Btn>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {["Libellé", "Valeur", "Statut", ""].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {remises.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-slate-700">{r.nom}</td>
                  <td className="px-4 py-2.5 font-semibold text-pink-600">{r.valeur}</td>
                  <td className="px-4 py-2.5"><Tag color={r.actif ? "green" : "gray"}>{r.actif ? "Actif" : "Inactif"}</Tag></td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1">
                      <button className="p-1 text-slate-400 hover:text-slate-700"><Edit2 size={12} /></button>
                      <button className="p-1 text-slate-400 hover:text-red-500"><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t border-slate-200 flex gap-3">
            <Btn><Check size={13} /> Tout sauvegarder</Btn>
            <Btn variant="outline">Annuler</Btn>
          </div>
        </div>
      </div>
    </PageWrap>
  );
}

// ─── Nav configs ──────────────────────────────────────────────────────────────
type NavItem = { id: string; label: string; icon: React.ElementType };

const ADMIN_NAV: NavItem[] = [
  { id: "overview", label: "Tableau de bord", icon: LayoutDashboard },
  { id: "enfants", label: "Enfants", icon: Baby },
  { id: "parents", label: "Parents", icon: Users },
  { id: "abonnements", label: "Abonnements", icon: CreditCard },
  { id: "exercices", label: "Activités/Groupe", icon: Dumbbell },
  { id: "entraineurs", label: "Entraîneurs", icon: UserCheck },
  { id: "absences", label: "Présences", icon: CalendarCheck },
  { id: "paiements", label: "Paiements", icon: TrendingUp },
  { id: "checks", label: "Chèques", icon: Banknote },
  { id: "acces", label: "Accès ZKTeco", icon: Fingerprint },
  { id: "demandes", label: "Demandes urgentes", icon: AlertCircle },
  { id: "tarifs", label: "Tarifs & Paramètres", icon: Settings },
];

const WORKER_NAV: NavItem[] = [
  { id: "enfants", label: "Enfants", icon: Baby },
  { id: "parents", label: "Parents", icon: Users },
  { id: "abonnements", label: "Abonnements", icon: CreditCard },
  { id: "demandes", label: "Demandes urgentes", icon: AlertCircle },
];

const TRAINER_NAV: NavItem[] = [
  { id: "today", label: "Activités du jour", icon: CalendarCheck },
  { id: "exercices", label: "Toutes les activités", icon: Dumbbell },
  { id: "absences", label: "Présences / Absences", icon: Activity },
  { id: "demandes", label: "Demandes urgentes", icon: AlertCircle },
];

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ role, items, active, onChange, onLogout }: {
  role: Role; items: NavItem[]; active: string; onChange: (id: string) => void; onLogout: () => void;
}) {
  const roleLabel = { admin: "Administrateur", worker: "Employé", trainer: "Entraîneur" }[role];
  return (
    <aside
      className="w-64 shrink-0 flex flex-col h-screen sticky top-0 overflow-y-auto"
      style={{ background: "var(--sidebar)" }}
    >
      {/* Logo — large and prominent */}
      <div
        className="flex items-center justify-center"
        style={{
          height: "200px",
          borderBottom: "1px solid var(--sidebar-border)",
        }}
      >
        <img
          src="/logo.png"
          alt="TouptiGym"
          className="h-60 w-auto object-contain"
        />
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {items.map(item => {
          const active_ = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium transition-colors text-left ${active_ ? "bg-pink-500 text-white" : "text-slate-300 hover:bg-white/8 hover:text-white"}`}
            >
              <item.icon size={14} className={active_ ? "text-white" : "text-slate-400"} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="px-2 pb-4" style={{ borderTop: "1px solid var(--sidebar-border)" }}>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-slate-400 hover:text-white hover:bg-white/8 transition-colors mt-3"
        >
          <LogOut size={14} /> Changer de rôle
        </button>
      </div>
    </aside>
  );
}

// ─── Dashboard shell ──────────────────────────────────────────────────────────
function Dashboard({ role, onLogout }: { role: Role; onLogout: () => void }) {
  const navMap = { admin: ADMIN_NAV, worker: WORKER_NAV, trainer: TRAINER_NAV };
  const nav = navMap[role];
  const [active, setActive] = useState(nav[0].id);
  const [modal, setModal] = useState<ModalType>(null);
  const [selectedChild, setSelectedChild] = useState<{ id: string; name: string } | null>(null);
  const [selectedParent, setSelectedParent] = useState<{ id: string; name: string; editMode?: boolean } | null>(null);
  const [selectedSubscription, setSelectedSubscription] = useState<{ id: string; name: string } | null>(null);
  const [selectedAbsence, setSelectedAbsence] = useState<any>(null);
  const [selectedCheck, setSelectedCheck] = useState<CheckType | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<{ id: string; name: string } | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [selectedTrainer, setSelectedTrainer] = useState<{ id: string; name: string } | null>(null);
  const [selectedEx, setSelectedEx] = useState<{ id: string; name: string; day: string; start_time: string; end_time: string }>({
    id: "",
    name: "",
    day: "",
    start_time: "",
    end_time: "",
  });
  const [selectedPaySub, setSelectedPaySub] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  function renderPage() {
    switch (active) {
      case "overview": return <PageOverview openModal={setModal} />;
      case "enfants": return <PageEnfants canEdit={role !== "trainer"} openModal={setModal} setSelectedChild={setSelectedChild} onRefresh={refreshKey} />;
      case "parents": return <PageParents canEdit={role !== "trainer"} openModal={setModal} setSelectedParent={setSelectedParent} onRefresh={refreshKey} />;
      case "abonnements": return <PageAbonnements canConfirm={role === "admin"} canCreate={role !== "trainer"} openModal={setModal} setSelectedSubscription={setSelectedSubscription} onRefresh={refreshKey} />;
      case "exercices": return <PageExercices canCreate={role !== "worker"} canEdit={role !== "trainer"} canViewPrice={role !== "trainer"} openModal={setModal} setSelectedExercise={setSelectedExercise} setSelectedGroup={setSelectedGroup} onRefresh={refreshKey} />;
      case "entraineurs": return <PageEntraineurs canEdit={role !== "trainer"} openModal={setModal} setSelectedTrainer={setSelectedTrainer} onRefresh={refreshKey} />;
      case "absences": return <PageAbsences openModal={setModal} setSelectedAbsence={setSelectedAbsence} />;
      case "checks": return <PageChecks canEdit={role !== "trainer"} openModal={setModal} setSelectedCheck={setSelectedCheck} onRefresh={refreshKey} />;
      case "acces": return <PageAcces />;
      case "paiements": return <PagePaiements openPayModal={setSelectedPaySub} onRefresh={refreshKey} />;
      case "demandes": return <PageDemandes canValidate={role === "admin"} openModal={setModal} onRefresh={refreshKey} />;
      case "tarifs": return <PageTarifs />;
      case "today": return <PageTrainerToday openModal={setModal} setSelectedEx={setSelectedEx} />;
      default: return null;
    }
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {sidebarOpen && <div className="fixed inset-0 z-20 lg:hidden bg-black/40" onClick={() => setSidebarOpen(false)} />}
      <div className={`fixed lg:relative z-30 h-full transition-transform lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <Sidebar role={role} items={nav} active={active} onChange={id => { setActive(id); setSidebarOpen(false); }} onLogout={onLogout} />
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-12 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-5 shrink-0">
          <button className="lg:hidden p-1.5 text-slate-500" onClick={() => setSidebarOpen(true)}><Menu size={16} /></button>
          <div className="flex items-center gap-3 ml-auto">
            <button className="text-slate-400 hover:text-slate-700 transition-colors"><Bell size={15} /></button>
            <div className="w-7 h-7 bg-pink-100 flex items-center justify-center text-pink-700 text-xs font-bold border border-pink-200">
              {role === "admin" ? "AD" : role === "worker" ? "EM" : "EN"}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-5 lg:p-7" style={{ scrollbarWidth: "thin", scrollbarColor: "#e2e8f0 transparent" }}>
          {renderPage()}
        </main>
      </div>

      {/* Modals */}
      {modal === "add-child" && <ModalAddChild onClose={() => setModal(null)} onCreated={() => setRefreshKey(k => k + 1)} />}
      {modal === "child-detail" && selectedChild && <ModalChildDetail childId={selectedChild.id} onClose={() => setModal(null)} />}
      {modal === "add-parent" && <ModalAddParent onClose={() => setModal(null)} onCreated={() => setRefreshKey(k => k + 1)} />}
      {modal === "parent-detail" && selectedParent && <ModalParentDetail parentId={selectedParent.id} onClose={() => setModal(null)} onUpdated={() => setRefreshKey(k => k + 1)} startEditing={selectedParent.editMode} />}
      {modal === "add-subscription" && <ModalAddSubscription onClose={() => setModal(null)} onCreated={() => setRefreshKey(k => k + 1)} openModal={setModal} />}
      {modal === "subscription-detail" && selectedSubscription && <ModalSubscriptionDetail subscriptionId={selectedSubscription.id} onClose={() => setModal(null)} onUpdated={() => setRefreshKey(k => k + 1)} />}
      {modal === "add-check" && <ModalAddCheck onClose={() => setModal(null)} onCreated={() => setRefreshKey(k => k + 1)} />}
      {modal === "check-detail" && selectedCheck && <ModalCheckDetail check={selectedCheck} onClose={() => setModal(null)} onUpdated={() => setRefreshKey(k => k + 1)} canEdit={role !== "trainer"} />}
      {modal === "add-trainer" && <ModalAddTrainer onClose={() => setModal(null)} onCreated={() => setRefreshKey(k => k + 1)} />}
      {modal === "trainer-detail" && selectedTrainer && <ModalTrainerDetail trainerId={selectedTrainer.id} onClose={() => setModal(null)} onUpdated={() => setRefreshKey(k => k + 1)} />}
      {modal === "justify-absence" && selectedAbsence && <ModalJustifyAbsence absence={selectedAbsence} onClose={() => setModal(null)} />}
      {modal === "add-request" && <ModalAddRequest onClose={() => setModal(null)} onCreated={() => setRefreshKey(k => k + 1)} />}
      {modal === "mark-attendance" && <ModalMarkAttendance exercice={selectedEx} onClose={() => setModal(null)} onSaved={() => setRefreshKey(k => k + 1)} />}
      {modal === "add-group" && <ModalAddGroup onClose={() => setModal(null)} onCreated={() => setRefreshKey(k => k + 1)} />}
      {modal === "edit-group" && selectedGroup && <ModalEditGroup group={selectedGroup} onClose={() => setModal(null)} onUpdated={() => setRefreshKey(k => k + 1)} />}
      {modal === "add-exercice" && <ModalAddExercice onClose={() => setModal(null)} onCreated={() => setRefreshKey(k => k + 1)} role={role} />}
      {modal === "exercice-detail" && selectedExercise && <ModalExerciceDetail exerciseId={selectedExercise.id} onClose={() => setModal(null)} onUpdated={() => setRefreshKey(k => k + 1)} role={role} />}
      {selectedPaySub && <ModalPayRest subscription={selectedPaySub} onClose={() => setSelectedPaySub(null)} onPaid={() => setRefreshKey(k => k + 1)} />}
    </div>
  );
}

// ─── Role Selector ────────────────────────────────────────────────────────────
function RoleSelector({ onSelect }: { onSelect: (r: Role) => void }) {
  const roles: { id: Role; label: string; sub: string; emoji: string }[] = [
    { id: "admin", label: "Administrateur", sub: "Gestion complète de l'établissement", emoji: "👑" },
    { id: "worker", label: "Employé", sub: "Gestion opérationnelle quotidienne", emoji: "👷" },
    { id: "trainer", label: "Entraîneur", sub: "Suivi des activités et des présences", emoji: "🏃" },
  ];

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <img src="/logo.png" alt="TouptiGym" className="h-28 w-auto mx-auto mb-2" />
          <p className="text-sm text-slate-400 mt-2">Sélectionnez votre profil</p>
        </div>

        {/* Role buttons — vertical stack, full width */}
        <div className="space-y-2">
          {roles.map(r => (
            <button
              key={r.id}
              onClick={() => onSelect(r.id)}
              className="w-full flex items-center gap-4 px-5 py-4 border border-slate-200 bg-white hover:border-pink-400 hover:bg-pink-50 transition-colors text-left group"
            >
              <span className="text-2xl">{r.emoji}</span>
              <div className="flex-1">
                <p className="font-semibold text-slate-900 group-hover:text-pink-700">{r.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{r.sub}</p>
              </div>
              <ChevronRight size={15} className="text-slate-300 group-hover:text-pink-400 transition-colors" />
            </button>
          ))}
        </div>

        <p className="text-center text-xs text-slate-300 mt-8">© 2026 TouptiGym</p>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [role, setRole] = useState<Role | null>(null);
  if (!role) return <RoleSelector onSelect={setRole} />;
  return <Dashboard role={role} onLogout={() => setRole(null)} />;
}