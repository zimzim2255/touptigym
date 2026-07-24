import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { Modal, Field, Btn, inputCls } from "../shared/Primitives";
import { useApi } from "../../../hooks/useSupabase";
import { Group } from "../../types";

interface Props {
  group: Group;
  onClose: () => void;
  onUpdated?: () => void;
}

export function ModalEditGroup({ group, onClose, onUpdated }: Props) {
  const api = useApi();
  const [name, setName] = useState(group.name);
  let initialItems: string[] = [];
  try {
    if (group.description) initialItems = JSON.parse(group.description);
  } catch { initialItems = []; }
  const [items, setItems] = useState<string[]>(initialItems.length > 0 ? initialItems : [""]);
  const [loading, setLoading] = useState(false);

  function addItem() {
    setItems([...items, ""]);
  }

  function updateItem(i: number, value: string) {
    setItems(items.map((item, idx) => (idx === i ? value : item)));
  }

  function removeItem(i: number) {
    if (items.length > 1) setItems(items.filter((_, idx) => idx !== i));
  }

  async function handleSubmit() {
    if (!name.trim()) return alert("Veuillez saisir un nom pour le groupe");
    const validItems = items.filter(i => i.trim());
    if (validItems.length === 0) return alert("Ajoutez au moins un élément au groupe");

    setLoading(true);
    try {
      await api.groups.update(group.id, {
        name: name.trim(),
        description: JSON.stringify(validItems),
      });
      onUpdated?.();
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Modifier le Groupe" onClose={onClose} wide>
      <div className="space-y-4">
        <Field label="Nom du activité" required>
          <input
            className={inputCls}
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </Field>

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Activité</p>
            <Btn size="sm" variant="ghost" onClick={addItem}><Plus size={12} /> Ajouter</Btn>
          </div>
          <div className="border border-slate-200 divide-y divide-slate-100">
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-2 px-4 py-2.5">
                <input
                  className={`${inputCls} flex-1`}
                  value={item}
                  onChange={e => updateItem(i, e.target.value)}
                />
                {items.length > 1 && (
                  <button onClick={() => removeItem(i)} className="p-1 text-slate-400 hover:text-red-500 transition-colors shrink-0">
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2 border-t border-slate-100">
          <Btn onClick={handleSubmit} disabled={loading}>
            {loading ? "Enregistrement..." : <><Check size={13} /> Enregistrer</>}
          </Btn>
          <Btn variant="outline" onClick={onClose}>Annuler</Btn>
        </div>
      </div>
    </Modal>
  );
}