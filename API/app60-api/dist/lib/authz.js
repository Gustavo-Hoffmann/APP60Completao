export const ROLES = [
    "SUPER_ADMIN",
    "ADMIN",
    "GESTOR",
    "SUPERVISOR",
    "AVALIADOR",
];
export function isSuperAdmin(u) {
    return u.role === "SUPER_ADMIN";
}
export function institutionIdOrThrow(u) {
    if (!u.primary_institution_id) {
        throw new Error("Instituição não definida para o usuário.");
    }
    return u.primary_institution_id;
}
export function canListUsers(u) {
    return u.role === "SUPER_ADMIN" || u.role === "ADMIN" || u.role === "GESTOR";
}
export function canCreateUsers(u) {
    return u.role === "SUPER_ADMIN" || u.role === "ADMIN" || u.role === "GESTOR";
}
export function canManageInstitutions(u) {
    return u.role === "SUPER_ADMIN" || u.role === "ADMIN";
}
/** Participantes: leitura para qualquer papel com instituição ou super admin */
export function canReadParticipants(u) {
    return isSuperAdmin(u) || !!u.primary_institution_id;
}
export function canWriteParticipants(u) {
    return (isSuperAdmin(u) ||
        u.role === "ADMIN" ||
        u.role === "GESTOR" ||
        u.role === "SUPERVISOR" ||
        u.role === "AVALIADOR");
}
export function creatableRolesByActor(actor) {
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
