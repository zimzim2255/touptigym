import { useState, useMemo, useEffect, useCallback } from "react";
import { Search, Plus, Filter, Eye, Edit2, Trash2, Check, X, CreditCard } from "lucide-react";
import { PageWrap, Btn, Tag, inputCls } from "../shared/Primitives";
import { useApi } from "../../../hooks/useSupabase";
import { ModalType } from "../../types";

interface Subscription {
  id: string;
  child_id: string;
  type: string;
  sub_type: string | null;
  amount: number;
  discount: number;
  insurance: number;
  entry_fee: number;
  paid_amount: number;
  status: string;
  exercises: string[];
  start_date: string;
  end_date: string;
  subscription_date?: string;
  created_at: string;
  children?: { name: string };
}

interface Props {
  canConfirm?: boolean;
  canCreate?: boolean;
  openModal: (m: ModalType) => void;
  setSelectedSubscription: (s: { id: string; name: string }) => void;
  onRefresh?: number;
}

type PaymentFilter = "all" | "paid" | "partial" | "unpaid";

export function PageAbonnements({ canConfirm, canCreate, openModal, setSelectedSubscription, onRefresh }: Props) {
  const api = useApi();
  const [q, setQ] = useState("");
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState(0);
  const [payFilter, setPayFilter] = useState<PaymentFilter>("all");
  const [dateFilterStart, setDateFilterStart] = useState("");
  const [dateFilterEnd, setDateFilterEnd] = useState("");
  const [smartFilter, setSmartFilter] = useState<"all" | "approaching">("all");
  const [dateQuickFilter, setDateQuickFilter] = useState("");
  const [dateQuickType, setDateQuickType] = useState<"start" | "end">("start");

  const active = subscriptions.filter(s => s.status === "actif").length;
  const expired = subscriptions.filter(s => s.status === "expiré" || s.status === "résilié").length;
  const pending = subscriptions.filter(s => s.status === "en_attente").length;
  const totalRevenue = subscriptions.reduce((sum, s) => sum + (s.amount - s.discount + s.insurance + s.entry_fee), 0);
  const totalCollected = subscriptions.reduce((sum, s) => sum + (s.paid_amount || 0), 0);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data: Subscription[] = await api.subscriptions.getAll();
      setSubscriptions(data);
      setCount(data.length);
    } catch (err: any) {
      console.error("Failed to load subscriptions:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh, onRefresh]);

  const list = useMemo(() => {
    let filtered = subscriptions;
    const lq = q.toLowerCase();
    if (q) {
      filtered = filtered.filter(s =>
        (s.children?.name || "").toLowerCase().includes(lq) ||
        s.type.toLowerCase().includes(lq)
      );
    }
    if (payFilter !== "all") {
      filtered = filtered.filter(s => {
        const total = s.amount - s.discount + s.insurance + s.entry_fee;
        const paid = s.paid_amount || 0;
        const rest = total - paid;
        if (payFilter === "paid") return rest <= 0;
        if (payFilter === "partial") return paid > 0 && rest > 0;
        if (payFilter === "unpaid") return paid <= 0;
        return true;
      });
    }
    // Date range filters
    if (dateFilterStart) {
      filtered = filtered.filter(s => s.start_date >= dateFilterStart);
    }
    if (dateFilterEnd) {
      filtered = filtered.filter(s => s.end_date <= dateFilterEnd);
    }
    // Smart filter: approaching end date (within 30 days)
    if (smartFilter === "approaching") {
      const now = new Date();
      const thirtyDays = new Date();
      thirtyDays.setDate(thirtyDays.getDate() + 30);
      filtered = filtered.filter(s => {
        const end = new Date(s.end_date);
        return end >= now && end <= thirtyDays;
      });
    }
    // Sort by start date
    filtered = [...filtered].sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
    return filtered;
  }, [subscriptions, q, payFilter, dateFilterStart, dateFilterEnd, smartFilter]);

  function getPayStatus(total: number, paid: number): { label: string; color: string } {
    const rest = total - paid;
    if (paid <= 0) return { label: "Non payé", color: "red" };
    if (rest <= 0) return { label: "Payé", color: "green" };
    return { label: "Partiel", color: "amber" };
  }

  async function handleConfirm(id: string) {
    try {
      await api.subscriptions.confirm(id, "admin");
      refresh();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleReject(id: string) {
    try {
      await api.subscriptions.reject(id);
      refresh();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cet abonnement ? Cette action est irréversible.")) return;
    try {
      await api.subscriptions.remove(id);
      refresh();
    } catch (err: any) {
      alert(err.message);
    }
  }

  function computeStatus(s: Subscription): string {
    if (s.status === "résilié") return "résilié";
    if (s.status === "en_attente") return "en_attente";
    const now = new Date();
    const end = new Date(s.end_date);
    if (end < now) return "expiré";
    return "actif";
  }

  const filterBtns: { key: PaymentFilter; label: string }[] = [
    { key: "all", label: "Tous" },
    { key: "paid", label: "Payé" },
    { key: "partial", label: "Partiel" },
    { key: "unpaid", label: "Non payé" },
  ];

  return (
    <PageWrap
      title="Abonnements"
      sub={`${count} abonnements — ${totalCollected.toLocaleString()} Dhs encaissés`}
      action={canCreate && <Btn onClick={() => openModal("add-subscription")}><Plus size={13} /> Nouvel abonnement</Btn>}
    >
      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-px bg-slate-200">
        {[
          { label: "Actifs", value: active.toString(), icon: Check },
          { label: "En attente", value: pending.toString(), icon: X },
          { label: "Expirés", value: expired.toString(), icon: X },
          { label: "Total dû", value: `${totalRevenue.toLocaleString()} Dhs`, icon: CreditCard },
          { label: "Encaissé", value: `${totalCollected.toLocaleString()} Dhs`, icon: CreditCard },
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
        {/* Search + Filter */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher par enfant..." className={`${inputCls} pl-8`} />
          </div>
          <div className="flex gap-1">
            {filterBtns.map(btn => (
              <button
                key={btn.key}
                onClick={() => setPayFilter(btn.key)}
                className={`px-3 py-1.5 text-xs font-medium border transition-colors ${
                  payFilter === btn.key
                    ? "border-orange-500 bg-orange-50 text-orange-700"
                    : "border-slate-200 text-slate-500 hover:border-slate-400"
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <select value={dateQuickType} onChange={e => setDateQuickType(e.target.value as "start" | "end")} className={`${inputCls} text-xs w-16`}>
              <option value="start">Début</option>
              <option value="end">Fin</option>
            </select>
            <select value={dateQuickFilter} onChange={e => { setDateQuickFilter(e.target.value); if (e.target.value) { const d = e.target.value; if (dateQuickType === "start") { setDateFilterStart(d); setDateFilterEnd(""); } else { setDateFilterEnd(d); setDateFilterStart(""); } } else { setDateFilterStart(""); setDateFilterEnd(""); } }} className={`${inputCls} text-xs w-32`}>
              <option value="">Dates...</option>
              {subscriptions
                .map(s => dateQuickType === "start" ? s.start_date : s.end_date)
                .filter((v, i, a) => a.indexOf(v) === i)
                .sort()
                .slice(0, 10)
                .map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
            </select>
          </div>
          <input type="date" value={dateFilterStart} onChange={e => setDateFilterStart(e.target.value)} className={`${inputCls} text-xs w-32`} title="Date de début" />
          <span className="text-xs text-slate-400">→</span>
          <input type="date" value={dateFilterEnd} onChange={e => setDateFilterEnd(e.target.value)} className={`${inputCls} text-xs w-32`} title="Date de fin" />
        </div>

        {loading ? (
          <div className="p-6 text-sm text-slate-500 text-center">Chargement...</div>
        ) : list.length === 0 ? (
          <div className="p-6 text-sm text-slate-500 text-center">Aucun abonnement trouvé.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {["Enfant", "Type", "Total", "Payé", "Reste", "Date d'abonnement", "Validité", "Statut", "Paiement", "Actions"].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map(s => {
                const status = computeStatus(s);
                const total = s.amount - s.discount + s.insurance + s.entry_fee;
                const paid = s.paid_amount || 0;
                const rest = total - paid;
                const payStatus = getPayStatus(total, paid);

                const isApproaching = (() => {
                  const now = new Date();
                  const end = new Date(s.end_date);
                  const thirtyDays = new Date();
                  thirtyDays.setDate(thirtyDays.getDate() + 30);
                  return end >= now && end <= thirtyDays && s.status === "actif";
                })();

                return (
                  <tr key={s.id} className={`hover:bg-slate-50 transition-colors ${isApproaching ? "bg-amber-50 border-l-4 border-l-amber-400" : ""}`}>
                    <td className="px-4 py-3 font-medium text-slate-900">{s.children?.name || "—"}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{s.type}{s.sub_type ? ` — ${s.sub_type}` : ""}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{total.toLocaleString()} Dhs</td>
                    <td className="px-4 py-3 text-emerald-600">{paid.toLocaleString()} Dhs</td>
                    <td className="px-4 py-3">
                      <span className={rest <= 0 ? "text-emerald-600" : "text-orange-600 font-semibold"}>
                        {rest <= 0 ? "—" : `${rest.toLocaleString()} Dhs`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{s.subscription_date || "—"}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{s.start_date} → {s.end_date}</td>
                    <td className="px-4 py-3">
                      <Tag color={status === "actif" ? "green" : status === "expiré" || status === "résilié" ? "red" : "amber"}>{status}</Tag>
                    </td>
                    <td className="px-4 py-3">
                      <Tag color={payStatus.color}>{payStatus.label}</Tag>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => { setSelectedSubscription({ id: s.id, name: s.children?.name || s.id }); openModal("subscription-detail"); }}
                          className="p-1 text-slate-400 hover:text-orange-500 transition-colors"><Eye size={13} /></button>
                        {canConfirm && <>
                          <button onClick={() => { setSelectedSubscription({ id: s.id, name: s.children?.name || s.id }); openModal("subscription-detail"); }}
                            className="p-1 text-slate-400 hover:text-slate-700 transition-colors"><Edit2 size={13} /></button>
                          <button onClick={() => handleDelete(s.id)}
                            className="p-1 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
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