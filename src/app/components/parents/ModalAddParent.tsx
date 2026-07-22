import { useState, useEffect } from "react";
import { Check } from "lucide-react";
import { Modal, Field, Btn, inputCls } from "../shared/Primitives";
import { useApi } from "../../../hooks/useSupabase";
import { Child } from "../../types";

export function ModalAddParent({ onClose, onCreated }: { onClose: () => void; onCreated?: () => void }) {
  const api = useApi();
  const [loading, setLoading] = useState(false);
  const [children, setChildren] = useState<Child[]>([]);
  const [form, setForm] = useState({
    name: "", phone: "", email: "", id_card: "",
  });
  const [selectedChildren, setSelectedChildren] = useState<string[]>([]);

  useEffect(() => {
    api.children.getAll().then(setChildren).catch(console.error);
  }, []);

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

  async function handleSubmit() {
    if (!form.name || !form.phone) return;
    setLoading(true);
    try {
      const parent = await api.parents.create({
        name: form.name,
        phone: form.phone,
        email: form.email || null,
        id_card: form.id_card || null,
      });

      // Link selected children
      for (const childId of selectedChildren) {
        await api.parents.linkChild(parent.id, childId);
      }

      onCreated?.();
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Ajouter un Parent" onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nom complet" required>
            <input className={inputCls} placeholder="Prénom Nom" value={form.name} onChange={e => set("name", e.target.value)} />
          </Field>
          <Field label="Téléphone" required>
            <input className={inputCls} placeholder="06 XX XX XX XX" value={form.phone} onChange={e => set("phone", e.target.value)} />
          </Field>
          <Field label="Email">
            <input type="email" className={inputCls} placeholder="email@exemple.com" value={form.email} onChange={e => set("email", e.target.value)} />
          </Field>
          <Field label="CIN">
            <input className={inputCls} placeholder="AB123456" value={form.id_card} onChange={e => set("id_card", e.target.value)} />
          </Field>
        </div>
        <Field label="Enfants liés">
          <div className="border border-slate-200 p-3 space-y-2 max-h-48 overflow-y-auto">
            {children.length === 0 ? (
              <p className="text-xs text-slate-400">Aucun enfant disponible</p>
            ) : (
              children.map(c => (
                <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-orange-500"
                    checked={selectedChildren.includes(c.id)}
                    onChange={() => toggleChild(c.id)}
                  />
                  <span>{c.name} ({c.age} ans)</span>
                </label>
              ))
            )}
          </div>
        </Field>
        <div className="flex gap-3 pt-2 border-t border-slate-100">
          <Btn onClick={handleSubmit} disabled={loading}>
            {loading ? "Création..." : <><Check size={13} /> Créer</>}
          </Btn>
          <Btn variant="outline" onClick={onClose}>Annuler</Btn>
        </div>
      </div>
    </Modal>
  );
}