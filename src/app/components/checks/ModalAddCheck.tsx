import { useState, useRef, useEffect } from "react";
import { Check, X, Search, Upload, FileText, Landmark, Banknote } from "lucide-react";
import { Modal, Field, Btn, inputCls, selectCls } from "../shared/Primitives";
import { useApi } from "../../../hooks/useSupabase";

interface Props {
  onClose: () => void;
  onCreated?: () => void;
}

type PaymentMethod = "espece" | "virement" | "cheque";

const METHOD_LABELS: Record<PaymentMethod, string> = {
  espece: "Espèce",
  virement: "Virement",
  cheque: "Chèque",
};

const METHOD_ICONS: Record<PaymentMethod, React.ElementType> = {
  espece: Banknote,
  virement: Landmark,
  cheque: FileText,
};

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
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSubmit() {
    if (!number || !amount || !bank || !accountHolder) {
      return alert("Veuillez remplir tous les champs obligatoires");
    }
    setLoading(true);
    try {
      let fileUrl = "";
      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        const uploadRes = await api.upload.file(formData);
        fileUrl = uploadRes.url || "";
      }
      await api.checks.create({
        number,
        amount: parseFloat(amount),
        bank,
        account_holder: accountHolder,
        date_emission: dateEmission || null,
        date_execution: dateExecution || null,
        file: fileUrl || null,
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
    <Modal title="Ajouter un Chèque" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Numéro du chèque" required>
            <input className={inputCls} placeholder="Ex: CHQ-001" value={number} onChange={e => setNumber(e.target.value)} />
          </Field>
          <Field label="Montant (Dhs)" required>
            <input type="number" className={inputCls} placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} />
          </Field>
          <Field label="Banque" required>
            <input className={inputCls} placeholder="Ex: BMCE, Attijari..." value={bank} onChange={e => setBank(e.target.value)} />
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

        <Field label="Fichier (optionnel)">
          <div className="flex items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf"
              onChange={e => setFile(e.target.files?.[0] || null)}
              className="text-sm text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:border-0 file:text-xs file:font-medium file:bg-pink-50 file:text-pink-700 hover:file:bg-pink-100"
            />
            {file && <span className="text-xs text-slate-400">{file.name}</span>}
          </div>
        </Field>

        <div className="flex gap-3 pt-2 border-t border-slate-100">
          <Btn onClick={handleSubmit} disabled={loading}>
            {loading ? "Création..." : <><Check size={13} /> Créer le chèque</>}
          </Btn>
          <Btn variant="outline" onClick={onClose}>Annuler</Btn>
        </div>
      </div>
    </Modal>
  );
}