import { useState, useEffect } from "react";
import { Search, Check, X } from "lucide-react";
import { Modal, Field, Btn, inputCls, selectCls } from "../shared/Primitives";
import { useApi } from "../../../hooks/useSupabase";
import { Child } from "../../types";
import { ModalType } from "../../types";

interface Props {
  onClose: () => void;
  onCreated?: () => void;
  openModal?: (m: ModalType) => void;
}

const PRICE_TABLE: Record<string, Record<string, number>> = {
  "1": { Session: 3900, Annuel: 6600 },
  "2": { Session: 6300, Annuel: 10200 },
  "3": { Session: 8100, Annuel: 13800 },
  "4": { Session: 9300, Annuel: 16200 },
};

const ACTIVITY_LABELS: Record<string, string> = {
  "1": "1 activité/semaine",
  "2": "2 activités/semaine",
  "3": "3 activités/semaine",
  "4": "4 activités/semaine",
};

export function ModalAddSubscription({ onClose, onCreated, openModal }: Props) {
  const api = useApi();
  const [loading, setLoading] = useState(false);
  const [children, setChildren] = useState<Child[]>([]);
  const [childSearch, setChildSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedChild, setSelectedChild] = useState<{ id: string; name: string } | null>(null);
  const [subscriptionType, setSubscriptionType] = useState("Annuel");
  const [activities, setActivities] = useState("2");
  const [discount, setDiscount] = useState(0);
  const [insurance, setInsurance] = useState(300);
  const [entryFee, setEntryFee] = useState(700);
  const [subType, setSubType] = useState("");

  useEffect(() => {
    api.children.getAll().then(setChildren).catch(console.error);
  }, []);

  const filteredChildren = children.filter(c =>
    c.name.toLowerCase().includes(childSearch.toLowerCase())
  );

  const baseAmount = PRICE_TABLE[activities]?.[subscriptionType] || 0;
  const total = baseAmount - discount + insurance + entryFee;

  function handleSelectChild(child: Child) {
    setSelectedChild({ id: child.id, name: child.name });
    setChildSearch(child.name);
    setShowSuggestions(false);
  }

  async function handleSubmit() {
    if (!selectedChild) return alert("Veuillez sélectionner un enfant");
    if (!baseAmount) return alert("Veuillez sélectionner un type d'abonnement");

    setLoading(true);
    try {
      const startDate = new Date();
      const endDate = new Date();
      if (subscriptionType === "Annuel") {
        endDate.setFullYear(endDate.getFullYear() + 1);
      } else {
        endDate.setMonth(endDate.getMonth() + 6);
      }

      await api.subscriptions.create({
        child_id: selectedChild.id,
        type: subscriptionType,
        sub_type: subType || `${activities} activités/semaine`,
        amount: baseAmount,
        discount: discount,
        insurance: insurance,
        entry_fee: entryFee,
        status: "actif",
        start_date: startDate.toISOString().split("T")[0],
        end_date: endDate.toISOString().split("T")[0],
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
    <Modal title="Créer un Abonnement" onClose={onClose} wide>
      <div className="space-y-5">

        {/* ── Section 1 : Enfant with search ── */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">1. Enfant</p>
          <div className="border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-500 uppercase">Sélectionner un enfant</p>
              {openModal && (
                <Btn size="sm" variant="ghost" onClick={() => openModal("add-child")}>
                  <X size={12} /> Créer
                </Btn>
              )}
            </div>
            <div className="relative mb-3">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className={`${inputCls} pl-8`}
                placeholder="Rechercher un enfant..."
                value={childSearch}
                onChange={e => {
                  setChildSearch(e.target.value);
                  setSelectedChild(null);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
              />
              {showSuggestions && childSearch && (
                <div className="absolute z-10 top-full left-0 right-0 bg-white border border-slate-200 shadow-lg max-h-48 overflow-y-auto">
                  {filteredChildren.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-slate-400">Aucun enfant trouvé</div>
                  ) : (
                    filteredChildren.map(c => (
                      <button
                        key={c.id}
                        onClick={() => handleSelectChild(c)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-orange-50 transition-colors flex items-center justify-between ${
                          selectedChild?.id === c.id ? "bg-orange-50 text-orange-700" : "text-slate-700"
                        }`}
                      >
                        <span>{c.name} ({c.age} ans)</span>
                        {selectedChild?.id === c.id && <Check size={13} className="text-orange-500" />}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            {selectedChild && (
              <p className="text-xs text-emerald-600 flex items-center gap-1">
                <Check size={11} /> Sélectionné : {selectedChild.name}
              </p>
            )}
          </div>
        </div>

        {/* ── Section 2 : Type & Activités ── */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">2. Type d'abonnement</p>
          <div className="border border-slate-200 p-4 space-y-3">
            <div className="flex gap-2">
              {["Session", "Annuel"].map(t => (
                <button
                  key={t}
                  onClick={() => {
                    setSubscriptionType(t);
                    setSubType(`${activities} activités/semaine`);
                  }}
                  className={`px-4 py-2 text-sm border font-medium transition-colors ${
                    subscriptionType === t
                      ? "border-orange-500 bg-orange-500 text-white"
                      : "border-slate-300 text-slate-600 hover:border-slate-400"
                  }`}
                >{t}</button>
              ))}
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Activités</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(ACTIVITY_LABELS).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => {
                      setActivities(key);
                      setSubType(`${key} activités/semaine`);
                    }}
                    className={`px-3 py-2 text-xs border font-medium transition-colors text-left ${
                      activities === key
                        ? "border-orange-500 bg-orange-50 text-orange-700"
                        : "border-slate-200 text-slate-600 hover:border-slate-400"
                    }`}
                  >
                    <div>{label}</div>
                    <div className="text-orange-600 mt-0.5">{PRICE_TABLE[key][subscriptionType].toLocaleString()} Dhs</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Price reference */}
            <div className="border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-500 mb-2">Tarifs {subscriptionType}</p>
              <div className="grid grid-cols-2 gap-1 text-xs text-slate-700">
                {Object.entries(PRICE_TABLE).map(([act, prices]) => (
                  <div key={act} className="flex justify-between px-1">
                    <span>{ACTIVITY_LABELS[act]}</span>
                    <span className={`font-semibold ${activities === act ? "text-orange-600" : ""}`}>
                      {prices[subscriptionType]?.toLocaleString()} Dhs
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Section 3 : Financial details ── */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">3. Détails financiers</p>
          <div className="border border-slate-200 p-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Montant de base (Dhs)">
                <div className={`${inputCls} bg-slate-100 text-slate-600`}>{baseAmount.toLocaleString()} Dhs</div>
              </Field>
              <Field label="Remise (Dhs)">
                <input type="number" className={inputCls} value={discount} onChange={e => setDiscount(Number(e.target.value))} placeholder="0" />
              </Field>
              <Field label="Assurance (Dhs)">
                <input type="number" className={inputCls} value={insurance} onChange={e => setInsurance(Number(e.target.value))} />
              </Field>
              <Field label="Droit d'entrée (Dhs)">
                <input type="number" className={inputCls} value={entryFee} onChange={e => setEntryFee(Number(e.target.value))} />
              </Field>
            </div>
            <div className="mt-3 border-t border-slate-200 pt-3 flex justify-between items-center">
              <span className="text-sm font-semibold text-slate-700">Total à payer</span>
              <span className="text-lg font-bold text-orange-600">{total.toLocaleString()} Dhs</span>
            </div>
          </div>
        </div>

        {/* ── Submit ── */}
        <div className="flex gap-3 pt-2 border-t border-slate-100">
          <Btn onClick={handleSubmit} disabled={loading}>
            {loading ? "Création..." : <><Check size={13} /> Créer l'abonnement</>}
          </Btn>
          <Btn variant="outline" onClick={onClose}>Annuler</Btn>
        </div>
      </div>
    </Modal>
  );
}