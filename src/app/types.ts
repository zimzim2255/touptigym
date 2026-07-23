export type Role = "admin" | "worker" | "trainer";

export type ModalType =
  | null
  | "add-child" | "child-detail"
  | "add-parent" | "parent-detail"
  | "add-subscription" | "subscription-detail"
  | "add-check" | "check-detail"
  | "add-trainer" | "trainer-detail"
  | "justify-absence"
  | "add-request"
  | "mark-attendance"
  | "add-exercice" | "exercice-detail";

export interface Child {
  id: string;
  name: string;
  gender: string;
  birth_date: string;
  age: number;
  school: string | null;
  school_type: string | null;
  address: string | null;
  postal_code: string | null;
  client_type: string;
  zkteco_id: string | null;
  photo: string | null;
  created_at: string;
}

export interface Parent {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  id_card: string | null;
  gender: string;
  created_at: string;
}

export interface ParentDetail extends Parent {
  parent_children: { child_id: string }[];
}

export interface Exercise {
  id: string;
  name: string;
  day: string;
  type: string;
  start_date: string | null;
  end_date: string | null;
  start_time: string;
  end_time: string;
  coach_id: string | null;
  price: number;
  created_at: string;
}

export interface Check {
  id: string;
  number: string;
  amount: number;
  bank: string | null;
  account_holder: string | null;
  date_emission: string | null;
  date_execution: string | null;
  used: boolean;
  montant_used: number;
  payment_id: string | null;
  file: string | null;
  created_at: string;
}

export interface UrgentRequest {
  id: string;
  child_id: string;
  exercise_id: string;
  date: string;
  notes: string | null;
  status: "en_attente" | "approuvée" | "rejetée";
  created_by: string | null;
  created_at: string;
  children: { name: string } | null;
  exercises: { name: string } | null;
  users: { name: string } | null;
}