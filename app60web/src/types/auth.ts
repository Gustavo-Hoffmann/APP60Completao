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
  institution_name?: string | null;
  is_active?: boolean;
  cpf?: string | null;
  phone?: string | null;
  country?: string | null;
  city?: string | null;
  state?: string | null;
  birth_date?: string | null;
};

export type SignInPayload = {
  email: string;
  password: string;
};
