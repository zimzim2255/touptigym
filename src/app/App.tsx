import { useState, useMemo } from "react";
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
  | "add-parent"
  | "add-subscription"
  | "add-check" | "check-detail"
  | "add-trainer"
  | "justify-absence"
  | "add-request"
  | "mark-attendance";

// ─── Mock Data ────────────────────────────────────────────────────────────────
const CHILDREN = [
  { id: "1", nom: "Amine Benali", age: 8, genre: "Garçon", ecole: "Al Khawarizmi", typeEcole: "Bilingue", type: "VIP", zkteco: "ZK-1001", statut: "actif", adresse: "12 Rue Hassan II, Casablanca", cp: "20000" },
  { id: "2", nom: "Nora Cherkaoui", age: 10, genre: "Fille", ecole: "École Lumière", typeEcole: "Mission", type: "Normal", zkteco: "ZK-1002", statut: "actif", adresse: "5 Av. Mohamed V, Casablanca", cp: "20100" },
  { id: "3", nom: "Youssef El Alami", age: 7, genre: "Garçon", ecole: "Mission Française", typeEcole: "Mission", type: "Normal", zkteco: "ZK-1003", statut: "actif", adresse: "34 Bd Zerktouni", cp: "20200" },
  { id: "4", nom: "Sara Moussaoui", age: 9, genre: "Fille", ecole: "Al Khawarizmi", typeEcole: "Bilingue", type: "VIP", zkteco: "ZK-1004", statut: "expiré", adresse: "7 Rue Ibn Batouta", cp: "20050" },
  { id: "5", nom: "Hamza Raji", age: 11, genre: "Garçon", ecole: "École Lumière", typeEcole: "Mission", type: "Normal", zkteco: "ZK-1005", statut: "actif", adresse: "22 Av. Lalla Yacout", cp: "20300" },
  { id: "6", nom: "Lina Tahiri", age: 8, genre: "Fille", ecole: "Mission Française", typeEcole: "Mission", type: "Normal", zkteco: "ZK-1006", statut: "actif", adresse: "9 Rue Colbert", cp: "20400" },
];

const PARENTS = [
  { id: "1", nom: "Fatima Benali", telephone: "06 12 34 56 78", email: "f.benali@gmail.com", cin: "AB123456", enfants: ["Amine Benali"] },
  { id: "2", nom: "Mohamed Cherkaoui", telephone: "06 23 45 67 89", email: "m.cherkaoui@gmail.com", cin: "CD234567", enfants: ["Nora Cherkaoui"] },
  { id: "3", nom: "Aicha El Alami", telephone: "06 34 56 78 90", email: "a.elalami@gmail.com", cin: "EF345678", enfants: ["Youssef El Alami"] },
  { id: "4", nom: "Omar Raji", telephone: "06 45 67 89 01", email: "o.raji@gmail.com", cin: "GH456789", enfants: ["Hamza Raji"] },
];

const SUBSCRIPTIONS = [
  { id: "1", enfant: "Amine Benali", type: "Annuel", forfait: "2 Act/sem", montant: 10200, remise: 0, statut: "actif", debut: "2025-09-01", fin: "2026-06-30", confirme: true },
  { id: "2", enfant: "Nora Cherkaoui", type: "Session", forfait: "1 Act/sem", montant: 3900, remise: 390, statut: "actif", debut: "2026-01-15", fin: "2026-07-15", confirme: true },
  { id: "3", enfant: "Youssef El Alami", type: "Annuel", forfait: "3 Act/sem", montant: 13800, remise: 0, statut: "en_attente", debut: "2026-02-01", fin: "2027-01-31", confirme: false },
  { id: "4", enfant: "Sara Moussaoui", type: "Session", forfait: "2 Act/sem", montant: 6300, remise: 0, statut: "expiré", debut: "2025-02-01", fin: "2025-08-01", confirme: true },
  { id: "5", enfant: "Hamza Raji", type: "Annuel", forfait: "4 Act/sem", montant: 16200, remise: 1620, statut: "actif", debut: "2025-10-01", fin: "2026-09-30", confirme: true },
];

const EXERCICES = [
  { id: "1", nom: "Football U8", jour: "Lundi", type: "Football", heure: "14:00–16:00", coach: "M. Idrissi", enfants: 12, prix: 150 },
  { id: "2", nom: "Gym Artistique", jour: "Mercredi", type: "Gymnastics", heure: "10:00–12:00", coach: "Mme. Bensaid", enfants: 8, prix: 180 },
  { id: "3", nom: "Basketball U10", jour: "Vendredi", type: "Basketball", heure: "15:00–17:00", coach: "M. Ouali", enfants: 10, prix: 160 },
  { id: "4", nom: "Natation Débutant", jour: "Samedi", type: "Swimming", heure: "09:00–10:30", coach: "Mme. Kharroubi", enfants: 6, prix: 200 },
  { id: "5", nom: "Football U10", jour: "Mardi", type: "Football", heure: "16:00–18:00", coach: "M. Idrissi", enfants: 14, prix: 150 },
];

const COACHES = [
  { id: "1", nom: "M. Karim Idrissi", specialite: "Football", telephone: "06 61 23 45 67", email: "k.idrissi@touptigym.ma", seances: 3, statut: "actif" },
  { id: "2", nom: "Mme. Fatima Bensaid", specialite: "Gymnastics", telephone: "06 62 34 56 78", email: "f.bensaid@touptigym.ma", seances: 2, statut: "actif" },
  { id: "3", nom: "M. Rachid Ouali", specialite: "Basketball", telephone: "06 63 45 67 89", email: "r.ouali@touptigym.ma", seances: 2, statut: "actif" },
  { id: "4", nom: "Mme. Nadia Kharroubi", specialite: "Swimming", telephone: "06 64 56 78 90", email: "n.kharroubi@touptigym.ma", seances: 1, statut: "congé" },
];

const ABSENCES = [
  { id: "1", enfant: "Sara Moussaoui", exercice: "Gym Artistique", date: "22/07/2026", type: "absence", justifie: false, justificatif: "" },
  { id: "2", enfant: "Youssef El Alami", exercice: "Football U8", date: "21/07/2026", type: "retard", justifie: true, justificatif: "Transport perturbé" },
  { id: "3", enfant: "Lina Tahiri", exercice: "Football U10", date: "20/07/2026", type: "depart_anticipe", justifie: false, justificatif: "" },
  { id: "4", enfant: "Amine Benali", exercice: "Football U8", date: "19/07/2026", type: "absence", justifie: true, justificatif: "Compétition scolaire" },
];

const CHECKS = [
  { id: "1", numero: "1023", montant: 5000, banque: "Banque Populaire", titulaire: "Fatima Benali", statut: "disponible", date: "15/07/2026" },
  { id: "2", numero: "2056", montant: 3000, banque: "Attijariwafa Bank", titulaire: "Ali Alaoui", statut: "utilisé", date: "10/07/2026" },
  { id: "3", numero: "3412", montant: 8000, banque: "CIH Bank", titulaire: "Karim Tahiri", statut: "disponible", date: "05/07/2026" },
];

