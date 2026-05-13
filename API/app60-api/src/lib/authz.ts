import type { AuthedUser } from "../middleware/auth.js";
import type { Pool } from "pg";
import { getSeniorSensePlusInstitutionId } from "./seniorsenseInstitution.js";

export const ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "GESTOR",
  "SUPERVISOR",
  "AVALIADOR",
] as const;

export type AppRole = (typeof ROLES)[number];

export function normalizeAppRole(role: unknown): AppRole | null {
  if (typeof role !== "string") return null;
  const normalized = role.trim().toUpperCase();
  return ROLES.includes(normalized as AppRole) ? (normalized as AppRole) : null;
}

export function isSuperAdmin(u: AuthedUser) {
  return u.role === "SUPER_ADMIN";
}

export function isAdmin(u: AuthedUser) {
  return u.role === "ADMIN";
}

export function isPlatformStaff(u: AuthedUser) {
  return isSuperAdmin(u) || isAdmin(u);
}

export function isGlobalOperator(u: AuthedUser) {
  return isPlatformStaff(u) && !u.primary_institution_id;
}

export function roleRequiresInstitution(role: AppRole) {
  return role !== "ADMIN";
}

export function institutionIdOrThrow(u: AuthedUser): string {
  if (!u.primary_institution_id) {
    throw new Error("Instituição não definida para o usuário.");
  }
  return u.primary_institution_id;
}

export async function resolveCollectionInstitutionId(
  pool: Pool,
  u: AuthedUser
): Promise<string> {
  if (u.primary_institution_id) {
    return u.primary_institution_id;
  }
  if (isGlobalOperator(u)) {
    return getSeniorSensePlusInstitutionId(pool);
  }
  throw new Error("Instituição não definida para o usuário.");
}

export function canListUsers(u: AuthedUser) {
  return (
    isGlobalOperator(u) ||
    u.role === "GESTOR" ||
    u.role === "SUPERVISOR" ||
    (u.role === "ADMIN" && !!u.primary_institution_id)
  );
}

export function canCreateUsers(u: AuthedUser) {
  return (
    isGlobalOperator(u) ||
    u.role === "GESTOR" ||
    u.role === "SUPERVISOR" ||
    (u.role === "ADMIN" && !!u.primary_institution_id)
  );
}

export function canManageInstitutions(u: AuthedUser) {
  return isGlobalOperator(u) || (u.role === "ADMIN" && !!u.primary_institution_id);
}

/** Participantes: leitura para qualquer papel com instituição ou operador global */
export function canReadParticipants(u: AuthedUser) {
  return isGlobalOperator(u) || !!u.primary_institution_id;
}

export function canWriteParticipants(u: AuthedUser) {
  return (
    isGlobalOperator(u) ||
    u.role === "GESTOR" ||
    u.role === "SUPERVISOR" ||
    u.role === "AVALIADOR" ||
    (u.role === "ADMIN" && !!u.primary_institution_id)
  );
}

export function creatableRolesByActor(actor: AuthedUser): AppRole[] {
  const actorRole = normalizeAppRole(actor.role);
  if (actorRole === "SUPER_ADMIN") {
    return ["ADMIN", "GESTOR", "SUPERVISOR", "AVALIADOR"];
  }
  if (actorRole === "ADMIN") {
    return ["GESTOR", "SUPERVISOR", "AVALIADOR"];
  }
  if (actorRole === "GESTOR") {
    return ["SUPERVISOR", "AVALIADOR"];
  }
  if (actorRole === "SUPERVISOR") {
    return ["AVALIADOR"];
  }
  return [];
}

export function canActorCreateRole(actor: AuthedUser, targetRole: AppRole) {
  return creatableRolesByActor(actor).includes(targetRole);
}

export function canMigrateUsers(u: AuthedUser) {
  return isGlobalOperator(u);
}
