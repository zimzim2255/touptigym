import { useState, useMemo, useRef } from "react";
import { Check, Cake, Upload } from "lucide-react";
import { Modal, Field, Btn, inputCls, selectCls } from "../shared/Primitives";
import { useApi } from "../../../hooks/useSupabase";
import { useUpload } from "../../../hooks/useUpload";

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
  const upload = useUpload();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: "", gender: "Garçon", birth_date: "",
    school: "", school_type: "Bilingue", client_type: "Normal",
    zkteco_id: "", address: "", postal_code: "",
  });

  const computedAge = useMemo(() => calculateAge(form.birth_date), [form.birth_date]);

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await upload.uploadFile(file, "children");
      setPhotoUrl(result.url);
      setPhotoFromHeld(false);
    } catch (err: any) {
      alert("Erreur lors du téléchargement: " + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // When the ZKTeco ID is entered, auto-fetch the original photo that was
  // registered with that ID (stored by register_person.js in zkteco_photos).
  const [photoFromHeld, setPhotoFromHeld] = useState(false);

  async function handleZktecoIdChange(value: string) {
    set("zkteco_id", value);
    const trimmed = value.trim();
    if (!trimmed || photoUrl) {
      // don't overwrite a manually-chosen photo
      if (!photoUrl) setPhotoUrl("");
      return;
    }
    try {
      const held = await api.zkteco.getHeldPhoto(trimmed);
      if (held?.photo_url) {
        setPhotoUrl(held.photo_url);
        setPhotoFromHeld(true);
      }
    } catch (_) {}
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
        photo: photoUrl || null,
      });
      if (form.zkteco_id) {
        api.zkteco.claimHeldPhoto(form.zkteco_id);
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
    <Modal title="Ajouter un Enfant" onClose={onClose} wide>
      <div className="space-y-4">
        <div className="flex items-start gap-4">
          <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-xl font-bold border border-slate-200 overflow-hidden shrink-0">
            {photoUrl ? (
              <img src={photoUrl} alt="Photo" className="w-full h-full object-cover" />
            ) : (
              form.name ? form.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase() : "?"
            )}
          </div>
          <div className="flex-1 pt-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Photo de profil</p>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`${inputCls} inline-flex items-center gap-2 w-auto`}
              disabled={uploading}
            >
              <Upload size={14} /> {uploading ? "Téléchargement..." : photoUrl ? "✅ Photo ajoutée" : "Choisir une photo"}
            </button>
            {photoUrl && (
              <div className="mt-1 flex items-center gap-2">
                {photoFromHeld ? (
                  <span className="text-[11px] text-emerald-600 font-medium">📸 Photo retrouvée automatiquement pour cet ID</span>
                ) : (
                  <button type="button" onClick={() => setPhotoUrl("")} className="ml-2 text-xs text-slate-400 hover:text-red-500">
                    Retirer
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

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
            <input className={inputCls} placeholder="ZK-XXXX" value={form.zkteco_id} onChange={e => handleZktecoIdChange(e.target.value)} />
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