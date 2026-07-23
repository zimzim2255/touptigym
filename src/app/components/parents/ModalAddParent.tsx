import { useState, useEffect } from "react";
import { Check, Plus } from "lucide-react";
import { Modal, Field, Btn, inputCls, selectCls } from "../shared/Primitives";
import { useApi } from "../../../hooks/useSupabase";
import { Child } from "../../types";

interface ParentData {
  name: string;
  phone: string;
  email: string;
  id_card: string;
  gender: string;
}

const emptyParent = { name: "", phone: "", email: "", id_card: "", gender: "" };

export function ModalAddParent({ onClose, onCreated }: { onClose: () => void; onCreated?: () => void }) {
  const api = useApi();
  const [loading, setLoading] = useState(false);
  const [children, setChildren] = useState<Child[]>([]);
  const [parents, setParents] = useState<ParentData[]>([{ ...emptyParent }]);
  const [selectedChildren, setSelectedChildren] = useState<string[]>([]);

  useEffect(() => {
    api.children.getAll().then(setChildren).catch(console.error);
  }, []);

  function setParentField(index: number, field: string, value: string) {
    setParents(prev => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  }

  function addParent() {
    setParents(prev => [...prev, { ...emptyParent }]);
  }

  function removeParent(index: number) {
    if (parents.length > 1) setParents(prev => prev.filter((_, i) => i !== index));
  }

  function toggleChild(childId: string) {
    setSelectedChildren(prev =>
      prev.includes(childId)
        ? prev.filter(id => id !== childId)
        : [...prev, childId]
    );
  }

  async function handleSubmit() {
    // Validate all parents
    for (const p of parents) {
      if (!p.name || !p.phone) {
        return alert("Veuillez remplir le nom et le téléphone pour chaque parent");
      }
    }

    setLoading(true);
    try {
      for (const p of parents) {
        const parent = await api.parents.create({
          name: p.name,
          phone: p.phone,
          email: p.email || null,
          id_card: p.id_card || null,
          gender: p.gender || null,
        });

        // Link selected children
        for (const childId of selectedChildren) {
          await api.parents.linkChild(parent.id, childId);
        }
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
        {parents.map((parent, idx) => (
          <div key={idx} className="border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Parent {parents.length > 1 ? `#${idx + 1}` : ""}
              </p>
              {parents.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeParent(idx)}
                  className="text-xs text-red-500 hover:underline"
                >
                  Supprimer
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nom complet" required>
                <input className={inputCls} placeholder="Prénom Nom" value={parent.name} onChange={e => setParentField(idx, "name", e.target.value)} />
              </Field>
              <Field label="Téléphone" required>
                <input className={inputCls} placeholder="06 XX XX XX XX" value={parent.phone} onChange={e => setParentField(idx, "phone", e.target.value)} />
              </Field>
              <Field label="Genre">
                <select className={selectCls} value={parent.gender} onChange={e => setParentField(idx, "gender", e.target.value)}>
                  <option value="">Sélectionner...</option>
                  <option value="Père">Père</option>
                  <option value="Mère">Mère</option>
                </select>
              </Field>
              <Field label="Email">
                <input type="email" className={inputCls} placeholder="email@exemple.com" value={parent.email} onChange={e => setParentField(idx, "email", e.target.value)} />
              </Field>
              <Field label="CIN">
                <input className={inputCls} placeholder="AB123456" value={parent.id_card} onChange={e => setParentField(idx, "id_card", e.target.value)} />
              </Field>
            </div>
          </div>
        ))}

        <Btn variant="ghost" onClick={addParent} className="w-full justify-center">
          <Plus size={13} /> Ajouter un autre parent
        </Btn>

        <Field label="Enfants liés">
          <div className="border border-slate-200 p-3 space-y-2 max-h-48 overflow-y-auto">
            {children.length === 0 ? (
              <p className="text-xs text-slate-400">Aucun enfant disponible</p>
            ) : (
              children.map(c => (
                <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-pink-500"
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