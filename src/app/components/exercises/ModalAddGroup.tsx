import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { Modal, Field, Btn, inputCls } from "../shared/Primitives";
import { useApi } from "../../../hooks/useSupabase";

interface Props {
  onClose: () => void;
  onCreated?: () => void;
}

export function ModalAddGroup({ onClose, onCreated }: Props) {
  const api = useApi();
  const [name, setName] = useState("");
  const [items, setItems] = useState<string[]>([""]);
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
      await api.groups.create({
        name: name.trim(),
        description: JSON.stringify(validItems),
      });
      onCreated?.();
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Créer un Groupe" onClose={onClose} wide>
      <div className="space-y-4">
        <Field label="Nom du activité" required>
          <input
            className={inputCls}
            placeholder="Ex: Sports collectifs, Gymnastique..."
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </Field>

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Groupe</p>
            <Btn size="sm" variant="ghost" onClick={addItem}><Plus size={12} /> Ajouter</Btn>
          </div>
          <div className="border border-slate-200 divide-y divide-slate-100 max-h-48 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-3 text-xs text-slate-400 text-center">Aucune activité</div>
            ) : (
              items.map((_, idx) => (
                <div key={idx} className="flex items-center gap-2 px-4 py-2.5">
                  <input
                    className={`${inputCls} flex-1`}
                    placeholder="Ex: Football U8, Baby Gym..."
                    value={items[idx]}
                    onChange={e => updateItem(idx, e.target.value)}
                  />
                  {items.length > 1 && (
                    <button onClick={() => removeItem(idx)} className="p-1 text-slate-400 hover:text-red-500 transition-colors shrink-0">
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex gap-3 pt-2 border-t border-slate-100">
          <Btn onClick={handleSubmit} disabled={loading}>
            {loading ? "Création..." : <><Check size={13} /> Créer un horaires</>}
          </Btn>
          <Btn variant="outline" onClick={onClose}>Annuler</Btn>
        </div>
      </div>
    </Modal>
  );
}