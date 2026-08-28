import { useState, useEffect, useCallback, useMemo } from "react";
import { Search, Plus, Trash2, Check, X, KeyRound } from "lucide-react";
import { PageWrap, Btn, Tag, inputCls, Pagination, Modal, Field } from "../shared/Primitives";
import { useApi } from "../../../hooks/useSupabase";

interface User { id: string; email: string; name: string; role: string; active: boolean; created_at: string; }
const ROLE_LABELS: Record<string, string> = { admin: "Administrateur", worker: "Employé", trainer: "Entraîneur", parent: "Parent" };

function ModalAddEmploye({ onClose, onCreated }: { onClose: () => void; onCreated?: () => void }) {
  const api = useApi();
  const [name, setName] = useState(""); const [email, setEmail] = useState("");
  const [password, setPassword] = useState(""); const [role, setRole] = useState("worker");
  const [loading, setLoading] = useState(false);
  async function handleSubmit() {
    if (!name.trim() || !email.trim() || !password) return alert("Tous les champs sont requis");
    setLoading(true);
    try { await api.users.create({ name, email, password, role }); onCreated?.(); onClose(); }
    catch (err: any) { alert(err.message); } finally { setLoading(false); }
  }
  return (
    <Modal title="Créer un compte" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Nom complet" required><input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Ahmed Alaoui" /></Field>
        <Field label="Email" required><input type="email" className={inputCls} value={email} onChange={e => setEmail(e.target.value)} placeholder="employe@gym.com" /></Field>
        <Field label="Mot de passe" required><input type="password" className={inputCls} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" /></Field>
        <Field label="Rôle" required>
          <select className={inputCls} value={role} onChange={e => setRole(e.target.value)}>
            <option value="worker">Employé</option><option value="admin">Administrateur</option>
          </select>
        </Field>
        <div className="flex gap-3 pt-2 border-t border-slate-100">
          <Btn onClick={handleSubmit} disabled={loading}>{loading ? "Création..." : <><Check size={13} /> Créer le compte</>}</Btn>
          <Btn variant="outline" onClick={onClose}>Annuler</Btn>
        </div>
      </div>
    </Modal>
  );
}

export function PageEmployes({ onRefresh }: { onRefresh?: number }) {
  const api = useApi();
  const [users, setUsers] = useState<User[]>([]); const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true); const [showAdd, setShowAdd] = useState(false);
  const [page, setPage] = useState(1); const PAGE_SIZE = 50;
  const [resetPw, setResetPw] = useState<{ id: string; name: string } | null>(null); const [newPw, setNewPw] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try { setUsers(await api.users.getAll()); } catch (err: any) { console.error("Failed to load users:", err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh, onRefresh]);

  const list = useMemo(() => {
    if (!q) return users;
    const lq = q.toLowerCase();
    return users.filter(u => u.name.toLowerCase().includes(lq) || u.email.toLowerCase().includes(lq));
  }, [users, q]);

  const paginated = useMemo(() => list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [list, page]);
  useEffect(() => { setPage(1); }, [q]);

  async function toggleActive(u: User) { await api.users.update(u.id, { active: !u.active }); refresh(); }
  async function handleResetPw() {
    if (!resetPw || !newPw) return;
    try { await api.users.update(resetPw.id, { password: newPw }); alert("Mot de passe réinitialisé"); setResetPw(null); setNewPw(""); }
    catch (err: any) { alert(err.message); }
  }
  async function handleDelete(u: User) {
    if (!confirm(`Supprimer le compte de ${u.name} ?`)) return;
    try { await api.users.remove(u.id); refresh(); } catch (err: any) { alert(err.message); }
  }

  return (
    <PageWrap title="Comptes Employés" sub={`${users.length} comptes`}
      action={<Btn onClick={() => setShowAdd(true)}><Plus size={13} /> Créer un compte</Btn>}>
      <div className="bg-white border border-slate-200">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher..." className={`${inputCls} pl-8`} />
          </div>
        </div>
        {loading ? <div className="p-6 text-sm text-slate-500 text-center">Chargement...</div>
        : list.length === 0 ? <div className="p-6 text-sm text-slate-500 text-center">Aucun compte trouvé.</div>
        : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200 bg-slate-50">
              {["Nom", "Email", "Rôle", "Statut", "Créé le", ""].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {paginated.map(u => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">{u.name}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{u.email}</td>
                  <td className="px-4 py-3"><Tag color={u.role === "admin" ? "red" : u.role === "trainer" ? "blue" : "green"}>{ROLE_LABELS[u.role] || u.role}</Tag></td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleActive(u)}>
                      {u.active ? <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200"><Check size={10} /> Actif</span>
                      : <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-red-50 text-red-700 border border-red-200"><X size={10} /> Inactif</span>}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">{new Date(u.created_at).toLocaleDateString("fr-FR")}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => setResetPw({ id: u.id, name: u.name })} className="p-1 text-slate-400 hover:text-amber-500 transition-colors" title="Réinitialiser mot de passe"><KeyRound size={13} /></button>
                      <button onClick={() => handleDelete(u)} className="p-1 text-slate-400 hover:text-red-500 transition-colors" title="Supprimer"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && list.length > 0 && <Pagination total={list.length} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />}
      </div>
      {showAdd && <ModalAddEmploye onClose={() => setShowAdd(false)} onCreated={refresh} />}
    </PageWrap>
  );
}