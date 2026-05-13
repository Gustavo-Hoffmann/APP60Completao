import type { Role } from "../../types/auth";

/** Quem acessa telas de gestão de usuários */
export function canManageUsers(role: Role) {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

export function canSeeAllData(role: Role) {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

export function canCreateInstitutions(role: Role) {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

/** Papéis que um Super Admin pode criar */
export function creatableRolesForSuperAdmin(): Role[] {
  return ["ADMIN", "GESTOR", "SUPERVISOR", "AVALIADOR"];
}

/** Papéis que um Admin pode criar */
export function creatableRolesForAdmin(): Role[] {
  return ["GESTOR", "SUPERVISOR", "AVALIADOR"];
}

/** Papéis que um Gestor pode criar */
export function creatableRolesForGestor(): Role[] {
  return ["SUPERVISOR", "AVALIADOR"];
}

/** Papéis que um Supervisor pode criar */
export function creatableRolesForSupervisor(): Role[] {
  return ["AVALIADOR"];
}

export function canCreateAdminUser(actor: Role) {
  return actor === "SUPER_ADMIN";
}

export function roleRequiresInstitution(role: Role) {
  return role !== "ADMIN";
}
