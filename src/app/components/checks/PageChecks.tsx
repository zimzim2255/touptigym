import { useState, useMemo, useEffect, useCallback } from "react";
import { Search, Plus, Eye, Trash2 } from "lucide-react";
import { PageWrap, Btn, inputCls, Pagination } from "../shared/Primitives";
import { useApi } from "../../../hooks/useSupabase";
import { ModalType, Check } from "../../types";

interface Props {
  canEdit?: boolean;
  openModal: (m: ModalType) => void;
  setSelectedCheck: (c: Check) => void;
  onRefresh?: number;
}

export function PageChecks({ canEdit, openModal, setSelectedCheck, onRefresh }: Props) {
  const api = useApi();
  const [q, setQ] = useState("");
  const [checks, setChecks] = useState<Check[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data: Check[] = await api.checks.getAll();
      setChecks(data);
    } catch (err: any) {
      console.error("Failed to load checks:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh, onRefresh]);

  const list = useMemo(() => {
    if (!q) return checks;
    return checks.filter(c =>
      c.number.toLowerCase().includes(q.toLowerCase()) ||
      (c.bank && c.bank.toLowerCase().includes(q.toLowerCase())) ||
      (c.account_holder && c.account_holder.toLowerCase().includes(q.toLowerCase()))
    );
  }, [checks, q]);

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return list.slice(start, start + PAGE_SIZE);
  }, [list, page]);

  useEffect(() => { setPage(1); }, [q]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  return (
    <PageWrap
      title="Gestion des Chèques"
      sub={`${checks.length} chèques enregistrés`}
      action={canEdit && <Btn onClick={() => openModal("add-check")}><Plus size={13} /> Ajouter</Btn>}
    >
      <div className="bg-white border border-slate-200">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher par numéro, banque..." className={`${inputCls} pl-8`} />
          </div>
        </div>
        {loading ? (
          <div className="p-6 text-sm text-slate-500 text-center">Chargement...</div>
        ) : list.length === 0 ? (
          <div className="p-6 text-sm text-slate-500 text-center">Aucun chèque trouvé.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {["N°", "Montant", "Utilisé", "Reste", "Banque", "Titulaire", "Émission", "Exécution", "Statut", ""].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginated.map(c => {
                const emis = c.date_emission ? new Date(c.date_emission).toLocaleDateString("fr-FR") : "—";
                const exec = c.date_execution ? new Date(c.date_execution).toLocaleDateString("fr-FR") : "—";
                const rest = c.amount - c.montant_used;
                return (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-semibold text-slate-900">#{c.number}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{c.amount.toLocaleString()} Dhs</td>
                    <td className="px-4 py-3 text-slate-500">{c.montant_used.toLocaleString()} Dhs</td>
                    <td className="px-4 py-3 font-semibold text-emerald-600">{rest.toLocaleString()} Dhs</td>
                    <td className="px-4 py-3 text-slate-500">{c.bank || "—"}</td>
                    <td className="px-4 py-3 text-slate-500">{c.account_holder || "—"}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{emis}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{exec}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 text-xs font-medium ${
                        c.used
                          ? "bg-red-50 text-red-700 border border-red-200"
                          : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      }`}>
                        {c.used ? "Utilisé" : "Disponible"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => { setSelectedCheck(c); openModal("check-detail"); }}
                          className="p-1 text-slate-400 hover:text-orange-500 transition-colors"><Eye size={13} /></button>
                        {canEdit && (
                          <button onClick={async () => {
                            if (confirm("Supprimer ce chèque ?")) {
                              try {
                                await api.checks.remove(c.id);
                                refresh();
                              } catch (err: any) {
                                alert(err.message);
                              }
                            }
                          }} className="p-1 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
                        )}
                      </div>
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