const REQUESTS = [
  { id: "1", enfant: "Amine Benali", exercice: "Football U8", date: "25/07/2026", notes: "Absence exceptionnelle — compétition scolaire", statut: "en_attente", cree_par: "M. Idrissi" },
  { id: "2", enfant: "Nora Cherkaoui", exercice: "Gym Artistique", date: "20/07/2026", notes: "Demande de rattrapage de séance", statut: "approuvée", cree_par: "Employé" },
  { id: "3", enfant: "Hamza Raji", exercice: "Basketball U10", date: "18/07/2026", notes: "Blessure légère — avis médical requis", statut: "rejetée", cree_par: "M. Ouali" },
];

const ACCESS_LOGS = [
  { id: "1", enfant: "Ahmed Benali", heure: "13:55", type: "Entrée", statut: "autorisé", appareil: "SpeedFace-V5L" },
  { id: "2", enfant: "Sara Alaoui", heure: "10:15", type: "Entrée", statut: "autorisé", appareil: "SpeedFace-V5L" },
  { id: "3", enfant: "Omar Benali", heure: "12:35", type: "Entrée", statut: "refusé", appareil: "SpeedFace-V5L" },
  { id: "4", enfant: "Ilyas Haddad", heure: "09:50", type: "Entrée", statut: "autorisé", appareil: "SpeedFace-V5L" },
  { id: "5", enfant: "Hamza Raji", heure: "15:58", type: "Sortie", statut: "autorisé", appareil: "SpeedFace-V5L" },
];

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
const PIE_COLORS = ["#f97316", "#3b82f6", "#10b981", "#8b5cf6"];

