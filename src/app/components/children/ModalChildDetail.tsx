import { useState, useEffect } from "react";
import { Trash2, ArrowLeft } from "lucide-react";
import { Modal, Tag, Btn } from "../shared/Primitives";
import { useApi } from "../../../hooks/useSupabase";

export function ModalChildDetail({ childId, onClose, onDeleted }: { childId: string; onClose: () => void; onDeleted?: () => void }) {
  const api = useApi();
  const [child, setChild] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"info" | "parents" | "acces">("info");
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);

  useEffect(() => { loadData(); }, [childId]);

  async function loadData() {
    setLoading(true);
    try {
      const c = await api.children.getById(childId);
      let subs: any[] = [];
      let scheds: any[] = [];
      try { subs = await api.subscriptions.getAll({ child_id: childId }) || []; } catch {}
      try { scheds = await api.attendance.getSchedules(childId) || []; } catch {}
      setChild(c);
      setSubscriptions(subs || []);
      setSchedules(scheds || []);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Supprimer cet enfant ?")) return;
    try {
      await api.children.remove(childId);
      onDeleted?.();
      onClose();
    } catch (err: any) {
      alert(err.message);
    }
  }

  if (loading) return <Modal title="Chargement..." onClose={onClose} wide><p className="text-sm text-slate-500">Chargement...</p></Modal>;
  if (!child) return <Modal title="Erreur" onClose={onClose} wide><p className="text-sm text-red-500">Enfant introuvable</p></Modal>;

  const activeSub = subscriptions?.find((s: any) => s.status === "actif");
  const initials = child.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("");
  const tabs = [
    { id: "info" as const, label: "Infos Générales" },
    { id: "parents" as const, label: "Parents" },
    { id: "acces" as const, label: "Planning Accès" },
  ];

  return (
    <Modal title={`Détails — ${child.name}`} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="border border-slate-200 p-4">
          <div className="flex items-center gap-4">
            {child.photo ? (
              <img src={child.photo} alt="" className="w-14 h-14 object-cover border border-slate-200 rounded-full" />
            ) : (
              <div className="w-14 h-14 bg-slate-100 flex items-center justify-center text-slate-400 text-xl font-bold border border-slate-200">
                {initials}
              </div>
            )}
            <div>
              <p className="font-semibold text-slate-900">{child.name}</p>
              <p className="text-sm text-slate-500">{child.gender} · {child.age} ans</p>
              {child.zkteco_id && <p className="text-xs font-mono text-slate-400 mt-0.5">ZKTeco ID: {child.zkteco_id}</p>}
            </div>
            <div className="ml-auto">
              {activeSub ? <Tag color="green">Actif</Tag> : <Tag color="red">Inactif</Tag>}
            </div>
          </div>
        </div>

        <div className="flex border-b border-slate-200">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? "border-orange-500 text-orange-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
            >{t.label}</button>
          ))}
        </div>

        {tab === "info" && (
          <div className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              <div><span className="text-slate-500">École :</span> <span className="text-slate-900">{child.school || "—"}</span></div>
              <div><span className="text-slate-500">Type école :</span> <span className="text-slate-900">{child.school_type || "—"}</span></div>
              <div><span className="text-slate-500">Adresse :</span> <span className="text-slate-900">{child.address || "—"}</span></div>
              <div><span className="text-slate-500">CP :</span> <span className="text-slate-900">{child.postal_code || "—"}</span></div>
              <div><span className="text-slate-500">Type client :</span> <span className="text-slate-900">{child.client_type}</span></div>
            </div>
            {activeSub && (
              <div className="mt-3 p-3 border border-slate-200 bg-slate-50">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Abonnement actif</p>
                <p className="text-sm text-slate-900">{activeSub.type} — {Number(activeSub.amount).toLocaleString()} Dhs</p>
                <p className="text-xs text-slate-500 mt-0.5">Valide du {activeSub.start_date} au {activeSub.end_date}</p>
              </div>
            )}
          </div>
        )}

        {tab === "parents" && (
          <div className="text-sm text-slate-500 p-3">Parents liés — à venir</div>
        )}

        {tab === "acces" && (
          <div className="text-sm">
            {schedules.length === 0 ? (
              <p className="text-slate-500 p-3">Aucun planning d'accès configuré.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="pb-2 text-xs font-semibold text-slate-500 uppercase">Jour</th>
                    <th className="pb-2 text-xs font-semibold text-slate-500 uppercase">Début</th>
                    <th className="pb-2 text-xs font-semibold text-slate-500 uppercase">Fin</th>
                    <th className="pb-2 text-xs font-semibold text-slate-500 uppercase">Fenêtre</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map((s: any) => {
                    const days = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
                    return (
                      <tr key={s.id} className="border-b border-slate-100">
                        <td className="py-2 text-slate-800">{days[s.weekday]}</td>
                        <td className="py-2 font-mono text-slate-600">{s.start_time.substring(0, 5)}</td>
                        <td className="py-2 font-mono text-slate-600">{s.end_time.substring(0, 5)}</td>
                        <td className="py-2 text-slate-500 text-xs">{s.window_before}min → {s.window_after}min</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-2 border-t border-slate-100">
          <Btn size="sm" variant="danger" onClick={handleDelete}><Trash2 size={12} /> Supprimer</Btn>
          <Btn size="sm" variant="ghost" className="ml-auto" onClick={onClose}><ArrowLeft size={12} /> Retour</Btn>
        </div>
      </div>
    </Modal>
  );
}