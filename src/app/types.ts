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
  created_at: string;
}

export interface ParentDetail extends Parent {
  parent_children: { child_id: string }[];
}