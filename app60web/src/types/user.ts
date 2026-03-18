import type { Role } from "./auth";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  professorId?: string | null;
  isActive: boolean;
  cpf?: string | null;
  phone?: string | null;
  institution?: string | null;
  city?: string | null;
  state?: string | null;
  birthDate?: string | null;
};