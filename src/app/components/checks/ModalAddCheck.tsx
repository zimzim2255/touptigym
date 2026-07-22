import { useState } from "react";
import { Check, Upload } from "lucide-react";
import { Modal, Field, inputCls, Btn } from "../shared/Primitives";
import { useApi } from "../../../hooks/useSupabase";

interface Props {
  onClose: () => void;
  onCreated?: () => void;
}

export function ModalAddCheck({ onClose, onCreated }: Props) {
  const api = useApi();
  const [number, setNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [bank, setBank] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [dateEmission, setDateEmission] = useState(new Date().toISOString().split("T")[0]);
  const [dateExecution, setDateExecution] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!number || !amount || !bank || !accountHolder) return;
    setLoading(true);
    try {
      let fileUrl: string | null = null;

      // Upload file if present
      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", "checks");
        const uploadRes = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload`,
          {
            method: "POST",
            headers: {
              apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: formData,
          }
        );
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          fileUrl = uploadData.url || uploadData.path || null;
        }
      }

      await api.checks.create({
        number,
        amount: parseFloat(amount),
        bank: bank || null,
        account_holder: accountHolder || null,
        date_emission: dateEmission || null,
        date_execution: dateExecution || null,
        file: fileUrl,
      });
      onCreated?.();
      onClose();
    } catch (err: any) {
      console.error("Failed to create check:", err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Ajouter un Chèque" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Numéro de chèque" required>
            <input className={inputCls} placeholder="Ex: 1023" value={number} onChange={e => setNumber(e.target.value)} />
          </Field>
          <Field label="Montant (Dhs)" required>
            <input type="number" className={inputCls} placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
          </Field>
          <Field label="Banque" required>
            <input className={inputCls} placeholder="Nom de la banque" value={bank} onChange={e => setBank(e.target.value)} />
          </Field>
          <Field label="Titulaire" required>
            <input className={inputCls} placeholder="Nom du titulaire" value={accountHolder} onChange={e => setAccountHolder(e.target.value)} />
          </Field>
          <Field label="Date d'émission">
            <input type="date" className={inputCls} value={dateEmission} onChange={e => setDateEmission(e.target.value)} />
          </Field>
          <Field label="Date d'exécution">
            <input type="date" className={inputCls} value={dateExecution} onChange={e => setDateExecution(e.target.value)} />
          </Field>
        </div>
        <Field label="Image / Fichier du chèque (optionnel)">
          <div className="flex items-center gap-3">
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={e => setFile(e.target.files?.[0] || null)}
              className="text-sm text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:border-0 file:text-xs file:font-medium file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
            />
            {file && <span className="text-xs text-emerald-600 flex items-center gap-1"><Upload size={10} /> {file.name}</span>}
          </div>
        </Field>
        <div className="flex gap-3 pt-2 border-t border-slate-100">
          <Btn onClick={handleSubmit} disabled={loading}>
            {loading ? "Enregistrement..." : <><Check size={13} /> Créer</>}
          </Btn>
          <Btn variant="outline" onClick={onClose}>Annuler</Btn>
        </div>
      </div>
    </Modal>
  );
}