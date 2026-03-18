export type Role = "ADMIN" | "PROFESSOR" | "ALUNO";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  professor_id?: string | null;
  is_active?: boolean;
  cpf?: string | null;
  phone?: string | null;
  institution?: string | null;
  city?: string | null;
  state?: string | null;
  birth_date?: string | null;
};

export type SignInPayload = {
  email: string;
  password: string;
};