import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Filter, Check, X, Search, Download, FileText, FileSpreadsheet } from "lucide-react";
import { PageWrap, Tag, inputCls, selectCls, Btn, Field, Modal, Pagination } from "../shared/Primitives";
import { useApi } from "../../../hooks/useSupabase";

interface Absence {
  id: string;
  child_id: string;
  exercise_id: string;
  date: string;
  type: string;
  justified: boolean;
  justification: string | null;
  created_at: string;
  children?: { name: string };
  exercises?: { name: string };
}

interface Props {
  openModal: (m: any) => void;
  setSelectedAbsence: (a: Absence) => void;
}

export function PageAbsences({ openModal, setSelectedAbsence }: Props) {
  const api = useApi();
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [exercises, setExercises] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("");
  const [searchName, setSearchName] = useState("");
  const [filterExercise, setFilterExercise] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const tableRef = useRef<HTMLTableElement>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [data, exData] = await Promise.all([
        api.attendance.getAbsences(),
        api.exercises.getAll(),
      ]);
      setAbsences(data);
      setExercises(exData.map((e: any) => ({ id: e.id, name: e.name })));
    } catch (err: any) {
      console.error("Failed to load absences:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const list = useMemo(() => {
    let filtered = absences;

    if (filterType) {
      filtered = filtered.filter(a => a.type === filterType);
    }

    if (searchName) {
      const q = searchName.toLowerCase();
      filtered = filtered.filter(a => a.children?.name?.toLowerCase().includes(q));
    }

    if (filterExercise) {
      filtered = filtered.filter(a => a.exercise_id === filterExercise);
    }

    if (dateStart) {
      filtered = filtered.filter(a => a.date >= dateStart);
    }

    if (dateEnd) {
      filtered = filtered.filter(a => a.date <= dateEnd);
    }

    return filtered;
  }, [absences, filterType, searchName, filterExercise, dateStart, dateEnd]);

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return list.slice(start, start + PAGE_SIZE);
  }, [list, page]);

  useEffect(() => { setPage(1); }, [filterType, searchName, filterExercise, dateStart, dateEnd]);

  const totalAbsences = list.filter(a => a.type === "absence").length;
  const totalRetards = list.filter(a => a.type === "retard").length;
  const totalDeparts = list.filter(a => a.type === "depart_anticipe").length;

  // ─── Export helpers ────────────────────────────────────────────────────
  function exportCSV() {
    const headers = ["Enfant", "Date", "Activité", "Type", "Justifié", "Justification"];
    const rows = list.map(a => [
      a.children?.name || "",
      a.date,
      a.exercises?.name || "",
      a.type,
      a.justified ? "Oui" : "Non",
      a.justification || "",
    ]);

    let csv = headers.join(",") + "\n";
    rows.forEach(row => {
      csv += row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(",") + "\n";
    });

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `absences_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPDF() {
    // Simple print-based PDF export
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const styles = `
      <style>
        body { font-family: 'DM Sans', sans-serif; padding: 20px; }
        h1 { font-size: 18px; margin-bottom: 5px; }
        p { color: #666; font-size: 12px; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th { background: #f1f5f9; text-align: left; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
        td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
        .total { margin-top: 15px; font-size: 12px; font-weight: bold; }
      </style>
    `;

    const tableRows = list.map(a => `
      <tr>
        <td>${a.children?.name || "—"}</td>
        <td>${a.date}</td>
        <td>${a.exercises?.name || "—"}</td>
        <td>${a.type.replace("_", " ")}</td>
        <td>${a.justified ? "Oui" : "Non"}</td>
      </tr>
    `).join("");

    const title = dateStart || dateEnd
      ? `Absences du ${dateStart || "début"} au ${dateEnd || "aujourd'hui"}`
      : "Toutes les absences";

    printWindow.document.write(`
      <html><head><title>Absences</title>${styles}</head><body>
        <h1>Rapport d'absences — TouptiGym</h1>
        <p>${title} — Total: ${list.length} enregistrements</p>
        <table>
          <thead><tr><th>Enfant</th><th>Date</th><th>Activité</th><th>Type</th><th>Justifié</th></tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
        <div class="total">
          Absences: ${totalAbsences} | Retards: ${totalRetards} | Départs anticipés: ${totalDeparts}
        </div>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  return (
    <PageWrap title="Présences & Absences" sub="Historique des présences">
      {/* ── Filters ── */}
      <div className="bg-white border border-slate-200 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Recherche</p>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className={`${inputCls} pl-8`}
                placeholder="Nom de l'enfant..."
                value={searchName}
                onChange={e => setSearchName(e.target.value)}
              />
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Type</p>
            <select className={`${selectCls} text-xs`} value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="">Tous les types</option>
              <option value="absence">Absence</option>
              <option value="retard">Retard</option>
              <option value="depart_anticipe">Départ anticipé</option>
            </select>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Activité</p>
            <select className={`${selectCls} text-xs`} value={filterExercise} onChange={e => setFilterExercise(e.target.value)}>
              <option value="">Toutes les activités</option>
              {exercises.map(ex => (
                <option key={ex.id} value={ex.id}>{ex.name}</option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Date début</p>
            <input type="date" className={inputCls} value={dateStart} onChange={e => setDateStart(e.target.value)} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Date fin</p>
            <input type="date" className={inputCls} value={dateEnd} onChange={e => setDateEnd(e.target.value)} />
          </div>
          <div className="flex items-end gap-1">
            <Btn size="sm" variant="ghost" onClick={exportCSV}>
              <FileSpreadsheet size={12} /> CSV
            </Btn>
            <Btn size="sm" variant="ghost" onClick={exportPDF}>
              <FileText size={12} /> PDF
            </Btn>
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      {list.length > 0 && (
        <div className="flex gap-4 text-sm">
          <div className="bg-white border border-slate-200 px-4 py-2.5 flex items-center gap-2">
            <span className="text-slate-500">Absences:</span>
            <span className="font-bold text-pink-600">{totalAbsences}</span>
          </div>
          <div className="bg-white border border-slate-200 px-4 py-2.5 flex items-center gap-2">
            <span className="text-slate-500">Retards:</span>
            <span className="font-bold text-amber-600">{totalRetards}</span>
          </div>
          <div className="bg-white border border-slate-200 px-4 py-2.5 flex items-center gap-2">
            <span className="text-slate-500">Départs anticipés:</span>
            <span className="font-bold text-blue-600">{totalDeparts}</span>
          </div>
          <div className="bg-white border border-slate-200 px-4 py-2.5 flex items-center gap-2">
            <span className="text-slate-500">Total:</span>
            <span className="font-bold text-slate-900">{list.length}</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="p-6 text-sm text-slate-500 text-center">Chargement...</div>
      ) : list.length === 0 ? (
        <div className="p-6 text-sm text-slate-500 text-center">Aucune absence trouvée.</div>
      ) : (
        <div className="bg-white border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm" ref={tableRef}>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {["Enfant", "Date", "Activité", "Type", "Justifié", ""].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginated.map(a => (
                <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">{a.children?.name || "—"}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{a.date}</td>
                  <td className="px-4 py-3 text-slate-500">{a.exercises?.name || "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Tag color={a.type === "absence" ? "red" : a.type === "retard" ? "amber" : "blue"}>
                      {a.type.replace("_", " ")}
                    </Tag>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {a.justified ? (
                        <Check size={13} className="text-emerald-500" />
                      ) : (
                        <X size={13} className="text-red-400" />
                      )}
                      {a.justified && a.justification && (
                        <span className="text-xs text-slate-400 truncate max-w-24">{a.justification}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {!a.justified && (
                      <button
                        onClick={() => { setSelectedAbsence(a); openModal("justify-absence"); }}
                        className="text-xs text-pink-600 hover:underline"
                      >
                        Justifier
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!loading && list.length > 0 && (
        <Pagination total={list.length} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
      )}
    </PageWrap>
  );
}
