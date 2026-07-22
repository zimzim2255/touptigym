import { useState, useMemo, useEffect, useCallback } from "react";
import { Search, Plus, Filter, Eye, Edit2, Trash2, Check, X } from "lucide-react";
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
  status: string;
  exercises: string[];
  start_date: string;
  end_date: string;
  created_at: string;
  children?: { name: string };
}

interface Props {
  canConfirm?: boolean;
  openModal: (m: ModalType) => void;
  setSelectedSubscription: (s: { id: string; name: string }) => void;
  onRefresh?: number;
}

export function PageAbonnements({ canConfirm, openModal, setSelectedSubscription, onRefresh }: Props) {
  const api = useApi();
  const [q, setQ] = useState("");
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState(0);

  const active = subscriptions.filter(s => s.status === "actif").length;
  const expired = subscriptions.filter(s => s.status === "expiré" || s.status === "résilié").length;
  const pending = subscriptions.filter(s => s.status === "en_attente").length;
  const totalRevenue = subscriptions.reduce((sum, s) => sum + (s.amount - s.discount + s.insurance + s.entry_fee), 0);

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
    if (!q) return subscriptions;
    const lq = q.toLowerCase();
    return subscriptions.filter(s =>
      (s.children?.name || "").toLowerCase().includes(lq) ||
      s.type.toLowerCase().includes(lq)
    );
  }, [subscriptions, q]);

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

  // Compute dynamic status based on dates
  function computeStatus(s: Subscription): string {
    if (s.status === "résilié") return "résilié";
    if (s.status === "en_attente") return "en_attente";
    const now = new Date();
    const end = new Date(s.end_date);
    if (end < now) return "expiré";
    return "actif";
  }

  return (
    <PageWrap
      title="Abonnements"
      sub={`${count} abonnements enregistrés`}
      action={canConfirm && <Btn onClick={() => openModal("add-subscription")}><Plus size={13} /> Nouvel abonnement</Btn>}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-200">
        {[
          { label: "Actifs", value: active.toString(), icon: Check },
          { label: "En attente", value: pending.toString(), icon: X },
          { label: "Expirés/Résiliés", value: expired.toString(), icon: X },
          { label: "Total encaissé", value: `${totalRevenue.toLocaleString()} Dhs`, icon: Plus },
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
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher par enfant..." className={`${inputCls} pl-8`} />
          </div>
          <Btn size="sm" variant="ghost"><Filter size={12} /> Filtrer</Btn>
        </div>
        {loading ? (
          <div className="p-6 text-sm text-slate-500 text-center">Chargement...</div>
        ) : list.length === 0 ? (
          <div className="p-6 text-sm text-slate-500 text-center">Aucun abonnement trouvé.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {["Enfant", "Type", "Montant", "Remise", "Total", "Validité", "Statut", "Actions"].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map(s => {
                const status = computeStatus(s);
                const total = s.amount - s.discount + s.insurance + s.entry_fee;
                return (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900">{s.children?.name || "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{s.type}{s.sub_type ? ` — ${s.sub_type}` : ""}</td>
                    <td className="px-4 py-3 text-slate-500">{s.amount.toLocaleString()} Dhs</td>
                    <td className="px-4 py-3 text-orange-600 text-xs">{s.discount > 0 ? `−${s.discount.toLocaleString()} Dhs` : "—"}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{total.toLocaleString()} Dhs</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{s.start_date} → {s.end_date}</td>
                    <td className="px-4 py-3">
                      <Tag color={status === "actif" ? "green" : status === "expiré" || status === "résilié" ? "red" : "amber"}>{status}</Tag>
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