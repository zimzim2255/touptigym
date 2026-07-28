import { useState, useMemo } from "react";
import { Check, Cake } from "lucide-react";
import { Modal, Field, Btn, inputCls, selectCls } from "../shared/Primitives";
import { useApi } from "../../../hooks/useSupabase";

function calculateAge(birthDate: string): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export function ModalAddChild({ onClose, onCreated }: { onClose: () => void; onCreated?: () => void }) {
  const api = useApi();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "", gender: "Garçon", birth_date: "",
    school: "", school_type: "Bilingue", client_type: "Normal",
    zkteco_id: "", address: "", postal_code: "",
  });

  const computedAge = useMemo(() => calculateAge(form.birth_date), [form.birth_date]);

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit() {
    if (!form.name || !form.birth_date) return;
    setLoading(true);
    try {
      await api.children.create({
        name: form.name,
        gender: form.gender,
        birth_date: form.birth_date,
        school: form.school || null,
        school_type: form.school_type,
        client_type: form.client_type,
        zkteco_id: form.zkteco_id || null,
        address: form.address || null,
        postal_code: form.postal_code || null,
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
    <Modal title="Ajouter un Enfant" onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nom complet" required>
            <input className={inputCls} placeholder="Prénom Nom" value={form.name} onChange={e => set("name", e.target.value)} />
          </Field>
          <Field label="Sexe" required>
            <select className={selectCls} value={form.gender} onChange={e => set("gender", e.target.value)}>
              <option>Garçon</option><option>Fille</option>
            </select>
          </Field>
          <Field label="Date de naissance" required>
            <div className="relative">
              <input type="date" className={inputCls} value={form.birth_date} onChange={e => set("birth_date", e.target.value)} />
              {computedAge !== null && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-pink-500 font-semibold flex items-center gap-1">
                  <Cake size={12} /> {computedAge} ans
                </span>
              )}
            </div>
          </Field>
          <Field label="Nom de l'école">
            <input className={inputCls} placeholder="École" value={form.school} onChange={e => set("school", e.target.value)} />
          </Field>
          <Field label="Type d'école">
            <select className={selectCls} value={form.school_type} onChange={e => set("school_type", e.target.value)}>
              <option>Bilingue</option><option>Mission</option><option>Autre</option>
            </select>
          </Field>
          <Field label="Type de client">
            <select className={selectCls} value={form.client_type} onChange={e => set("client_type", e.target.value)}>
              <option>Normal</option><option>VIP</option>
            </select>
          </Field>
          <Field label="ZKTeco ID">
            <input className={inputCls} placeholder="ZK-XXXX" value={form.zkteco_id} onChange={e => set("zkteco_id", e.target.value)} />
          </Field>
          <Field label="Code postal">
            <input className={inputCls} placeholder="20000" value={form.postal_code} onChange={e => set("postal_code", e.target.value)} />
          </Field>
        </div>
        <Field label="Adresse">
          <input className={inputCls} placeholder="Adresse complète" value={form.address} onChange={e => set("address", e.target.value)} />
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