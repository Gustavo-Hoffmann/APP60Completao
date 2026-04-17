import type { Role } from "../../types/auth";

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Administrador",
  GESTOR: "Gestor",
  SUPERVISOR: "Supervisor",
  AVALIADOR: "Avaliador / Pesquisador",
};
