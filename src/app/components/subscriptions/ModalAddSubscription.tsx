import { useState, useEffect, useRef, useMemo } from "react";
import { Search, Check, X, Plus, Banknote, Landmark, FileText, ChevronDown, ChevronRight } from "lucide-react";
import { Modal, Field, Btn, inputCls, selectCls } from "../shared/Primitives";
import { useApi, SUPABASE_URL, SUPABASE_ANON_KEY } from "../../../hooks/useSupabase";
import { Child, Parent, Check as CheckType, Exercise, Group } from "../../types";
import { ModalType } from "../../types";

interface Props {
  onClose: () => void;
  onCreated?: () => void;
  openModal?: (m: ModalType) => void;
}

type PaymentMethod = "espece" | "virement" | "cheque";

const PRICE_TABLE: Record<string, Record<string, number>> = {
  "1": { Session: 3900, Annuel: 6600 },
  "2": { Session: 6300, Annuel: 10200 },
  "3": { Session: 8100, Annuel: 13800 },
  "4": { Session: 9300, Annuel: 16200 },
};

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

export function ModalAddSubscription({ onClose, onCreated, openModal }: Props) {
  const api = useApi();
  const [loading, setLoading] = useState(false);
  const [children, setChildren] = useState<Child[]>([]);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [checks, setChecks] = useState<CheckType[]>([]);
  const [childSearch, setChildSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedChild, setSelectedChild] = useState<{ id: string; name: string } | null>(null);
  const [subscriptionType, setSubscriptionType] = useState("Annuel");
  const [activities, setActivities] = useState("2");
  const [discount, setDiscount] = useState(0);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountType, setDiscountType] = useState<"fixed" | "percent">("fixed");
  const [insurance, setInsurance] = useState(300);
  const [entryFee, setEntryFee] = useState(700);
  const [subType, setSubType] = useState("");
  const [subscriptionDate, setSubscriptionDate] = useState(new Date().toISOString().split("T")[0]);
  const [subscriptionTypeOption, setSubscriptionTypeOption] = useState("Nouvel abonnement");
  const [validityStart, setValidityStart] = useState(new Date().toISOString().split("T")[0]);
  const [validityEnd, setValidityEnd] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 336); // 48 weeks = 336 days
    return d.toISOString().split("T")[0];
  });

  // Calculate end date based on start date and subscription type
  function calculateEndDateFromStart(startDate: string, type: string): string {
    const d = new Date(startDate);
    if (type === "Annuel") {
      d.setDate(d.getDate() + 336); // 48 weeks = 336 days
    } else {
      d.setDate(d.getDate() + 168); // 24 weeks = 168 days
    }
    return d.toISOString().split("T")[0];
  }

  // Step 3 selections
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]); // group ids
  const [selectedGroupItems, setSelectedGroupItems] = useState<string[]>([]); // group item names
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]); // exercise ids
  const [activitySearch, setActivitySearch] = useState("");
  const [groupItemSearch, setGroupItemSearch] = useState("");
  const [courseSearch, setCourseSearch] = useState("");
  const [combinations, setCombinations] = useState<{ activities: string[]; groupItems: string[]; courses: string[] }[]>([]);

  // Parent selection state
  const [childParents, setChildParents] = useState<Parent[]>([]);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [loadingParents, setLoadingParents] = useState(false);

  // Payment state
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [checkSearch, setCheckSearch] = useState("");
  const [showCheckSuggestions, setShowCheckSuggestions] = useState(false);
  const [selectedChecks, setSelectedChecks] = useState<{ check: CheckType; amount: number }[]>([]);
  const [especeAmount, setEspeceAmount] = useState(0);
  const [virementAmount, setVirementAmount] = useState(0);
  const [newCheckNum, setNewCheckNum] = useState("");
  const [newCheckAmount, setNewCheckAmount] = useState("");
  const [newCheckBank, setNewCheckBank] = useState("");
  const [newCheckHolder, setNewCheckHolder] = useState("");
  const [newCheckDateEmission, setNewCheckDateEmission] = useState(new Date().toISOString().split("T")[0]);
  const [newCheckDateExecution, setNewCheckDateExecution] = useState("");
  const [savingCheck, setSavingCheck] = useState(false);
  const [newCheckCreated, setNewCheckCreated] = useState(false);
  const [showNewCheckForm, setShowNewCheckForm] = useState(false);
  const checkSearchRef = useRef<HTMLDivElement>(null);

  // All unique group item names from selected activities (groups)
  const availableGroupItems = useMemo(() => {
    if (selectedActivities.length === 0) return [];
    const items = new Set<string>();
    for (const g of groups) {
      if (selectedActivities.includes(g.id)) {
        try {
          if (g.description) {
            const parsed = JSON.parse(g.description);
            if (Array.isArray(parsed)) {
              parsed.forEach((item: string) => items.add(item));
            }
          }
        } catch { /* ignore */ }
      }
    }
    return Array.from(items).sort();
  }, [selectedActivities, groups]);

  // Courses filtered by selected group items
  const coursesFiltered = useMemo(() => {
    if (selectedGroupItems.length === 0) return [];
    // Get groups that contain the selected group items
    const matchingGroupIds = groups
      .filter(g => {
        try {
          if (g.description) {
            const parsed = JSON.parse(g.description);
            return Array.isArray(parsed) && parsed.some((item: string) => selectedGroupItems.includes(item));
          }
        } catch { /* ignore */ }
        return false;
      })
      .map(g => g.id);
    let filtered = allExercises.filter(ex => ex.group_id && matchingGroupIds.includes(ex.group_id));
    if (courseSearch) {
      filtered = filtered.filter(ex =>
        ex.name.toLowerCase().includes(courseSearch.toLowerCase())
      );
    }
    return filtered;
  }, [allExercises, selectedGroupItems, groups, courseSearch]);

  useEffect(() => {
    api.children.getAll().then(setChildren).catch(console.error);
    api.exercises.getAll().then(setAllExercises).catch(console.error);
    api.groups.getAll().then(setGroups).catch(console.error);
    api.checks.getAll().then(setChecks).catch(console.error);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (checkSearchRef.current && !checkSearchRef.current.contains(e.target as Node)) {
        setShowCheckSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredChildren = children.filter(c =>
    c.name.toLowerCase().includes(childSearch.toLowerCase())
  );

  const baseAmount = PRICE_TABLE[activities]?.[subscriptionType] || 0;
  const effectiveDiscount = discountType === "percent"
    ? Math.round(baseAmount * (discountPercent / 100))
    : discount;
  const total = baseAmount - effectiveDiscount + insurance + entryFee;

  const totalChecksAmount = selectedChecks.reduce((sum, s) => sum + s.amount, 0);
  const totalPaid = especeAmount + virementAmount + totalChecksAmount;
  const remaining = total - totalPaid;

  const availableChecks = useMemo(() => {
    const selectedIds = selectedChecks.map(s => s.check.id);
    return checks.filter(c => !c.used && !selectedIds.includes(c.id));
  }, [checks, selectedChecks]);

  const filteredChecks = availableChecks.filter(c =>
    c.number.toLowerCase().includes(checkSearch.toLowerCase()) ||
    (c.bank && c.bank.toLowerCase().includes(checkSearch.toLowerCase())) ||
    (c.account_holder && c.account_holder.toLowerCase().includes(checkSearch.toLowerCase()))
  );

  function handleSelectChild(child: Child) {
    setSelectedChild({ id: child.id, name: child.name });
    setChildSearch(child.name);
    setShowSuggestions(false);
    setSelectedParentId(null);
    setChildParents([]);
    setLoadingParents(true);
    api.parents.getAll(child.id).then(parents => {
      setChildParents(parents);
      if (parents.length === 1) {
        setSelectedParentId(parents[0].id);
      }
    }).catch(console.error).finally(() => setLoadingParents(false));
  }

  // Course limit from Forfait selection
  const courseLimit = parseInt(activities);
  // Total unique courses already saved in combinations
  const savedCourseCount = new Set(combinations.flatMap(c => c.courses)).size;
  // New unique courses being added in current selection (not already saved)
  const newCourseCount = selectedCourses.filter(id => !combinations.flatMap(c => c.courses).includes(id)).length;
  const totalCourseCount = savedCourseCount + newCourseCount;
  const canSelectMore = totalCourseCount < courseLimit;

  function toggleActivity(groupId: string) {
    setSelectedActivities(prev => {
      if (prev.includes(groupId)) {
        // Remove this activity and its group items + courses
        const group = groups.find(g => g.id === groupId);
        let groupItemNames: string[] = [];
        try {
          if (group?.description) {
            const parsed = JSON.parse(group.description);
            if (Array.isArray(parsed)) groupItemNames = parsed;
          }
        } catch { /* ignore */ }
        setSelectedGroupItems(prevItems => prevItems.filter(item => !groupItemNames.includes(item)));
        const groupExerciseIds = allExercises.filter(ex => ex.group_id === groupId).map(ex => ex.id);
        setSelectedCourses(prevCourses => prevCourses.filter(cid => !groupExerciseIds.includes(cid)));
        return prev.filter(a => a !== groupId);
      }
      return [...prev, groupId];
    });
  }

  function toggleGroupItem(item: string) {
    setSelectedGroupItems(prev =>
      prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
    );
  }

  function toggleCourse(exerciseId: string) {
    // Check if selecting this course would exceed the limit
    if (!selectedCourses.includes(exerciseId)) {
      const alreadySaved = combinations.flatMap(c => c.courses);
      const isNew = !alreadySaved.includes(exerciseId);
      if (isNew && totalCourseCount >= courseLimit) {
        return alert(`Limite atteinte : vous ne pouvez sélectionner que ${courseLimit} cours d'après votre forfait "${activities} activité(s)/semaine".`);
      }
    }
    setSelectedCourses(prev =>
      prev.includes(exerciseId) ? prev.filter(id => id !== exerciseId) : [...prev, exerciseId]
    );
  }

  function saveCombination() {
    if (selectedActivities.length === 0 && selectedGroupItems.length === 0 && selectedCourses.length === 0) {
      return alert("Veuillez sélectionner au moins une activité, un groupe ou un cours");
    }
    setCombinations(prev => [...prev, { activities: selectedActivities, groupItems: selectedGroupItems, courses: selectedCourses }]);
    setSelectedActivities([]);
    setSelectedGroupItems([]);
    setSelectedCourses([]);
    setActivitySearch("");
    setGroupItemSearch("");
    setCourseSearch("");
  }

  function removeCombination(index: number) {
    setCombinations(prev => prev.filter((_, i) => i !== index));
  }

  function togglePaymentMethod(method: PaymentMethod) {
    setPaymentMethods(prev =>
      prev.includes(method) ? prev.filter(m => m !== method) : [...prev, method]
    );
    if (method === "espece") setEspeceAmount(0);
    if (method === "virement") setVirementAmount(0);
    if (method === "cheque") setSelectedChecks([]);
  }

  function handleSelectCheck(check: CheckType) {
    const rest = check.amount - check.montant_used;
    const maxAmount = Math.min(rest, remaining > 0 ? remaining : rest);
    setSelectedChecks(prev => [...prev, { check, amount: maxAmount }]);
    setCheckSearch("");
    setShowCheckSuggestions(false);
  }

  function removeSelectedCheck(checkId: string) {
    setSelectedChecks(prev => prev.filter(s => s.check.id !== checkId));
  }

  function updateCheckAmount(checkId: string, amount: number) {
    setSelectedChecks(prev => prev.map(s => {
      if (s.check.id !== checkId) return s;
      const rest = s.check.amount - s.check.montant_used;
      return { ...s, amount: Math.min(Math.max(0, amount), rest) };
    }));
  }

  async function handleCreateCheckInline() {
    if (!newCheckNum || !newCheckAmount || !newCheckBank || !newCheckHolder) {
      return alert("Veuillez remplir tous les champs du chèque");
    }
    setSavingCheck(true);
    try {
      const created = await api.checks.create({
        number: newCheckNum,
        amount: parseFloat(newCheckAmount),
        bank: newCheckBank,
        account_holder: newCheckHolder,
        date_emission: newCheckDateEmission || null,
        date_execution: newCheckDateExecution || null,
      });
      const updatedChecks = await api.checks.getAll();
      setChecks(updatedChecks);
      setNewCheckNum("");
      setNewCheckAmount("");
      setNewCheckBank("");
      setNewCheckHolder("");
      setNewCheckDateEmission(new Date().toISOString().split("T")[0]);
      setNewCheckDateExecution("");
      setNewCheckCreated(true);
      const freshCheck = updatedChecks.find((c: CheckType) => c.id === created.id);
      if (freshCheck) {
        handleSelectCheck(freshCheck);
      }
      setTimeout(() => setNewCheckCreated(false), 3000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingCheck(false);
    }
  }

  async function handleSubmit() {
    if (!selectedChild) return alert("Veuillez sélectionner un enfant");
    if (!baseAmount) return alert("Veuillez sélectionner un type d'abonnement");

    setLoading(true);
    try {
      // Merge all saved combinations
      const allActivityIds = [...new Set(combinations.flatMap(c => c.activities))];
      const allCourseIds = [...new Set(combinations.flatMap(c => c.courses))];
      const allGroupItems = [...new Set(combinations.flatMap(c => c.groupItems))];

      const sub = await api.subscriptions.create({
        child_id: selectedChild.id,
        parent_id: selectedParentId || undefined,
        type: subscriptionType,
        sub_type: subType || `${activities} activités/semaine`,
        amount: baseAmount,
        discount: effectiveDiscount,
        insurance: insurance,
        entry_fee: entryFee,
        subscription_type_option: subscriptionTypeOption,
        exercises: allCourseIds,
        activity_ids: allActivityIds,
        group_ids: allGroupItems,
        course_ids: allCourseIds,
        status: "actif",
        paid_amount: totalPaid > 0 ? totalPaid : 0,
        subscription_date: subscriptionDate,
        start_date: validityStart,
        end_date: validityEnd,
      });

      if (totalPaid > 0) {
        const checkIds = selectedChecks.map(s => s.check.id);
        const payment = await api.payments.create({
          subscription_id: sub.id,
          amount: totalPaid,
          method: paymentMethods,
          check_ids: checkIds,
        });
        for (const sc of selectedChecks) {
          await api.checks.useCheck(sc.check.id, sc.amount, payment.id);
        }
      }

      if (selectedParentId) {
        const parent = childParents.find(p => p.id === selectedParentId);
        if (parent?.email) {
          try {
            await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-welcome-email`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              },
              body: JSON.stringify({
                to: parent.email,
                parentName: parent.name,
                childName: selectedChild.name,
                subscriptionType: `${subscriptionType} - ${subType || `${activities} activités/semaine`}`,
                startDate: validityStart,
                endDate: validityEnd,
              }),
            });
          } catch (emailErr) {
            console.error('Failed to send welcome email:', emailErr);
          }
        }
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
    <Modal title="Créer un Abonnement" onClose={onClose} wide>
      <div className="space-y-5 max-h-[80vh] overflow-y-auto pr-1">

        {/* Section 0: Type de souscription */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Type de souscription</p>
          <div className="border border-slate-200 p-4">
            <div className="flex gap-2">
              {["Nouvel abonnement", "Réabonnement"].map(t => (
                <button key={t} onClick={() => { setSubscriptionTypeOption(t); if (t === "Réabonnement") setEntryFee(0); else setEntryFee(700); }}
                  className={`px-4 py-2 text-sm border font-medium transition-colors flex-1 ${subscriptionTypeOption === t ? "border-pink-500 bg-pink-500 text-white" : "border-slate-300 text-slate-600 hover:border-slate-400"}`}>{t}</button>
              ))}
            </div>
            {subscriptionTypeOption === "Réabonnement" && (
              <p className="text-xs text-amber-600 mt-2 flex items-center gap-1"><Check size={11} /> Droit d'entrée automatiquement défini à 0 DH</p>
            )}
          </div>
        </div>

        {/* Section 1: Enfant */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">1. Enfant</p>
          <div className="border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-500 uppercase">Sélectionner un enfant</p>
              {openModal && (<Btn size="sm" variant="ghost" onClick={() => openModal("add-child")}><X size={12} /> Créer</Btn>)}
            </div>
            <div className="relative mb-3">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className={`${inputCls} pl-8`} placeholder="Rechercher un enfant..." value={childSearch}
                onChange={e => { setChildSearch(e.target.value); setSelectedChild(null); setShowSuggestions(true); }} onFocus={() => setShowSuggestions(true)} />
              {showSuggestions && childSearch && (
                <div className="absolute z-10 top-full left-0 right-0 bg-white border border-slate-200 shadow-lg max-h-48 overflow-y-auto">
                  {filteredChildren.length === 0 ? (<div className="px-3 py-2 text-xs text-slate-400">Aucun enfant trouvé</div>) : (
                    filteredChildren.map(c => (
                      <button key={c.id} onClick={() => handleSelectChild(c)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-pink-50 transition-colors flex items-center justify-between ${selectedChild?.id === c.id ? "bg-pink-50 text-pink-700" : "text-slate-700"}`}>
                        <span>{c.name} ({c.age} ans)</span>
                        {selectedChild?.id === c.id && <Check size={13} className="text-pink-500" />}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            {selectedChild && (<p className="text-xs text-emerald-600 flex items-center gap-1"><Check size={11} /> Sélectionné : {selectedChild.name}</p>)}
          </div>
        </div>

        {/* Section 1.5: Parent */}
        {selectedChild && (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Parent / Tuteur</p>
            <div className="border border-slate-200 p-4">
              {loadingParents ? (<p className="text-xs text-slate-400">Chargement des parents...</p>) : childParents.length === 0 ? (
                <div className="text-center">
                  <p className="text-xs text-slate-400 mb-2">Aucun parent lié à cet enfant</p>
                  {openModal && (<Btn size="sm" onClick={() => openModal("add-parent")}><Plus size={11} /> Créer un nouveau parent</Btn>)}
                </div>
              ) : (
                <>
                  <p className="text-xs text-slate-500 mb-2">Sélectionner le parent responsable</p>
                  <div className="space-y-2">
                    {childParents.map(p => {
                      const isSelected = selectedParentId === p.id;
                      const genderLabel = p.gender === "Père" ? "Père" : p.gender === "Mère" ? "Mère" : "Tuteur";
                      return (
                        <button key={p.id} onClick={() => setSelectedParentId(p.id)}
                          className={`w-full text-left px-3 py-2.5 text-sm flex items-center justify-between border transition-colors ${isSelected ? "border-pink-500 bg-pink-50 text-pink-800" : "border-slate-200 text-slate-700 hover:border-slate-400"}`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-4 h-4 border-2 flex items-center justify-center rounded-full ${isSelected ? "border-pink-500" : "border-slate-300"}`}>
                              {isSelected && <div className="w-2 h-2 bg-pink-500 rounded-full" />}
                            </div>
                            <div>
                              <span className="font-medium">{p.name}</span>
                              {p.gender && (<span className={`text-xs ml-2 px-1.5 py-0.5 ${p.gender === "Père" ? "bg-blue-50 text-blue-700" : "bg-pink-50 text-pink-700"}`}>{genderLabel}</span>)}
                            </div>
                          </div>
                          <div className="text-xs text-slate-400">{p.phone && <span>{p.phone}</span>}</div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-2">{openModal && (<Btn size="sm" variant="ghost" onClick={() => openModal("add-parent")}><Plus size={11} /> Créer un nouveau parent</Btn>)}</div>
                </>
              )}
              {selectedParentId && (<p className="text-xs text-emerald-600 mt-1 flex items-center gap-1"><Check size={11} /> Parent sélectionné</p>)}
            </div>
          </div>
        )}

        {/* Section 2: Type d'abonnement & Forfait */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">2. Type d'abonnement</p>
          <div className="border border-slate-200 p-4 space-y-3">
            <div className="flex gap-2">
              {["Session", "Annuel"].map(t => (
                <button key={t} onClick={() => { 
                  setSubscriptionType(t); 
                  setSubType(`${activities} activités/semaine`);
                  const newStart = new Date().toISOString().split("T")[0];
                  setValidityStart(newStart);
                  setValidityEnd(calculateEndDateFromStart(newStart, t));
                }}
                  className={`px-4 py-2 text-sm border font-medium transition-colors ${subscriptionType === t ? "border-pink-500 bg-pink-500 text-white" : "border-slate-300 text-slate-600 hover:border-slate-400"}`}>{t}</button>
              ))}
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Forfait (activités/semaine)</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries({ "1": "1 activité/semaine", "2": "2 activités/semaine", "3": "3 activités/semaine", "4": "4 activités/semaine" }).map(([key, label]) => (
                  <button key={key} onClick={() => { setActivities(key); setSubType(`${key} activités/semaine`); }}
                    className={`px-3 py-2 text-xs border font-medium transition-colors text-left ${activities === key ? "border-pink-500 bg-pink-50 text-pink-700" : "border-slate-200 text-slate-600 hover:border-slate-400"}`}>
                    <div>{label}</div>
                    <div className="text-pink-600 mt-0.5">{PRICE_TABLE[key][subscriptionType].toLocaleString()} Dhs</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Activités → Groupes → Cours (combination builder) */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">3. Activités, Groupes & Cours <span className="text-pink-500">(max {courseLimit} cours/semaine)</span></p>
          <div className="border border-slate-200 p-4">
            {/* Saved combinations display */}
            {combinations.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {combinations.map((combo, i) => {
                  const actNames = combo.activities.map(id => groups.find(g => g.id === id)?.name || id).join(", ");
                  const grpNames = combo.groupItems.join(", ");
                  const courseNames = combo.courses.map(id => allExercises.find(e => e.id === id)?.name || id).join(", ");
                  const label = [actNames, grpNames, courseNames].filter(Boolean).join(" | ");
                  return (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-1 text-[10px] bg-pink-50 text-pink-700 border border-pink-200 rounded-sm">
                      <span className="max-w-[200px] truncate">{label}</span>
                      <button onClick={() => removeCombination(i)} className="text-pink-400 hover:text-pink-700 ml-0.5"><X size={10} /></button>
                    </span>
                  );
                })}
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              {/* Step a: Activités */}
              <div className="border border-slate-200 p-2">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">a) Activités</p>
                <div className="relative mb-1">
                  <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input className={`${inputCls} pl-6 text-[11px] py-1`} placeholder="Rechercher..." value={activitySearch} onChange={e => setActivitySearch(e.target.value)} />
                </div>
                <div className="max-h-40 overflow-y-auto border border-slate-200 divide-y divide-slate-100">
                  {(() => {
                    let filtered = groups;
                    const sq = activitySearch.toLowerCase();
                    if (sq) filtered = filtered.filter(g => g.name.toLowerCase().includes(sq));
                    if (filtered.length === 0) return <div className="px-2 py-2 text-[11px] text-slate-400 text-center">Aucune activité</div>;
                    return filtered.slice(0, 30).map(group => {
                      const isSelected = selectedActivities.includes(group.id);
                      const groupCourses = allExercises.filter(ex => ex.group_id === group.id);
                      return (
                        <button key={group.id} onClick={() => toggleActivity(group.id)}
                          className={`w-full text-left px-2 py-1.5 text-[11px] flex items-center justify-between transition-colors ${isSelected ? "bg-pink-50 text-pink-800" : "text-slate-700 hover:bg-slate-50"}`}>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className={`w-3 h-3 border flex items-center justify-center shrink-0 ${isSelected ? "bg-pink-500 border-pink-500" : "border-slate-300"}`}>
                              {isSelected && <Check size={7} className="text-white" />}
                            </div>
                            <span className="font-medium truncate">{group.name}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 ml-1 shrink-0">({groupCourses.length})</span>
                        </button>
                      );
                    });
                  })()}
                  {groups.length > 30 && !activitySearch && <div className="px-2 py-1.5 text-[10px] text-slate-400 text-center">+ {groups.length - 30} autres (utilisez la recherche)</div>}
                </div>
                {selectedActivities.length > 0 && <p className="text-[10px] text-pink-600 mt-0.5">{selectedActivities.length} sélectionnée(s)</p>}
              </div>

              {/* Step b: Groupes */}
              <div className="border border-slate-200 p-2">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">b) Groupes</p>
                {selectedActivities.length === 0 ? (<p className="text-[11px] text-slate-400 italic">Sélectionnez d'abord des activités</p>) : (
                  <>
                    <div className="relative mb-1">
                      <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input className={`${inputCls} pl-6 text-[11px] py-1`} placeholder="Filtrer..." value={groupItemSearch} onChange={e => setGroupItemSearch(e.target.value)} />
                    </div>
                    <div className="max-h-40 overflow-y-auto border border-slate-200 divide-y divide-slate-100">
                      {(() => {
                        let filtered = availableGroupItems;
                        const sq = groupItemSearch.toLowerCase();
                        if (sq) filtered = filtered.filter(item => item.toLowerCase().includes(sq));
                        if (filtered.length === 0) return <div className="px-2 py-2 text-[11px] text-slate-400 text-center">Aucun groupe</div>;
                        return filtered.slice(0, 30).map(item => {
                          const isSelected = selectedGroupItems.includes(item);
                          return (
                            <button key={item} onClick={() => toggleGroupItem(item)}
                              className={`w-full text-left px-2 py-1.5 text-[11px] flex items-center justify-between transition-colors ${isSelected ? "bg-blue-50 text-blue-800" : "text-slate-700 hover:bg-slate-50"}`}>
                              <div className="flex items-center gap-1.5">
                                <div className={`w-3 h-3 border flex items-center justify-center shrink-0 ${isSelected ? "bg-blue-500 border-blue-500" : "border-slate-300"}`}>
                                  {isSelected && <Check size={7} className="text-white" />}
                                </div>
                                <span className="truncate">{item}</span>
                              </div>
                            </button>
                          );
                        });
                      })()}
                      {availableGroupItems.length > 30 && !groupItemSearch && <div className="px-2 py-1.5 text-[10px] text-slate-400 text-center">+ {availableGroupItems.length - 30} autres (utilisez la recherche)</div>}
                    </div>
                    {selectedGroupItems.length > 0 && <p className="text-[10px] text-blue-600 mt-0.5">{selectedGroupItems.length} sélectionné(s)</p>}
                  </>
                )}
              </div>

              {/* Step c: Cours */}
              <div className="border border-slate-200 p-2">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">c) Cours</p>
                {selectedGroupItems.length === 0 ? (<p className="text-[11px] text-slate-400 italic">Sélectionnez d'abord des groupes</p>) : (
                  <>
                    <div className="relative mb-1">
                      <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input className={`${inputCls} pl-6 text-[11px] py-1`} placeholder="Rechercher..." value={courseSearch} onChange={e => setCourseSearch(e.target.value)} />
                    </div>
                    <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 border border-slate-200">
                      {(() => {
                        let filtered = coursesFiltered;
                        const sq = courseSearch.toLowerCase();
                        if (sq) filtered = filtered.filter(ex => ex.name.toLowerCase().includes(sq));
                        if (filtered.length === 0) return <div className="px-2 py-2 text-[11px] text-slate-400 text-center">Aucun cours</div>;
                        return filtered.slice(0, 30).map(ex => {
                          const isSelected = selectedCourses.includes(ex.id);
                          const groupName = groups.find(g => g.id === ex.group_id)?.name;
                          return (
                            <button key={ex.id} onClick={() => toggleCourse(ex.id)}
                              className={`w-full text-left px-2 py-1.5 text-[11px] flex items-center justify-between transition-colors ${isSelected ? "bg-emerald-50 text-emerald-800" : "text-slate-700 hover:bg-slate-50"}`}>
                              <div className="flex items-center gap-1.5 min-w-0">
                                <div className={`w-3 h-3 border flex items-center justify-center shrink-0 ${isSelected ? "bg-emerald-500 border-emerald-500" : "border-slate-300"}`}>
                                  {isSelected && <Check size={7} className="text-white" />}
                                </div>
                                <div className="truncate">
                                  <span className="font-medium">{ex.name}</span>
                                  <span className="text-[10px] text-slate-400 ml-1">{ex.day} {ex.start_time}</span>
                                </div>
                              </div>
                              {groupName && <span className="text-[10px] text-slate-400 ml-1 shrink-0">[{groupName}]</span>}
                            </button>
                          );
                        });
                      })()}
                      {coursesFiltered.length > 30 && !courseSearch && <div className="px-2 py-1.5 text-[10px] text-slate-400 text-center">+ {coursesFiltered.length - 30} autres (utilisez la recherche)</div>}
                    </div>
                    {selectedCourses.length > 0 && <p className="text-[10px] text-emerald-600 mt-0.5">{selectedCourses.length} sélectionné(s)</p>}
                  </>
                )}
              </div>
            </div>

            {/* Save button */}
            <div className="mt-3 flex items-center justify-between">
              <div className="text-[11px] text-slate-500">
                {selectedActivities.length > 0 || selectedGroupItems.length > 0 || selectedCourses.length > 0 ? (
                  <span>Activités: {selectedActivities.length} | Groupes: {selectedGroupItems.length} | Cours: {selectedCourses.length}</span>
                ) : (
                  <span className="italic">Sélectionnez des éléments puis cliquez sur Enregistrer</span>
                )}
                {totalCourseCount > 0 && (
                  <span className="ml-2 text-pink-500 font-medium">{totalCourseCount}/{courseLimit} cours</span>
                )}
              </div>
              <button
                onClick={saveCombination}
                disabled={selectedActivities.length === 0 && selectedGroupItems.length === 0 && selectedCourses.length === 0}
                className="px-4 py-1.5 text-xs font-semibold bg-pink-500 text-white hover:bg-pink-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus size={12} className="inline mr-1" />Enregistrer la combinaison
              </button>
            </div>
          </div>
        </div>

        {/* Sections 4-6: Financial, Date, Payment */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">4. Détails financiers</p>
          <div className="border border-slate-200 p-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Montant de base (Dhs)"><div className={`${inputCls} bg-slate-100 text-slate-600`}>{baseAmount.toLocaleString()} Dhs</div></Field>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-slate-500 mb-1">Remise</p>
                    {discountType === "percent" ? (
                      <div className="relative"><input type="number" className={`${inputCls} pr-8`} value={discountPercent} onChange={e => setDiscountPercent(Number(e.target.value))} placeholder="0" min="0" max="100" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span></div>
                    ) : (<input type="number" className={inputCls} value={discount} onChange={e => setDiscount(Number(e.target.value))} placeholder="0" />)}
                  </div>
                  <div className="flex gap-1 pt-5">
                    <button type="button" onClick={() => { setDiscountType("fixed"); setDiscountPercent(0); }} className={`px-2 py-1 text-xs border font-medium transition-colors ${discountType === "fixed" ? "border-pink-500 bg-pink-50 text-pink-700" : "border-slate-200 text-slate-500 hover:border-slate-400"}`}>Dhs</button>
                    <button type="button" onClick={() => { setDiscountType("percent"); setDiscount(0); }} className={`px-2 py-1 text-xs border font-medium transition-colors ${discountType === "percent" ? "border-pink-500 bg-pink-50 text-pink-700" : "border-slate-200 text-slate-500 hover:border-slate-400"}`}>%</button>
                  </div>
                </div>
              </div>
              <Field label="Assurance (Dhs)"><input type="number" className={inputCls} value={insurance} onChange={e => setInsurance(Number(e.target.value))} /></Field>
              <Field label="Droit d'entrée (Dhs)"><input type="number" className={inputCls} value={entryFee} onChange={e => setEntryFee(Number(e.target.value))} /></Field>
            </div>
            <div className="mt-3 border-t border-slate-200 pt-3 flex justify-between items-center">
              <span className="text-sm font-semibold text-slate-700">Total à payer</span>
              <span className="text-lg font-bold text-pink-600">{total.toLocaleString()} Dhs</span>
            </div>
            <div className="mt-3 border-t border-slate-200 pt-3 grid grid-cols-2 gap-4">
              <Field label="Date de début (Validité)">
                <input type="date" className={inputCls} value={validityStart} onChange={e => {
                  setValidityStart(e.target.value);
                  setValidityEnd(calculateEndDateFromStart(e.target.value, subscriptionType));
                }} />
              </Field>
              <Field label="Date de fin (Validité)">
                <input type="date" className={inputCls} value={validityEnd} onChange={e => setValidityEnd(e.target.value)} />
              </Field>
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">5. Date d'opérations</p>
          <div className="border border-slate-200 p-4">
            <Field label="Date d'opérations"><input type="date" className={inputCls} value={subscriptionDate} onChange={e => setSubscriptionDate(e.target.value)} /></Field>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">6. Moyen de paiement</p>
          <div className="border border-slate-200 p-4 space-y-4">
            <div className="flex gap-2 flex-wrap">
              {(["espece", "virement", "cheque"] as PaymentMethod[]).map(m => {
                const Icon = METHOD_ICONS[m]; const isSelected = paymentMethods.includes(m);
                return (<button key={m} onClick={() => togglePaymentMethod(m)} className={`flex items-center gap-2 px-4 py-2.5 text-sm border font-medium transition-colors ${isSelected ? "border-pink-500 bg-pink-50 text-pink-700" : "border-slate-300 text-slate-600 hover:border-slate-400"}`}><Icon size={14} /> {METHOD_LABELS[m]} {isSelected && <Check size={12} className="text-pink-500" />}</button>);
              })}
            </div>
            {paymentMethods.includes("espece") && (<div className="grid grid-cols-2 gap-4"><Field label="Montant en Espèce (Dhs)"><input type="number" className={inputCls} value={especeAmount} onChange={e => setEspeceAmount(Math.max(0, Number(e.target.value)))} placeholder="0" /></Field></div>)}
            {paymentMethods.includes("virement") && (<div className="grid grid-cols-2 gap-4"><Field label="Montant Virement (Dhs)"><input type="number" className={inputCls} value={virementAmount} onChange={e => setVirementAmount(Math.max(0, Number(e.target.value)))} placeholder="0" /></Field></div>)}
            {paymentMethods.includes("cheque") && (
              <div>
                <div className="mb-3 border border-dashed border-slate-300">
                  <button onClick={() => setShowNewCheckForm(!showNewCheckForm)} className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-500 uppercase hover:bg-slate-50 transition-colors">
                    <span><Plus size={11} className="inline mr-1" />Nouveau chèque</span><span className={showNewCheckForm ? "rotate-45" : ""}><Plus size={12} /></span>
                  </button>
                  {showNewCheckForm && (
                    <div className="px-3 pb-3 space-y-2">
                      <div className="grid grid-cols-3 gap-2">
                        <input className={`${inputCls} text-xs`} placeholder="N°" value={newCheckNum} onChange={e => setNewCheckNum(e.target.value)} />
                        <input type="number" className={`${inputCls} text-xs`} placeholder="Montant" value={newCheckAmount} onChange={e => setNewCheckAmount(e.target.value)} />
                        <input className={`${inputCls} text-xs`} placeholder="Banque" value={newCheckBank} onChange={e => setNewCheckBank(e.target.value)} />
                        <input className={`${inputCls} text-xs`} placeholder="Titulaire" value={newCheckHolder} onChange={e => setNewCheckHolder(e.target.value)} />
                        <input type="date" className={`${inputCls} text-xs`} value={newCheckDateEmission} onChange={e => setNewCheckDateEmission(e.target.value)} />
                        <input type="date" className={`${inputCls} text-xs`} value={newCheckDateExecution} onChange={e => setNewCheckDateExecution(e.target.value)} />
                      </div>
                      <div className="flex items-center gap-2">
                        <Btn size="sm" onClick={handleCreateCheckInline} disabled={savingCheck}>{savingCheck ? "..." : <><Plus size={11} /> Créer</>}</Btn>
                        {newCheckCreated && <span className="text-xs text-emerald-600 flex items-center gap-1"><Check size={10} /> Créé !</span>}
                      </div>
                    </div>
                  )}
                </div>
                <div className="relative mb-3" ref={checkSearchRef}>
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input className={`${inputCls} pl-8`} placeholder="Rechercher un chèque..." value={checkSearch} onChange={e => { setCheckSearch(e.target.value); setShowCheckSuggestions(true); }} onFocus={() => setShowCheckSuggestions(true)} />
                  {showCheckSuggestions && checkSearch && (
                    <div className="absolute z-10 top-full left-0 right-0 bg-white border border-slate-200 shadow-lg max-h-48 overflow-y-auto">
                      {filteredChecks.length === 0 ? <div className="px-3 py-2 text-xs text-slate-400">Aucun chèque disponible</div> : (
                        filteredChecks.map(c => { const rest = c.amount - c.montant_used; return (
                          <button key={c.id} onClick={() => handleSelectCheck(c)} className="w-full text-left px-3 py-2 text-sm hover:bg-pink-50 transition-colors flex items-center justify-between text-slate-700">
                            <div><span className="font-mono font-semibold">#{c.number}</span><span className="text-xs text-slate-400 ml-2">{c.bank || "—"}</span></div>
                            <div className="text-xs"><span className="text-slate-500">{rest.toLocaleString()} Dhs</span><span className="text-slate-300 ml-1">disponible</span></div>
                          </button>
                        );})
                      )}
                    </div>
                  )}
                </div>
                {selectedChecks.length > 0 && (<div className="space-y-1">{selectedChecks.map(sc => (
                  <div key={sc.check.id} className="flex items-center justify-between bg-slate-50 px-3 py-2 text-sm">
                    <div className="flex items-center gap-2"><span className="font-mono font-semibold text-slate-700">#{sc.check.number}</span><span className="text-xs text-slate-400">{sc.check.bank}</span></div>
                    <div className="flex items-center gap-2">
                      <input type="number" className="w-24 text-xs border border-slate-200 px-2 py-1 text-right" value={sc.amount} onChange={e => updateCheckAmount(sc.check.id, Number(e.target.value))} min={0} max={sc.check.amount - sc.check.montant_used} />
                      <span className="text-xs text-slate-400">/ {(sc.check.amount - sc.check.montant_used).toLocaleString()} Dhs</span>
                      <button onClick={() => removeSelectedCheck(sc.check.id)} className="p-1 text-slate-400 hover:text-red-500 transition-colors"><X size={12} /></button>
                    </div>
                  </div>
                ))}</div>)}
              </div>
            )}
            {paymentMethods.length > 0 && (
              <div className="border-t border-slate-200 pt-3 space-y-1 text-sm">
                <div className="flex justify-between text-slate-600"><span>Total à payer</span><span className="font-semibold">{total.toLocaleString()} Dhs</span></div>
                {especeAmount > 0 && <div className="flex justify-between text-slate-500 text-xs"><span>Espèce</span><span>{especeAmount.toLocaleString()} Dhs</span></div>}
                {virementAmount > 0 && <div className="flex justify-between text-slate-500 text-xs"><span>Virement</span><span>{virementAmount.toLocaleString()} Dhs</span></div>}
                {totalChecksAmount > 0 && <div className="flex justify-between text-slate-500 text-xs"><span>Chèques</span><span>{totalChecksAmount.toLocaleString()} Dhs</span></div>}
                <div className="flex justify-between font-semibold border-t border-slate-200 pt-1">
                  <span>Payé</span><span className={totalPaid >= total ? "text-emerald-600" : "text-amber-600"}>{totalPaid.toLocaleString()} Dhs{totalPaid < total && <span className="text-xs text-slate-400 ml-1">(reste {remaining.toLocaleString()} Dhs)</span>}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
          <Btn variant="outline" onClick={onClose}>Annuler</Btn>
          <Btn onClick={handleSubmit} disabled={loading || !selectedChild}>{loading ? "Création..." : "Créer l'abonnement"}</Btn>
        </div>
      </div>
    </Modal>
  );
}