// ─── Primitives ───────────────────────────────────────────────────────────────
function Tag({ children, color = "default" }: { children: React.ReactNode; color?: string }) {
  const map: Record<string, string> = {
    default: "bg-orange-50 text-orange-700",
    green: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
    red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-700",
    gray: "bg-slate-100 text-slate-600",
  };
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-medium border border-current/15 ${map[color] ?? map.default}`}>
      {children}
    </span>
  );
}

function Btn({
  children, onClick, variant = "primary", size = "md", className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md";
  className?: string;
}) {
  const base = "inline-flex items-center gap-1.5 font-medium transition-colors cursor-pointer border";
  const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2 text-sm" };
  const variants = {
    primary: "bg-orange-500 text-white border-orange-500 hover:bg-orange-600 hover:border-orange-600",
    ghost: "bg-transparent text-slate-600 border-transparent hover:bg-slate-100 hover:text-slate-900",
    danger: "bg-transparent text-red-600 border-red-200 hover:bg-red-50",
    outline: "bg-white text-slate-700 border-slate-300 hover:bg-slate-50",
  };
  return (
    <button onClick={onClick} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = "w-full px-3 py-2 text-sm border border-slate-300 bg-white focus:outline-none focus:border-orange-500 transition-colors";
const selectCls = "w-full px-3 py-2 text-sm border border-slate-300 bg-white focus:outline-none focus:border-orange-500 appearance-none cursor-pointer";

// ─── Modal Shell ──────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, wide = false }: {
  title: string; onClose: () => void; children: React.ReactNode; wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}>
      <div className={`bg-white w-full flex flex-col max-h-[90vh] ${wide ? "max-w-6xl" : "max-w-lg"}`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
          <h2 className="font-semibold text-slate-900 text-sm">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors"><X size={16} /></button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Add Child Modal ──────────────────────────────────────────────────────────
function ModalAddChild({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Ajouter un Enfant" onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nom complet" required><input className={inputCls} placeholder="Prénom Nom" /></Field>
          <Field label="Sexe" required>
            <select className={selectCls}><option>Garçon</option><option>Fille</option></select>
          </Field>
          <Field label="Date de naissance" required><input type="date" className={inputCls} /></Field>
          <Field label="Photo"><input type="file" className={inputCls} accept="image/*" /></Field>
          <Field label="Nom de l'école"><input className={inputCls} placeholder="École" /></Field>
          <Field label="Type d'école">
            <select className={selectCls}><option>Bilingue</option><option>Mission</option><option>Autre</option></select>
          </Field>
          <Field label="Type de client">
            <select className={selectCls}><option>Normal</option><option>VIP</option></select>
          </Field>
          <Field label="ZKTeco ID"><input className={inputCls} placeholder="ZK-XXXX" /></Field>
        </div>
        <Field label="Adresse"><input className={inputCls} placeholder="Adresse complète" /></Field>
        <Field label="Code postal"><input className={inputCls} placeholder="20000" /></Field>
        <div className="flex gap-3 pt-2 border-t border-slate-100">
          <Btn><Check size={13} /> Créer</Btn>
          <Btn variant="outline" onClick={onClose}>Annuler</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ─── Child Detail Modal ───────────────────────────────────────────────────────
function ModalChildDetail({ child, onClose }: { child: typeof CHILDREN[0]; onClose: () => void }) {
  const [tab, setTab] = useState<"info" | "parents" | "acces">("info");
  const tabs: { id: typeof tab; label: string }[] = [
    { id: "info", label: "Infos Générales" },
    { id: "parents", label: "Parents" },
    { id: "acces", label: "Planning Accès" },
  ];
  return (
    <Modal title={`Détails — ${child.nom}`} onClose={onClose} wide>
      <div className="space-y-4">
        {/* Identity block */}
        <div className="border border-slate-200 p-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-slate-100 flex items-center justify-center text-slate-400 text-xl font-bold border border-slate-200">
              {child.nom.split(" ").map(n => n[0]).slice(0, 2).join("")}
            </div>
            <div>
              <p className="font-semibold text-slate-900">{child.nom}</p>
              <p className="text-sm text-slate-500">{child.genre} · {child.age} ans</p>
              <p className="text-xs font-mono text-slate-400 mt-0.5">ZKTeco ID: {child.zkteco}</p>
            </div>
            <div className="ml-auto">
              <Tag color={child.statut === "actif" ? "green" : "red"}>{child.statut}</Tag>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? "border-orange-500 text-orange-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "info" && (
          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              <div><span className="text-slate-500">École :</span> <span className="text-slate-900">{child.ecole}</span></div>
              <div><span className="text-slate-500">Type école :</span> <span className="text-slate-900">{child.typeEcole}</span></div>
              <div><span className="text-slate-500">Adresse :</span> <span className="text-slate-900">{child.adresse}</span></div>
              <div><span className="text-slate-500">CP :</span> <span className="text-slate-900">{child.cp}</span></div>
              <div><span className="text-slate-500">Type client :</span> <span className="text-slate-900">{child.type}</span></div>
            </div>
            <div className="mt-3 p-3 border border-slate-200 bg-slate-50">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Abonnement actif</p>
              <p className="text-sm text-slate-900">Annuel — 2 Act/sem · 10 200 Dhs</p>
              <p className="text-xs text-slate-500 mt-0.5">Valide jusqu'au 30/06/2026 · <span className="text-emerald-600">Actif</span></p>
            </div>
          </div>
        )}

        {tab === "parents" && (
          <div className="space-y-2 text-sm">
            {["Fatima Benali — 06 12 34 56 78", "Mohamed Benali — 06 98 76 54 32"].map((p, i) => (
              <div key={i} className="flex items-center gap-3 p-3 border border-slate-200">
                <div className="w-7 h-7 bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">{i === 0 ? "M" : "P"}</div>
                <span className="text-slate-800">{p}</span>
              </div>
            ))}
          </div>
        )}

        {tab === "acces" && (
          <div className="text-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th className="pb-2 text-xs font-semibold text-slate-500 uppercase">Jour</th>
                  <th className="pb-2 text-xs font-semibold text-slate-500 uppercase">Début</th>
                  <th className="pb-2 text-xs font-semibold text-slate-500 uppercase">Fin</th>
                  <th className="pb-2 text-xs font-semibold text-slate-500 uppercase">Fenêtre</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {[{ jour: "Lundi", debut: "14:00", fin: "16:00", fenetre: "13:45 → 16:30" }, { jour: "Mercredi", debut: "10:00", fin: "12:00", fenetre: "09:45 → 12:30" }].map((row, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-2 text-slate-800">{row.jour}</td>
                    <td className="py-2 font-mono text-slate-600">{row.debut}</td>
                    <td className="py-2 font-mono text-slate-600">{row.fin}</td>
                    <td className="py-2 text-slate-500 text-xs">{row.fenetre}</td>
                    <td className="py-2"><button className="text-slate-400 hover:text-orange-500"><Edit2 size={12} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="mt-3 text-sm text-orange-600 hover:underline flex items-center gap-1"><Plus size={13} /> Ajouter un créneau</button>
          </div>
        )}

        <div className="flex gap-3 pt-2 border-t border-slate-100">
          <Btn size="sm"><Edit2 size={12} /> Modifier</Btn>
          <Btn size="sm" variant="danger"><Trash2 size={12} /> Supprimer</Btn>
          <Btn size="sm" variant="ghost" className="ml-auto" onClick={onClose}><ArrowLeft size={12} /> Retour</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ─── Add Parent Modal ─────────────────────────────────────────────────────────
function ModalAddParent({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Ajouter un Parent" onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nom complet" required><input className={inputCls} placeholder="Prénom Nom" /></Field>
          <Field label="Téléphone" required><input className={inputCls} placeholder="06 XX XX XX XX" /></Field>
          <Field label="Email"><input type="email" className={inputCls} placeholder="email@exemple.com" /></Field>
          <Field label="CIN"><input className={inputCls} placeholder="AB123456" /></Field>
        </div>
        <Field label="Enfants liés">
          <div className="border border-slate-200 p-3 space-y-2">
            {CHILDREN.map(c => (
              <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" className="accent-orange-500" />
                <span>{c.nom} ({c.age} ans)</span>
              </label>
            ))}
          </div>
        </Field>
        <div className="flex gap-3 pt-2 border-t border-slate-100">
          <Btn><Check size={13} /> Créer</Btn>
          <Btn variant="outline" onClick={onClose}>Annuler</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ─── Add Subscription Modal (single page) ────────────────────────────────────
function ModalAddSubscription({ onClose, openModal }: { onClose: () => void; openModal: (m: ModalType) => void }) {
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState("Annuel");
  const [selectedExercices, setSelectedExercices] = useState<string[]>([]);
  const [payMethods, setPayMethods] = useState<string[]>(["Cash"]);

  const tarifs: Record<string, Record<string, number>> = {
    "1 Act": { Session: 3900, Annuel: 6600 },
    "2 Act": { Session: 6300, Annuel: 10200 },
    "3 Act": { Session: 8100, Annuel: 13800 },
    "4 Act": { Session: 9300, Annuel: 16200 },
  };

  return (
    <Modal title="Créer un Abonnement" onClose={onClose} wide>
      <div className="space-y-5">

        {/* ── Section 1 : Enfant ── */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">1. Enfant</p>
          <div className="border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-500 uppercase">Sélectionner un enfant</p>
              <Btn size="sm" variant="ghost" onClick={() => openModal("add-child")}><Plus size={12} /> Créer</Btn>
            </div>
            <div className="relative mb-3">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className={`${inputCls} pl-8`} placeholder="Rechercher un enfant..." />
            </div>
            <div className="border border-slate-200 divide-y divide-slate-100">
              {CHILDREN.map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedChild(c.nom)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-orange-50 transition-colors flex items-center justify-between ${selectedChild === c.nom ? "bg-orange-50 text-orange-700" : "text-slate-700"}`}
                >
                  {c.nom} ({c.age} ans)
                  {selectedChild === c.nom && <Check size={13} className="text-orange-500" />}
                </button>
              ))}
            </div>
            {selectedChild && (
              <p className="mt-2 text-xs text-emerald-600 flex items-center gap-1"><Check size={11} /> Sélectionné : {selectedChild}</p>
            )}
          </div>
        </div>

        {/* ── Section 2 : Type & Tarifs ── */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">2. Type d'abonnement & Tarifs</p>
          <div className="border border-slate-200 p-4 space-y-3">
            <div className="flex gap-2">
              {["Session", "Annuel"].map(t => (
                <button
                  key={t}
                  onClick={() => setSelectedType(t)}
                  className={`px-4 py-2 text-sm border font-medium transition-colors ${selectedType === t ? "border-orange-500 bg-orange-500 text-white" : "border-slate-300 text-slate-600 hover:border-slate-400"}`}
                >{t}</button>
              ))}
            </div>
            <div className="border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-500 mb-2">Tarifs {selectedType}</p>
              <div className="grid grid-cols-2 gap-1 text-xs text-slate-700">
                {Object.entries(tarifs).map(([act, prices]) => (
                  <div key={act} className="flex justify-between">
                    <span>{act}</span>
                    <span className="font-semibold">{prices[selectedType]?.toLocaleString()} Dhs</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Section 3 : Exercices ── */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">3. Exercices inclus</p>
          <div className="divide-y divide-slate-100 border border-slate-200">
            {EXERCICES.map(ex => (
              <label key={ex.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 text-sm">
                <input
                  type="checkbox"
                  checked={selectedExercices.includes(ex.id)}
                  onChange={e => setSelectedExercices(e.target.checked ? [...selectedExercices, ex.id] : selectedExercices.filter(id => id !== ex.id))}
                  className="accent-orange-500"
                />
                <span className="text-slate-800">{ex.nom}</span>
                <span className="text-slate-400 text-xs">— {ex.jour} {ex.heure}</span>
              </label>
            ))}
          </div>
        </div>

        {/* ── Section 4 : Résumé & Paiement ── */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">4. Résumé & Paiement</p>
          <div className="border border-slate-200 p-4 bg-slate-50 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-slate-600">Enfant</span><span className="text-slate-900">{selectedChild ?? "—"}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Type</span><span className="text-slate-900">{selectedType} — 2 Act/sem</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Montant</span><span className="text-slate-900">10 200 Dhs</span></div>
            <div className="flex justify-between text-orange-600"><span>Remise (−10%)</span><span>−1 020 Dhs</span></div>
            <div className="flex justify-between border-t border-slate-300 pt-1 font-semibold"><span>Total</span><span>9 180 Dhs</span></div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-3">
            <Field label="Assurance (Dhs)"><input className={inputCls} defaultValue="300" /></Field>
            <Field label="Droit d'entrée (Dhs)"><input className={inputCls} defaultValue="700" /></Field>
          </div>
          <Field label="Moyens de paiement (max 2)">
            <div className="flex gap-4">
              {["Cash", "Chèque", "Virement"].map(m => (
                <label key={m} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={payMethods.includes(m)}
                    onChange={e => setPayMethods(e.target.checked ? [...payMethods, m].slice(0, 2) : payMethods.filter(x => x !== m))}
                    className="accent-orange-500"
                  />
                  {m}
                </label>
              ))}
            </div>
          </Field>
          {payMethods.includes("Chèque") && (
            <div className="border border-slate-200 p-3">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Ajouter un chèque</p>
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className={`${inputCls} pl-8`} placeholder="Rechercher des chèques..." />
              </div>
              <div className="mt-2 p-2 bg-emerald-50 text-xs text-emerald-700 flex items-center gap-1.5">
                <Check size={11} /> Chèque #1023 — Banque Populaire — 5 000 Dhs
              </div>
            </div>
          )}
        </div>

        {/* ── Submit ── */}
        <div className="flex gap-3 pt-2 border-t border-slate-100">
          <Btn><Check size={13} /> Créer l'abonnement</Btn>
          <Btn variant="outline" onClick={onClose}>Annuler</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ─── Add Check Modal ──────────────────────────────────────────────────────────
function ModalAddCheck({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Ajouter un Chèque" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Numéro de chèque" required><input className={inputCls} placeholder="XXXX" /></Field>
          <Field label="Montant (Dhs)" required><input type="number" className={inputCls} defaultValue="0.00" /></Field>
          <Field label="Banque" required><input className={inputCls} placeholder="Nom de la banque" /></Field>
          <Field label="Titulaire" required>
            <input className={inputCls} placeholder="Nom du titulaire" />
            <div className="mt-1 border border-slate-200 divide-y divide-slate-100">
              {["Fatima Benali", "Mohamed Benali", "Sara Alaoui"].map(p => (
                <button key={p} className="w-full text-left px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">{p}</button>
              ))}
            </div>
          </Field>
        </div>
        <Field label="Image / Fichier du chèque (optionnel)">
          <input type="file" className={inputCls} accept="image/*,.pdf" />
          <div className="mt-2 border border-dashed border-slate-300 h-20 flex items-center justify-center text-xs text-slate-400">
            Aperçu image chèque
          </div>
        </Field>
        <div className="flex gap-3 pt-2 border-t border-slate-100">
          <Btn><Check size={13} /> Créer</Btn>
          <Btn variant="outline" onClick={onClose}>Annuler</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ─── Check Detail Modal ───────────────────────────────────────────────────────
function ModalCheckDetail({ check, onClose }: { check: typeof CHECKS[0]; onClose: () => void }) {
  return (
    <Modal title="Détails du Chèque" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <p className="text-xs text-slate-500 uppercase font-semibold">Numéro</p>
          <p className="text-2xl font-bold text-slate-900 mt-0.5" style={{ fontFamily: "'DM Mono', monospace" }}>#{check.numero}</p>
        </div>
        <div className="border border-slate-200 p-4 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Montant</span><span className="font-semibold text-slate-900">{check.montant.toLocaleString()},00 Dhs</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Banque</span><span>{check.banque}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Titulaire</span><span>{check.titulaire}</span></div>
          <div className="flex justify-between">
            <span className="text-slate-500">Statut</span>
            <Tag color={check.statut === "disponible" ? "green" : "red"}>{check.statut}</Tag>
          </div>
          <div className="flex justify-between"><span className="text-slate-500">Créé le</span><span>{check.date}</span></div>
        </div>
        <div className="flex gap-3">
          <Btn variant="outline" onClick={onClose}>Fermer</Btn>
          <Btn variant="danger"><Trash2 size={13} /> Supprimer</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ─── Add Trainer Modal ────────────────────────────────────────────────────────
function ModalAddTrainer({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Ajouter un Entraîneur" onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nom complet" required><input className={inputCls} /></Field>
          <Field label="Date de naissance"><input type="date" className={inputCls} /></Field>
          <Field label="CIN"><input className={inputCls} /></Field>
          <Field label="Téléphone"><input className={inputCls} placeholder="06 XX XX XX XX" /></Field>
          <Field label="Email" required><input type="email" className={inputCls} /></Field>
          <Field label="Spécialité">
            <select className={selectCls}><option>Football</option><option>Gymnastics</option><option>Basketball</option><option>Swimming</option></select>
          </Field>
          <Field label="Mot de passe" required><input type="password" className={inputCls} /></Field>
          <Field label="Photo"><input type="file" className={inputCls} accept="image/*" /></Field>
        </div>
        <div className="flex gap-3 pt-2 border-t border-slate-100">
          <Btn><Check size={13} /> Créer</Btn>
          <Btn variant="outline" onClick={onClose}>Annuler</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ─── Justify Absence Modal ────────────────────────────────────────────────────
function ModalJustifyAbsence({ absence, onClose }: { absence: typeof ABSENCES[0]; onClose: () => void }) {
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

// ─── Add Request Modal ────────────────────────────────────────────────────────
function ModalAddRequest({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Créer une Demande Urgente" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Enfant">
          <select className={selectCls}>
            {CHILDREN.map(c => <option key={c.id}>{c.nom}</option>)}
          </select>
        </Field>
        <Field label="Date"><input type="date" className={inputCls} defaultValue="2026-07-25" /></Field>
        <div className="border border-slate-200 p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-500 uppercase">Exercice</p>
            <Btn size="sm" variant="ghost"><Plus size={12} /> Créer</Btn>
          </div>
          <div className="relative mb-2">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className={`${inputCls} pl-8`} placeholder="Rechercher des exercices..." />
          </div>
          <div className="p-2 bg-emerald-50 text-xs text-emerald-700 flex items-center gap-1.5">
            <Check size={11} /> Football — Lundi 14:00–16:00 (Coach: M. Idrissi)
          </div>
        </div>
        <Field label="Notes (optionnel)">
          <textarea className={`${inputCls} h-20 resize-none`} placeholder="Description de la demande..." />
        </Field>
        <div className="flex gap-3 pt-2 border-t border-slate-100">
          <Btn>Envoyer</Btn>
          <Btn variant="outline" onClick={onClose}>Annuler</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ─── Mark Attendance Modal ────────────────────────────────────────────────────
function ModalMarkAttendance({ exercice, onClose }: { exercice: typeof EXERCICES[0]; onClose: () => void }) {
  const [status, setStatus] = useState<Record<string, "present" | "absent">>({ "1": "present" });
  return (
    <Modal title={`Présence — ${exercice.nom} (${exercice.jour} ${exercice.heure})`} onClose={onClose} wide>
      <div className="space-y-3">
        <p className="text-sm text-slate-600">Enfants inscrits à cette séance :</p>
        <div className="border border-slate-200 divide-y divide-slate-100">
          {CHILDREN.slice(0, 4).map(child => {
            const s = status[child.id];
            return (
              <div key={child.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                    {child.nom[0]}
                  </div>
                  <span className="text-sm text-slate-800">{child.nom}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setStatus(p => ({ ...p, [child.id]: "present" }))}
                    className={`px-3 py-1.5 text-xs font-medium border transition-colors ${s === "present" ? "bg-emerald-500 text-white border-emerald-500" : "border-slate-300 text-slate-600 hover:border-emerald-400"}`}
                  >
                    <Check size={11} className="inline mr-1" />Présent
                  </button>
                  <button
                    onClick={() => setStatus(p => ({ ...p, [child.id]: "absent" }))}
                    className={`px-3 py-1.5 text-xs font-medium border transition-colors ${s === "absent" ? "bg-red-500 text-white border-red-500" : "border-slate-300 text-slate-600 hover:border-red-400"}`}
                  >
                    <X size={11} className="inline mr-1" />Absent
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-3 pt-2 border-t border-slate-100">
          <Btn className="w-full justify-center"><Check size={13} /> Enregistrer</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ─── Page Wrapper (shared topbar + main area) ─────────────────────────────────
function PageWrap({ title, sub, action, children }: {
  title: string; sub?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "1.5rem", letterSpacing: "0.01em" }}>{title}</h1>
          {sub && <p className="text-sm text-slate-500 mt-0.5">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ─── Page: Overview ───────────────────────────────────────────────────────────
function PageOverview({ openModal }: { openModal: (m: ModalType) => void }) {
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
            <s.icon size={18} className="text-orange-500 mt-0.5 shrink-0" />
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
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", fontSize: 12 }} cursor={{ fill: "rgba(249,115,22,0.04)" }} />
              <Bar dataKey="presents" name="Présents" fill="#f97316" radius={0} />
              <Bar dataKey="absents" name="Absents" fill="#fed7aa" radius={0} />
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
              <Line type="monotone" dataKey="montant" stroke="#f97316" strokeWidth={2} dot={{ fill: "#f97316", r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-slate-200 p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Demandes urgentes</p>
          <div className="divide-y divide-slate-100">
            {REQUESTS.map(r => (
              <div key={r.id} className="py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-medium text-slate-800">{r.enfant}</p>
                  <Tag color={r.statut === "approuvée" ? "green" : r.statut === "rejetée" ? "red" : "amber"}>{r.statut}</Tag>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 leading-snug">{r.notes}</p>
              </div>
            ))}
          </div>
          <button onClick={() => openModal("add-request")} className="mt-2 text-xs text-orange-600 hover:underline flex items-center gap-1"><Plus size={11} /> Nouvelle demande</button>
        </div>
      </div>
    </PageWrap>
  );
}

// ─── Page: Enfants ────────────────────────────────────────────────────────────
function PageEnfants({ canEdit, openModal, setSelectedChild }: {
  canEdit?: boolean;
  openModal: (m: ModalType) => void;
  setSelectedChild: (c: typeof CHILDREN[0]) => void;
}) {
  const [q, setQ] = useState("");
  const list = useMemo(() => CHILDREN.filter(c => c.nom.toLowerCase().includes(q.toLowerCase())), [q]);
  return (
    <PageWrap
      title="Gestion des Enfants"
      sub={`${CHILDREN.length} enfants inscrits`}
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
                <td className="px-4 py-3 font-medium text-slate-900">{c.nom}</td>
                <td className="px-4 py-3 text-slate-500">{c.age} ans</td>
                <td className="px-4 py-3 text-slate-500">{c.genre[0]}</td>
                <td className="px-4 py-3 text-slate-500">{c.ecole}</td>
                <td className="px-4 py-3 text-slate-500">{c.typeEcole}</td>
                <td className="px-4 py-3"><Tag color={c.type === "VIP" ? "default" : "gray"}>{c.type}</Tag></td>
                <td className="px-4 py-3"><Tag color={c.statut === "actif" ? "green" : "red"}>{c.statut}</Tag></td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => { setSelectedChild(c); openModal("child-detail"); }} className="p-1 text-slate-400 hover:text-orange-500 transition-colors"><Eye size={13} /></button>
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
      </div>
    </PageWrap>
  );
}

// ─── Page: Parents ────────────────────────────────────────────────────────────
function PageParents({ openModal }: { openModal: (m: ModalType) => void }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => PARENTS.filter(p => p.nom.toLowerCase().includes(q.toLowerCase()) || p.telephone.includes(q)), [q]);
  return (
    <PageWrap title="Gestion des Parents" sub={`${PARENTS.length} parents`} action={<Btn onClick={() => openModal("add-parent")}><Plus size={13} /> Ajouter</Btn>}>
      <div className="bg-white border border-slate-200">
        <div className="px-4 py-3 border-b border-slate-200">
          <div className="relative max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher par nom, téléphone..." className={`${inputCls} pl-8`} />
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {["Nom", "Téléphone", "Email", "CIN", "Enfants", ""].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.map(p => (
              <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-medium text-slate-900">{p.nom}</td>
                <td className="px-4 py-3 text-slate-500">{p.telephone}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{p.email}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.cin}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{p.enfants.join(", ")}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button className="p-1 text-slate-400 hover:text-orange-500 transition-colors"><Eye size={13} /></button>
                    <button className="p-1 text-slate-400 hover:text-slate-700 transition-colors"><Edit2 size={13} /></button>
                    <button className="p-1 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageWrap>
  );
}

// ─── Page: Abonnements ────────────────────────────────────────────────────────
function PageAbonnements({ canConfirm, openModal }: { canConfirm?: boolean; openModal: (m: ModalType) => void }) {
  return (
    <PageWrap title="Abonnements" sub="5 abonnements enregistrés" action={<Btn onClick={() => openModal("add-subscription")}><Plus size={13} /> Nouvel abonnement</Btn>}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-200">
        {[
          { label: "Actifs", value: "3", icon: CheckCircle },
          { label: "En attente", value: "1", icon: Clock },
          { label: "Expirés", value: "1", icon: XCircle },
          { label: "Total encaissé", value: "50 700 Dhs", icon: Banknote },
        ].map((s, i) => (
          <div key={i} className="bg-white p-4 flex items-center gap-3">
            <s.icon size={16} className="text-orange-500 shrink-0" />
            <div>
              <p className="text-xs text-slate-500 uppercase font-semibold tracking-wide">{s.label}</p>
              <p className="text-xl font-bold text-slate-900" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-white border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {["Enfant", "Type", "Forfait", "Montant", "Remise", "Validité", "Statut", canConfirm ? "Actions" : ""].filter(Boolean).map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {SUBSCRIPTIONS.map(s => (
              <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-medium text-slate-900">{s.enfant}</td>
                <td className="px-4 py-3 text-slate-500">{s.type}</td>
                <td className="px-4 py-3 text-slate-500">{s.forfait}</td>
                <td className="px-4 py-3 font-semibold text-slate-900">{s.montant.toLocaleString()} Dhs</td>
                <td className="px-4 py-3 text-orange-600 text-xs">{s.remise > 0 ? `−${s.remise.toLocaleString()} Dhs` : "—"}</td>
                <td className="px-4 py-3 text-xs text-slate-400">{s.debut} → {s.fin}</td>
                <td className="px-4 py-3"><Tag color={s.statut === "actif" ? "green" : s.statut === "en_attente" ? "amber" : "red"}>{s.statut}</Tag></td>
                {canConfirm && (
                  <td className="px-4 py-3">
                    {!s.confirme && (
                      <div className="flex gap-1">
                        <button className="flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium hover:bg-emerald-100 border border-emerald-200 transition-colors"><Check size={10} /> Confirmer</button>
                        <button className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 text-xs font-medium hover:bg-red-100 border border-red-200 transition-colors"><X size={10} /> Rejeter</button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageWrap>
  );
}

// ─── Page: Exercices ──────────────────────────────────────────────────────────
function PageExercices({ canCreate, openModal }: { canCreate?: boolean; openModal: (m: ModalType) => void }) {
  return (
    <PageWrap title="Exercices & Séances" sub={`${EXERCICES.length} séances programmées`} action={canCreate && <Btn><Plus size={13} /> Créer une séance</Btn>}>
      <div className="bg-white border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {["Nom", "Jour", "Horaire", "Type", "Coach", "Enfants", "Prix", ""].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {EXERCICES.map(ex => (
              <tr key={ex.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-medium text-slate-900">{ex.nom}</td>
                <td className="px-4 py-3 text-slate-500">{ex.jour}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">{ex.heure}</td>
                <td className="px-4 py-3">
                  <Tag color={ex.type === "Football" ? "green" : ex.type === "Basketball" ? "default" : ex.type === "Swimming" ? "blue" : "gray"}>{ex.type}</Tag>
                </td>
                <td className="px-4 py-3 text-slate-500">{ex.coach}</td>
                <td className="px-4 py-3 text-slate-500">{ex.enfants}</td>
                <td className="px-4 py-3 text-slate-500">{ex.prix} Dhs</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => openModal("mark-attendance")} className="p-1 text-slate-400 hover:text-orange-500 transition-colors"><CalendarCheck size={13} /></button>
                    <button className="p-1 text-slate-400 hover:text-slate-700 transition-colors"><Edit2 size={13} /></button>
                    <button className="p-1 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageWrap>
  );
}

// ─── Page: Entraîneurs ────────────────────────────────────────────────────────
function PageEntraineurs({ openModal }: { openModal: (m: ModalType) => void }) {
  return (
    <PageWrap title="Entraîneurs" sub={`${COACHES.length} entraîneurs`} action={<Btn onClick={() => openModal("add-trainer")}><Plus size={13} /> Ajouter</Btn>}>
      <div className="bg-white border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {["Nom", "Spécialité", "Téléphone", "Email", "Séances/sem", "Statut", ""].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {COACHES.map(c => (
              <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-medium text-slate-900">{c.nom}</td>
                <td className="px-4 py-3 text-slate-500">{c.specialite}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{c.telephone}</td>
                <td className="px-4 py-3 text-xs text-slate-400">{c.email}</td>
                <td className="px-4 py-3 text-slate-500">{c.seances}</td>
                <td className="px-4 py-3"><Tag color={c.statut === "actif" ? "green" : "amber"}>{c.statut}</Tag></td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button className="p-1 text-slate-400 hover:text-slate-700 transition-colors"><Edit2 size={13} /></button>
                    <button className="p-1 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageWrap>
  );
}

// ─── Page: Absences ───────────────────────────────────────────────────────────
function PageAbsences({ openModal, setSelectedAbsence }: {
  openModal: (m: ModalType) => void;
  setSelectedAbsence: (a: typeof ABSENCES[0]) => void;
}) {
  return (
    <PageWrap title="Présences & Absences" sub="Historique des présences">
      <div className="flex gap-2 flex-wrap">
        {["Date", "Exercice", "Enfant"].map(f => (
          <button key={f} className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 bg-white text-xs text-slate-600 hover:border-slate-400 transition-colors">
            <Filter size={11} /> {f}
          </button>
        ))}
      </div>
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
            {ABSENCES.map(a => (
              <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-medium text-slate-900">{a.enfant}</td>
                <td className="px-4 py-3 text-slate-500">{a.date}</td>
                <td className="px-4 py-3 text-slate-500">{a.exercice}</td>
                <td className="px-4 py-3"><Tag color={a.type === "absence" ? "red" : a.type === "retard" ? "amber" : "blue"}>{a.type.replace("_", " ")}</Tag></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    {a.justifie ? <Check size={13} className="text-emerald-500" /> : <X size={13} className="text-red-400" />}
                    {a.justifie && <span className="text-xs text-slate-400 truncate max-w-24">{a.justificatif}</span>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {!a.justifie && (
                    <button onClick={() => { setSelectedAbsence(a); openModal("justify-absence"); }} className="text-xs text-orange-600 hover:underline">Justifier</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageWrap>
  );
}

// ─── Page: Chèques ────────────────────────────────────────────────────────────
function PageChecks({ openModal, setSelectedCheck }: {
  openModal: (m: ModalType) => void;
  setSelectedCheck: (c: typeof CHECKS[0]) => void;
}) {
  const [q, setQ] = useState("");
  const list = useMemo(() => CHECKS.filter(c => c.numero.includes(q) || c.banque.toLowerCase().includes(q.toLowerCase()) || c.titulaire.toLowerCase().includes(q.toLowerCase())), [q]);
  return (
    <PageWrap title="Gestion des Chèques" sub={`${CHECKS.length} chèques enregistrés`} action={<Btn onClick={() => openModal("add-check")}><Plus size={13} /> Ajouter</Btn>}>
      <div className="bg-white border border-slate-200">
        <div className="px-4 py-3 border-b border-slate-200">
          <div className="relative max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher par numéro, banque..." className={`${inputCls} pl-8`} />
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {["N°", "Montant", "Banque", "Titulaire", "Statut", "Date", ""].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.map(c => (
              <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-mono font-semibold text-slate-900">#{c.numero}</td>
                <td className="px-4 py-3 font-semibold text-slate-900">{c.montant.toLocaleString()} Dhs</td>
                <td className="px-4 py-3 text-slate-500">{c.banque}</td>
                <td className="px-4 py-3 text-slate-500">{c.titulaire}</td>
                <td className="px-4 py-3"><Tag color={c.statut === "disponible" ? "green" : "red"}>{c.statut}</Tag></td>
                <td className="px-4 py-3 text-slate-400 text-xs">{c.date}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => { setSelectedCheck(c); openModal("check-detail"); }} className="p-1 text-slate-400 hover:text-orange-500 transition-colors"><Eye size={13} /></button>
                    <button className="p-1 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageWrap>
  );
}

// ─── Page: Accès ZKTeco ───────────────────────────────────────────────────────
function PageAcces() {
  return (
    <PageWrap title="Contrôle d'Accès ZKTeco" sub="SpeedFace-V5L — Temps réel">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-200">
        {[
          { label: "SpeedFace #1 — Entrée principale", status: "En ligne", online: true },
          { label: "SpeedFace #2 — Salle sport", status: "En ligne", online: true },
        ].map((d, i) => (
          <div key={i} className="bg-white p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2 h-2 ${d.online ? "bg-emerald-500" : "bg-red-500"}`} />
              <span className={`text-xs font-semibold ${d.online ? "text-emerald-700" : "text-red-600"}`}>{d.status}</span>
            </div>
            <p className="text-xs text-slate-500">{d.label}</p>
          </div>
        ))}
        {[
          { label: "Passages aujourd'hui", value: "45", icon: Activity },
          { label: "Refus aujourd'hui", value: "3", icon: Shield },
        ].map((s, i) => (
          <div key={i} className="bg-white p-4 flex items-center gap-3">
            <s.icon size={16} className="text-orange-500 shrink-0" />
            <div>
              <p className="text-xs text-slate-500 uppercase font-semibold tracking-wide">{s.label}</p>
              <p className="text-xl font-bold text-slate-900" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-amber-50 border border-amber-200 px-4 py-3">
        <p className="text-xs font-semibold text-amber-700 uppercase mb-2">Alertes</p>
        <div className="space-y-1">
          <p className="text-sm text-amber-800">⚠ Omar Benali — Tentative d'accès hors horaire autorisé</p>
          <p className="text-sm text-amber-800">⚠ Porte entrée — Ouverte depuis &gt; 5 min</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Logs du jour — Aujourd'hui 22/07/2026</p>
          <button className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700"><RefreshCw size={11} /> Actualiser</button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {["Heure", "Enfant", "Type", "Statut", "Appareil"].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ACCESS_LOGS.map(log => (
              <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-mono text-slate-700">{log.heure}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{log.enfant}</td>
                <td className="px-4 py-3 text-slate-500">{log.type}</td>
                <td className="px-4 py-3"><Tag color={log.statut === "autorisé" ? "green" : "red"}>{log.statut}</Tag></td>
                <td className="px-4 py-3 text-xs text-slate-400">{log.appareil}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageWrap>
  );
}

// ─── Page: Demandes Urgentes ──────────────────────────────────────────────────
function PageDemandes({ canValidate, openModal }: { canValidate?: boolean; openModal: (m: ModalType) => void }) {
  return (
    <PageWrap title="Demandes Urgentes" sub={`${REQUESTS.length} demandes`} action={<Btn onClick={() => openModal("add-request")}><Plus size={13} /> Nouvelle demande</Btn>}>
      <div className="bg-white border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {["Enfant", "Date", "Exercice", "Demandeur", "Notes", "Statut", canValidate ? "Actions" : ""].filter(Boolean).map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {REQUESTS.map(r => (
              <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-medium text-slate-900">{r.enfant}</td>
                <td className="px-4 py-3 text-slate-500">{r.date}</td>
                <td className="px-4 py-3 text-slate-500">{r.exercice}</td>
                <td className="px-4 py-3 text-slate-400 text-xs">{r.cree_par}</td>
                <td className="px-4 py-3 text-slate-500 text-xs max-w-48 truncate">{r.notes}</td>
                <td className="px-4 py-3"><Tag color={r.statut === "approuvée" ? "green" : r.statut === "rejetée" ? "red" : "amber"}>{r.statut}</Tag></td>
                {canValidate && (
                  <td className="px-4 py-3">
                    {r.statut === "en_attente" && (
                      <div className="flex gap-1">
                        <button className="flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 text-xs border border-emerald-200 hover:bg-emerald-100 transition-colors"><Check size={10} /> Approuver</button>
                        <button className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 text-xs border border-red-200 hover:bg-red-100 transition-colors"><X size={10} /> Rejeter</button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
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
                  <td className="px-4 py-2.5"><input className="w-24 px-2 py-1 border border-slate-200 text-sm text-slate-900 font-medium focus:outline-none focus:border-orange-400" defaultValue={r.session} /></td>
                  <td className="px-4 py-2.5"><input className="w-24 px-2 py-1 border border-slate-200 text-sm text-slate-900 font-medium focus:outline-none focus:border-orange-400" defaultValue={r.annuel} /></td>
                  <td className="px-4 py-2.5"><button className="text-orange-500 hover:text-orange-700 text-xs font-medium">Sauv.</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t border-slate-200 space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Frais supplémentaires</p>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-slate-600 w-44">Droit d'entrée</span>
              <input className="w-20 px-2 py-1 border border-slate-200 text-sm font-medium focus:outline-none focus:border-orange-400" defaultValue="700" />
              <span className="text-slate-400 text-xs">Dhs</span>
              <button className="text-orange-500 text-xs font-medium">Sauv.</button>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-slate-600 w-44">Assurance & Carte membre</span>
              <input className="w-20 px-2 py-1 border border-slate-200 text-sm font-medium focus:outline-none focus:border-orange-400" defaultValue="300" />
              <span className="text-slate-400 text-xs">Dhs</span>
              <button className="text-orange-500 text-xs font-medium">Sauv.</button>
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
                  <td className="px-4 py-2.5 font-semibold text-orange-600">{r.valeur}</td>
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

// ─── Page: Trainer — Today's exercises ───────────────────────────────────────
function PageTrainerExercices({ openModal, setSelectedEx }: {
  openModal: (m: ModalType) => void;
  setSelectedEx: (e: typeof EXERCICES[0]) => void;
}) {
  const today = EXERCICES.filter(e => e.jour === "Lundi");
  const upcoming = EXERCICES.filter(e => e.jour !== "Lundi");
  return (
    <PageWrap title="Exercices du Jour" sub="Lundi 22 Juillet 2026">
      {today.length > 0 && (
        <div className="divide-y divide-slate-200 border border-slate-200 bg-white">
          {today.map(ex => (
            <div key={ex.id} className="px-5 py-4 flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-slate-900">{ex.nom}</p>
                <p className="text-sm text-slate-500 mt-0.5">Coach : {ex.coach} · {ex.heure} · {ex.enfants} enfants</p>
              </div>
              <Btn size="sm" onClick={() => { setSelectedEx(ex); openModal("mark-attendance"); }}>
                <CalendarCheck size={13} /> Marquer la présence
              </Btn>
            </div>
          ))}
        </div>
      )}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Exercices à venir</p>
        <div className="divide-y divide-slate-200 border border-slate-200 bg-white">
          {upcoming.map(ex => (
            <div key={ex.id} className="px-5 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">{ex.nom}</p>
                <p className="text-xs text-slate-400 mt-0.5">{ex.jour} · {ex.heure}</p>
              </div>
              <Tag>{ex.type}</Tag>
            </div>
          ))}
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
  { id: "exercices", label: "Exercices", icon: Dumbbell },
  { id: "entraineurs", label: "Entraîneurs", icon: UserCheck },
  { id: "absences", label: "Présences", icon: CalendarCheck },
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
  { id: "today", label: "Exercices du jour", icon: CalendarCheck },
  { id: "exercices", label: "Tous les exercices", icon: Dumbbell },
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
      className="w-56 shrink-0 flex flex-col h-screen sticky top-0 overflow-y-auto"
      style={{ background: "var(--sidebar)" }}
    >
      {/* Logo */}
      <div className="px-5 py-5" style={{ borderBottom: "1px solid var(--sidebar-border)" }}>
        <p className="text-white font-bold text-xl tracking-tight" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
          TOUPTI<span className="text-orange-400">GYM</span>
        </p>
        <p className="text-xs mt-1" style={{ color: "rgba(226,232,240,0.5)" }}>{roleLabel}</p>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {items.map(item => {
          const active_ = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium transition-colors text-left ${active_ ? "bg-orange-500 text-white" : "text-slate-300 hover:bg-white/8 hover:text-white"}`}
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
  const [selectedChild, setSelectedChild] = useState<typeof CHILDREN[0] | null>(null);
  const [selectedAbsence, setSelectedAbsence] = useState<typeof ABSENCES[0] | null>(null);
  const [selectedCheck, setSelectedCheck] = useState<typeof CHECKS[0] | null>(null);
  const [selectedEx, setSelectedEx] = useState<typeof EXERCICES[0]>(EXERCICES[0]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function renderPage() {
    switch (active) {
      case "overview": return <PageOverview openModal={setModal} />;
      case "enfants": return <PageEnfants canEdit={role !== "trainer"} openModal={setModal} setSelectedChild={setSelectedChild} />;
      case "parents": return <PageParents openModal={setModal} />;
      case "abonnements": return <PageAbonnements canConfirm={role === "admin"} openModal={setModal} />;
      case "exercices": return <PageExercices canCreate={role !== "worker"} openModal={setModal} />;
      case "entraineurs": return <PageEntraineurs openModal={setModal} />;
      case "absences": return <PageAbsences openModal={setModal} setSelectedAbsence={setSelectedAbsence} />;
      case "checks": return <PageChecks openModal={setModal} setSelectedCheck={setSelectedCheck} />;
      case "acces": return <PageAcces />;
      case "demandes": return <PageDemandes canValidate={role === "admin"} openModal={setModal} />;
      case "tarifs": return <PageTarifs />;
      case "today": return <PageTrainerExercices openModal={setModal} setSelectedEx={setSelectedEx} />;
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
            <div className="w-7 h-7 bg-orange-100 flex items-center justify-center text-orange-700 text-xs font-bold border border-orange-200">
              {role === "admin" ? "AD" : role === "worker" ? "EM" : "EN"}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-5 lg:p-7" style={{ scrollbarWidth: "thin", scrollbarColor: "#e2e8f0 transparent" }}>
          {renderPage()}
        </main>
      </div>

      {/* Modals */}
      {modal === "add-child" && <ModalAddChild onClose={() => setModal(null)} />}
      {modal === "child-detail" && selectedChild && <ModalChildDetail child={selectedChild} onClose={() => setModal(null)} />}
      {modal === "add-parent" && <ModalAddParent onClose={() => setModal(null)} />}
      {modal === "add-subscription" && <ModalAddSubscription onClose={() => setModal(null)} openModal={setModal} />}
      {modal === "add-check" && <ModalAddCheck onClose={() => setModal(null)} />}
      {modal === "check-detail" && selectedCheck && <ModalCheckDetail check={selectedCheck} onClose={() => setModal(null)} />}
      {modal === "add-trainer" && <ModalAddTrainer onClose={() => setModal(null)} />}
      {modal === "justify-absence" && selectedAbsence && <ModalJustifyAbsence absence={selectedAbsence} onClose={() => setModal(null)} />}
      {modal === "add-request" && <ModalAddRequest onClose={() => setModal(null)} />}
      {modal === "mark-attendance" && <ModalMarkAttendance exercice={selectedEx} onClose={() => setModal(null)} />}
    </div>
  );
}

// ─── Role Selector ────────────────────────────────────────────────────────────
function RoleSelector({ onSelect }: { onSelect: (r: Role) => void }) {
  const roles: { id: Role; label: string; sub: string; emoji: string }[] = [
    { id: "admin", label: "Administrateur", sub: "Gestion complète de l'établissement", emoji: "👑" },
    { id: "worker", label: "Employé", sub: "Gestion opérationnelle quotidienne", emoji: "👷" },
    { id: "trainer", label: "Entraîneur", sub: "Suivi des séances et des présences", emoji: "🏃" },
  ];

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-orange-500 mb-4">
            <Dumbbell size={24} className="text-white" />
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
            TOUPTI<span className="text-orange-500">GYM</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">Sélectionnez votre profil</p>
        </div>

        {/* Role buttons — vertical stack, full width */}
        <div className="space-y-2">
          {roles.map(r => (
            <button
              key={r.id}
              onClick={() => onSelect(r.id)}
              className="w-full flex items-center gap-4 px-5 py-4 border border-slate-200 bg-white hover:border-orange-400 hover:bg-orange-50 transition-colors text-left group"
            >
              <span className="text-2xl">{r.emoji}</span>
              <div className="flex-1">
                <p className="font-semibold text-slate-900 group-hover:text-orange-700">{r.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{r.sub}</p>
              </div>
              <ChevronRight size={15} className="text-slate-300 group-hover:text-orange-400 transition-colors" />
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
