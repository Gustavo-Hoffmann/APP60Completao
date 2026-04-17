import type { AuthedUser } from "../middleware/auth.js";
export declare const ROLES: readonly ["SUPER_ADMIN", "ADMIN", "GESTOR", "SUPERVISOR", "AVALIADOR"];
export type AppRole = (typeof ROLES)[number];
export declare function isSuperAdmin(u: AuthedUser): boolean;
export declare function institutionIdOrThrow(u: AuthedUser): string;
export declare function canListUsers(u: AuthedUser): boolean;
export declare function canCreateUsers(u: AuthedUser): boolean;
export declare function canManageInstitutions(u: AuthedUser): boolean;
/** Participantes: leitura para qualquer papel com instituição ou super admin */
export declare function canReadParticipants(u: AuthedUser): boolean;
export declare function canWriteParticipants(u: AuthedUser): boolean;
export declare function creatableRolesByActor(actor: AuthedUser): AppRole[];
