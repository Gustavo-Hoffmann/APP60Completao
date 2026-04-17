import type { Role } from "../../types/auth";

/** Quem acessa telas de gestão de usuários */
export function canManageUsers(role: Role) {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

export function canSeeAllData(role: Role) {
  return role === "SUPER_ADMIN";
}

export function canCreateInstitutions(role: Role) {
  return role === "SUPER_ADMIN";
}

/** Papéis que um Super Admin pode criar */
export function creatableRolesForSuperAdmin(): Role[] {
  return ["ADMIN", "GESTOR", "SUPERVISOR", "AVALIADOR"];
}

/** Papéis que um Admin institucional pode criar */
export function creatableRolesForAdmin(): Role[] {
  return ["GESTOR", "SUPERVISOR", "AVALIADOR"];
}

export function canCreateAdminUser(actor: Role) {
  return actor === "SUPER_ADMIN";
}
