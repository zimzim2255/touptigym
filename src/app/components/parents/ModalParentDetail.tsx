import { useState, useEffect } from "react";
import { Check, Trash2, Plus } from "lucide-react";
import { Modal, Tag, Btn, Field, inputCls } from "../shared/Primitives";
import { useApi } from "../../../hooks/useSupabase";
import { ParentDetail, Child } from "../../types";

export function ModalParentDetail({ parentId, onClose, onUpdated, startEditing = false }: { parentId: string; onClose: () => void; onUpdated?: () => void; startEditing?: boolean }) {
  const api = useApi();
  const [parent, setParent] = useState<ParentDetail | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", id_card: "" });
  const [selectedChildren, setSelectedChildren] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, [parentId]);

  async function loadData() {
    setLoading(true);
    try {
      const [parentData, childrenData] = await Promise.all([
        api.parents.getById(parentId),
        api.children.getAll(),
      ]);
      setParent(parentData);
      setChildren(childrenData);
      setForm({
        name: parentData.name,
        phone: parentData.phone,
        email: parentData.email || "",
        id_card: parentData.id_card || "",
      });
      const linkedIds = (parentData.parent_children || []).map((pc: any) => pc.child_id);
      setSelectedChildren(linkedIds);
      if (startEditing) setEditing(true);
    } catch (err: any) {
      console.error("Failed to load parent:", err);
    } finally {
      setLoading(false);
    }
  }

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function toggleChild(childId: string) {
    setSelectedChildren(prev =>
      prev.includes(childId)
        ? prev.filter(id => id !== childId)
        : [...prev, childId]
    );
  }

  async function handleSave() {
    if (!form.name || !form.phone) return;
    try {
      await api.parents.update(parentId, {
        name: form.name,
        phone: form.phone,
        email: form.email || null,
        id_card: form.id_card || null,
      });

      // Sync child links
      const currentIds = (parent?.parent_children || []).map((pc: any) => pc.child_id);
      // Remove unlinked
      for (const cid of currentIds) {
        if (!selectedChildren.includes(cid)) {
          await api.parents.unlinkChild(parentId, cid);
        }
      }
      // Add newly linked
      for (const cid of selectedChildren) {
        if (!currentIds.includes(cid)) {
          await api.parents.linkChild(parentId, cid);
        }
      }

      setEditing(false);
      onUpdated?.();
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleDelete() {
    if (!confirm("Supprimer ce parent ? Cette action est irréversible.")) return;
    try {
      await api.parents.remove(parentId);
      onUpdated?.();
      onClose();
    } catch (err: any) {
      alert(err.message);
    }
  }

  const linkedChildren = children.filter(c => selectedChildren.includes(c.id));

  if (loading) {
    return (
      <Modal title="Détails du Parent" onClose={onClose}>
        <div className="p-6 text-sm text-slate-500 text-center">Chargement...</div>
      </Modal>
    );
  }

  if (!parent) {
    return (
      <Modal title="Détails du Parent" onClose={onClose}>
        <div className="p-6 text-sm text-red-500 text-center">Parent introuvable.</div>
      </Modal>
    );
  }

  return (
    <Modal title={editing ? "Modifier le Parent" : "Détails du Parent"} onClose={onClose} wide>
      {editing ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nom complet" required>
              <input className={inputCls} value={form.name} onChange={e => set("name", e.target.value)} />
            </Field>
            <Field label="Téléphone" required>
              <input className={inputCls} value={form.phone} onChange={e => set("phone", e.target.value)} />
            </Field>
            <Field label="Email">
              <input type="email" className={inputCls} value={form.email} onChange={e => set("email", e.target.value)} />
            </Field>
            <Field label="CIN">
              <input className={inputCls} value={form.id_card} onChange={e => set("id_card", e.target.value)} />
            </Field>
          </div>
          <Field label="Enfants liés">
            <div className="border border-slate-200 p-3 space-y-2 max-h-48 overflow-y-auto">
              {children.map(c => (
                <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-orange-500"
                    checked={selectedChildren.includes(c.id)}
                    onChange={() => toggleChild(c.id)}
                  />
                  <span>{c.name} ({c.age} ans)</span>
                </label>
              ))}
            </div>
          </Field>
          <div className="flex gap-3 pt-2 border-t border-slate-100">
            <Btn onClick={handleSave}><Check size={13} /> Enregistrer</Btn>
            <Btn variant="outline" onClick={() => setEditing(false)}>Annuler</Btn>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="border border-slate-200 p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Nom</span><span className="font-medium text-slate-900">{parent.name}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Téléphone</span><span className="text-slate-900">{parent.phone}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Email</span><span className="text-slate-900">{parent.email || "—"}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">CIN</span><span className="font-mono text-slate-900">{parent.id_card || "—"}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Créé le</span><span className="text-slate-400 text-xs">{new Date(parent.created_at).toLocaleDateString()}</span></div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Enfants liés ({linkedChildren.length})</p>
            {linkedChildren.length === 0 ? (
              <p className="text-xs text-slate-400">Aucun enfant lié</p>
            ) : (
              <div className="border border-slate-200 divide-y divide-slate-100">
                {linkedChildren.map(c => (
                  <div key={c.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
                    <span className="text-slate-800">{c.name}</span>
                    <Tag color={c.client_type === "VIP" ? "default" : "gray"}>{c.client_type}</Tag>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2 border-t border-slate-100">
            <Btn variant="outline" onClick={() => setEditing(true)}><Plus size={13} /> Modifier</Btn>
            <Btn variant="danger" onClick={handleDelete}><Trash2 size={13} /> Supprimer</Btn>
            <Btn variant="outline" onClick={onClose}>Fermer</Btn>
          </div>
        </div>
      )}
    </Modal>
  );
}