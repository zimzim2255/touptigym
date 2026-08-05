import { useState, useRef } from "react";
import { Check, Upload } from "lucide-react";
import { Modal, Field, Btn, inputCls, selectCls } from "../shared/Primitives";
import { useApi } from "../../../hooks/useSupabase";
import { useUpload } from "../../../hooks/useUpload";

interface Props {
  onClose: () => void;
  onCreated?: () => void;
}

export function ModalAddTrainer({ onClose, onCreated }: Props) {
  const api = useApi();
  const upload = useUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    name: "", birth_date: "", id_card: "", phone: "", email: "", specialty: "",
    password: "",
  });
  const [photoUrl, setPhotoUrl] = useState("");

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await upload.uploadFile(file, "trainers");
      setPhotoUrl(result.url);
    } catch (err: any) {
      alert("Erreur lors du téléchargement: " + err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit() {
    if (!form.name || !form.phone || !form.password) return alert("Nom, téléphone et mot de passe requis");
    setLoading(true);
    try {
      // Email for login: use the provided email, or fallback to phone@trainer.local
      const loginEmail = (form.email || `${form.phone}@trainer.local`).toLowerCase();

      // Create user account first (trainer role, bcrypt hashed password)
      const user = await api.users.create({
        email: loginEmail,
        name: form.name,
        role: 'trainer',
        password: form.password,
      });

      // Create trainer record linked to user
      const trainerData: any = {
        name: form.name,
        birth_date: form.birth_date || null,
        id_card: form.id_card || null,
        phone: form.phone,
        email: form.email || null,
        specialty: form.specialty || null,
        photo: photoUrl || null,
      };
      // Link the created user account
      if (user?.id) trainerData.user_id = user.id;

      const trainer = await api.trainers.create(trainerData);

      // Link the user account back to the trainer (so the trainer's
      // "Activités du Jour" only shows their assigned activities)
      if (user?.id && trainer?.id) {
        await api.users.update(user.id, { trainer_id: trainer.id });
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
    <Modal title="Ajouter un Entraîneur" onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nom complet" required>
            <input className={inputCls} placeholder="Prénom Nom" value={form.name} onChange={e => set("name", e.target.value)} />
          </Field>
          <Field label="Date de naissance">
            <input type="date" className={inputCls} value={form.birth_date} onChange={e => set("birth_date", e.target.value)} />
          </Field>
          <Field label="CIN / ID">
            <input className={inputCls} value={form.id_card} onChange={e => set("id_card", e.target.value)} />
          </Field>
          <Field label="Téléphone" required>
            <input className={inputCls} placeholder="06 XX XX XX XX" value={form.phone} onChange={e => set("phone", e.target.value)} />
          </Field>
          <Field label="Email">
            <input type="email" className={inputCls} value={form.email} onChange={e => set("email", e.target.value)} />
          </Field>
          <Field label="Spécialité">
            <input className={inputCls} placeholder="Ex: Football, Gymnastics..." value={form.specialty} onChange={e => set("specialty", e.target.value)} />
          </Field>
          <Field label="Mot de passe (connexion)" required>
            <input type="password" className={inputCls} placeholder="Mot de passe pour se connecter" value={form.password} onChange={e => set("password", e.target.value)} />
          </Field>
          <Field label="Document CIN / ID">
            <div>
              <input ref={fileInputRef} type="file" className="hidden" accept="image/*,.pdf" onChange={handleFileUpload} />
              <button type="button" onClick={() => fileInputRef.current?.click()} className={`${inputCls} flex items-center gap-2`} disabled={uploading}>
                <Upload size={14} /> {uploading ? "Téléchargement..." : photoUrl ? "✅ Fichier ajouté" : "Choisir un fichier"}
              </button>
              {photoUrl && (
                <div className="mt-2 flex items-center gap-2">
                  {photoUrl.match(/\.(jpeg|jpg|png|gif|webp)$/i) ? (
                    <img src={photoUrl} alt="ID" className="h-12 w-auto border border-slate-200" />
                  ) : (
                    <span className="text-xs text-emerald-600">Document ajouté</span>
                  )}
                </div>
              )}
            </div>
          </Field>
        </div>
        <div className="flex gap-3 pt-2 border-t border-slate-100">
          <Btn onClick={handleSubmit} disabled={loading || uploading}>
            {loading ? "Création..." : <><Check size={13} /> Créer</>}
          </Btn>
          <Btn variant="outline" onClick={onClose}>Annuler</Btn>
        </div>
      </div>
    </Modal>
  );
}