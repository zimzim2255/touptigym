import { useState } from "react";
import { Eye, Trash2 } from "lucide-react";
import { Modal, Tag, Btn, inputCls, Field } from "../shared/Primitives";
import { useApi } from "../../../hooks/useSupabase";
import { Check } from "../../types";

interface Props {
  check: Check;
  onClose: () => void;
  onUpdated?: () => void;
  canEdit?: boolean;
}

export function ModalCheckDetail({ check, onClose, onUpdated, canEdit }: Props) {
  const api = useApi();
  const [editMode, setEditMode] = useState(false);
  const [number, setNumber] = useState(check.number);
  const [amount, setAmount] = useState(check.amount.toString());
  const [bank, setBank] = useState(check.bank || "");
  const [accountHolder, setAccountHolder] = useState(check.account_holder || "");
  const [dateEmission, setDateEmission] = useState(check.date_emission || "");
  const [dateExecution, setDateExecution] = useState(check.date_execution || "");
  const [montantUsed, setMontantUsed] = useState(check.montant_used);
  const [saving, setSaving] = useState(false);

  const rest = amount ? parseFloat(amount) - montantUsed : 0;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const formatShortDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.checks.update(check.id, {
        number,
        amount: parseFloat(amount),
        bank: bank || null,
        account_holder: accountHolder || null,
        date_emission: dateEmission || null,
        date_execution: dateExecution || null,
      });
      onUpdated?.();
      setEditMode(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Supprimer ce chèque ?")) return;
    try {
      await api.checks.remove(check.id);
      onUpdated?.();
      onClose();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <Modal title={editMode ? "Modifier le Chèque" : "Détails du Chèque"} onClose={onClose}>
      <div className="space-y-4">
        {editMode ? (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Numéro de chèque">
              <input className={inputCls} value={number} onChange={e => setNumber(e.target.value)} />
            </Field>
            <Field label="Montant (Dhs)">
              <input type="number" className={inputCls} value={amount} onChange={e => setAmount(e.target.value)} />
            </Field>
            <Field label="Banque">
              <input className={inputCls} value={bank} onChange={e => setBank(e.target.value)} />
            </Field>
            <Field label="Titulaire">
              <input className={inputCls} value={accountHolder} onChange={e => setAccountHolder(e.target.value)} />
            </Field>
            <Field label="Date d'émission">
              <input type="date" className={inputCls} value={dateEmission} onChange={e => setDateEmission(e.target.value)} />
            </Field>
            <Field label="Date d'exécution">
              <input type="date" className={inputCls} value={dateExecution} onChange={e => setDateExecution(e.target.value)} />
            </Field>
          </div>
        ) : (
          <>
            <div>
              <p className="text-xs text-slate-500 uppercase font-semibold">Numéro</p>
              <p className="text-2xl font-bold text-slate-900 mt-0.5" style={{ fontFamily: "'DM Mono', monospace" }}>#{check.number}</p>
            </div>
            <div className="border border-slate-200 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Montant</span>
                <span className="font-semibold text-slate-900">{check.amount.toLocaleString()},00 Dhs</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Banque</span>
                <span>{check.bank || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Titulaire</span>
                <span>{check.account_holder || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date d'émission</span>
                <span>{formatShortDate(check.date_emission)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date d'exécution</span>
                <span>{formatShortDate(check.date_execution)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Montant utilisé</span>
                <span className="text-slate-700">{check.montant_used.toLocaleString()},00 Dhs</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Reste</span>
                <span className="font-semibold text-emerald-600">{(check.amount - check.montant_used).toLocaleString()},00 Dhs</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Statut</span>
                <Tag color={check.used ? "red" : "green"}>{check.used ? "Utilisé" : "Disponible"}</Tag>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Créé le</span>
                <span>{formatDate(check.created_at)}</span>
              </div>
              {check.file && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Fichier</span>
                  <a href={check.file} target="_blank" rel="noopener noreferrer"
                    className="text-orange-600 hover:underline flex items-center gap-1 text-xs">
                    <Eye size={11} /> Voir le fichier
                  </a>
                </div>
              )}
            </div>
          </>
        )}
        <div className="flex gap-3 pt-2 border-t border-slate-100">
          {editMode ? (
            <>
              <Btn onClick={handleSave} disabled={saving}>{saving ? "Enregistrement..." : "Enregistrer"}</Btn>
              <Btn variant="outline" onClick={() => setEditMode(false)}>Annuler</Btn>
            </>
          ) : (
            <>
              <Btn variant="outline" onClick={onClose}>Fermer</Btn>
              {canEdit && (
                <>
                  <Btn variant="ghost" onClick={() => setEditMode(true)}>Modifier</Btn>
                  <Btn variant="danger" onClick={handleDelete}><Trash2 size={13} /> Supprimer</Btn>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}