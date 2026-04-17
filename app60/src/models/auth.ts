export type Role =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "GESTOR"
  | "SUPERVISOR"
  | "AVALIADOR";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  institution_id: string | null;
  is_active?: boolean;
  cpf?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  birth_date?: string | null;
};
