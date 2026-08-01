import { useState, useEffect, useCallback, useMemo } from "react";
import { Search, TrendingUp, AlertCircle, CreditCard } from "lucide-react";
import { PageWrap, Btn, Tag, inputCls, Pagination } from "../shared/Primitives";
import { useApi } from "../../../hooks/useSupabase";

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
  children?: { name: string };
}

interface Props {
  openPayModal: (s: Subscription) => void;
  onRefresh?: number;
}

export function PagePaiements({ openPayModal, onRefresh }: Props) {
  const api = useApi();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data: Subscription[] = await api.subscriptions.getAll();
      setSubscriptions(data);
    } catch (err: any) {
      console.error("Failed to load:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh, onRefresh]);

  const list = useMemo(() => {
    if (!q) return subscriptions;
    const lq = q.toLowerCase();
    return subscriptions.filter(s =>
      (s.children?.name || "").toLowerCase().includes(lq)
    );
  }, [subscriptions, q]);

  // Reset to page 1 when search changes
  useEffect(() => { setPage(1); }, [q]);

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return list.slice(start, start + PAGE_SIZE);
  }, [list, page]);

  const totalReceivable = subscriptions.reduce((sum, s) => {
    const total = s.amount - s.discount + s.insurance + s.entry_fee;
    return sum + (total - (s.paid_amount || 0));
  }, 0);

  const totalCollected = subscriptions.reduce((sum, s) => sum + (s.paid_amount || 0), 0);
  const overdue = subscriptions.filter(s => {
    const total = s.amount - s.discount + s.insurance + s.entry_fee;
    return (s.paid_amount || 0) < total && s.status === "actif";
  });

  return (
    <PageWrap
      title="Paiements"
      sub={`${overdue.length} abonnements avec reliquat`}
    >
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-px bg-slate-200">
        {[
          { label: "Total collecté", value: `${totalCollected.toLocaleString()} Dhs`, icon: CreditCard },
          { label: "Restant à recevoir", value: `${totalReceivable.toLocaleString()} Dhs`, icon: TrendingUp },
          { label: "Abonnements avec reste", value: overdue.length.toString(), icon: AlertCircle },
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
        </div>
        {loading ? (
          <div className="p-6 text-sm text-slate-500 text-center">Chargement...</div>
        ) : list.length === 0 ? (
          <div className="p-6 text-sm text-slate-500 text-center">Aucun abonnement.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {["Enfant", "Abonnement", "Total dû", "Payé", "Reste", "Statut", ""].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginated.map(s => {
                const total = s.amount - s.discount + s.insurance + s.entry_fee;
                const paid = s.paid_amount || 0;
                const rest = total - paid;
                const isFullyPaid = rest <= 0;

                return (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900">{s.children?.name || "—"}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{s.type}{s.sub_type ? ` — ${s.sub_type}` : ""}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{total.toLocaleString()} Dhs</td>
                    <td className="px-4 py-3 text-emerald-600">{paid.toLocaleString()} Dhs</td>
                    <td className="px-4 py-3">
                      <span className={isFullyPaid ? "text-emerald-600" : "text-orange-600 font-semibold"}>
                        {isFullyPaid ? "Payé" : `${rest.toLocaleString()} Dhs`}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Tag color={s.status === "actif" ? "green" : s.status === "expiré" ? "red" : "amber"}>{s.status}</Tag>
                    </td>
                    <td className="px-4 py-3">
                      {!isFullyPaid && (
                        <Btn size="sm" onClick={() => openPayModal(s)}>
                          <CreditCard size={11} /> Payer
                        </Btn>
                      )}
                    </td>
                  </tr>
                );
              })}
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
