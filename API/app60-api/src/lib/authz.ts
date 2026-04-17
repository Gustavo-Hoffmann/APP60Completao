import type { AuthedUser } from "../middleware/auth.js";

export const ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "GESTOR",
  "SUPERVISOR",
  "AVALIADOR",
] as const;

export type AppRole = (typeof ROLES)[number];

export function isSuperAdmin(u: AuthedUser) {
  return u.role === "SUPER_ADMIN";
}

export function institutionIdOrThrow(u: AuthedUser): string {
  if (!u.primary_institution_id) {
    throw new Error("Instituição não definida para o usuário.");
  }
  return u.primary_institution_id;
}

export function canListUsers(u: AuthedUser) {
  return u.role === "SUPER_ADMIN" || u.role === "ADMIN" || u.role === "GESTOR";
}

export function canCreateUsers(u: AuthedUser) {
  return u.role === "SUPER_ADMIN" || u.role === "ADMIN" || u.role === "GESTOR";
}

export function canManageInstitutions(u: AuthedUser) {
  return u.role === "SUPER_ADMIN" || u.role === "ADMIN";
}

/** Participantes: leitura para qualquer papel com instituição ou super admin */
export function canReadParticipants(u: AuthedUser) {
  return isSuperAdmin(u) || !!u.primary_institution_id;
}

export function canWriteParticipants(u: AuthedUser) {
  return (
    isSuperAdmin(u) ||
    u.role === "ADMIN" ||
    u.role === "GESTOR" ||
    u.role === "SUPERVISOR" ||
    u.role === "AVALIADOR"
  );
}

export function creatableRolesByActor(actor: AuthedUser): AppRole[] {
  if (actor.role === "SUPER_ADMIN") {
    return ["ADMIN", "GESTOR", "SUPERVISOR", "AVALIADOR"];
  }
  if (actor.role === "ADMIN") {
    return ["GESTOR", "SUPERVISOR", "AVALIADOR"];
  }
  if (actor.role === "GESTOR") {
    return ["SUPERVISOR", "AVALIADOR"];
  }
  return [];
}
