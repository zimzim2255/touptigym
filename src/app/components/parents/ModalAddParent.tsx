import { useState, useEffect, useMemo } from "react";
import { Check, Plus, Search, X } from "lucide-react";
import { Modal, Field, Btn, inputCls, selectCls } from "../shared/Primitives";
import { useApi, SUPABASE_URL, SUPABASE_ANON_KEY } from "../../../hooks/useSupabase";
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
  const [childSearch, setChildSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    api.children.getAll().then(setChildren).catch(console.error);
  }, []);

  const filteredChildren = useMemo(() => {
    if (!childSearch) return [];
    const q = childSearch.toLowerCase();
    return children.filter(c => c.name.toLowerCase().includes(q));
  }, [children, childSearch]);

  const selectedChildObjects = children.filter(c => selectedChildren.includes(c.id));

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
    setChildSearch("");
    setShowSuggestions(false);
  }

  function removeSelectedChild(childId: string) {
    setSelectedChildren(prev => prev.filter(id => id !== childId));
  }

  async function handleSubmit() {
    for (const p of parents) {
      if (!p.name || !p.phone) {
        return alert("Veuillez remplir le nom et le téléphone pour chaque parent");
      }
    }

    setLoading(true);
    try {
      const emailFailures: string[] = [];
      for (const p of parents) {
        const parent = await api.parents.create({
          name: p.name,
          phone: p.phone,
          email: p.email || null,
          id_card: p.id_card || null,
          gender: p.gender || null,
        });

        for (const childId of selectedChildren) {
          await api.parents.linkChild(parent.id, childId);
        }

        // Send welcome email to this parent if they provided one.
        if (parent?.email && p.email) {
          const to = (p.email || '').trim();
          if (to) {
            try {
              const res = await fetch(`${SUPABASE_URL}/functions/v1/send-parent-email`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': SUPABASE_ANON_KEY,
                  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({
                  to,
                  parentName: p.name,
                }),
              });
              if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                emailFailures.push(`${p.name || to}: HTTP ${res.status} ${body?.error || ''}`.trim());
              }
            } catch (emailErr: any) {
              emailFailures.push(`${p.name || to}: ${emailErr.message || emailErr}`);
            }
          }
        }
      }

      if (emailFailures.length > 0) {
        alert(`Parent(s) créé(s) mais EMAIL NON ENVOYÉ pour:\n- ${emailFailures.join('\n- ')}\n\nVérifiez que les secrets SMTP de la fonction send-parent-email sont configurés, puis Redéployer la fonction.`);
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
          {/* Search with suggestions */}
          <div className="relative mb-3">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className={`${inputCls} pl-8`}
              placeholder="Rechercher un enfant..."
              value={childSearch}
              onChange={e => { setChildSearch(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
            />
            {showSuggestions && childSearch && (
              <div className="absolute z-10 top-full left-0 right-0 bg-white border border-slate-200 shadow-lg max-h-48 overflow-y-auto">
                {filteredChildren.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-slate-400">Aucun enfant trouvé</div>
                ) : (
                  filteredChildren.map(c => {
                    const isSelected = selectedChildren.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleChild(c.id)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-pink-50 transition-colors flex items-center justify-between ${
                          isSelected ? "bg-pink-50 text-pink-700" : "text-slate-700"
                        }`}
                      >
                        <span>{c.name} ({c.age} ans)</span>
                        {isSelected && <Check size={13} className="text-pink-500" />}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Selected children chips */}
          {selectedChildObjects.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedChildObjects.map(c => (
                <span key={c.id} className="inline-flex items-center gap-1 px-2.5 py-1 bg-pink-50 text-pink-700 text-xs font-medium border border-pink-200">
                  {c.name}
                  <button type="button" onClick={() => removeSelectedChild(c.id)} className="text-pink-400 hover:text-pink-700">
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
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