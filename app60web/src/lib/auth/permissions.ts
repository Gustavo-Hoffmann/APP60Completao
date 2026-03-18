import type { Role } from "../../types/auth";

export function canManageUsers(role: Role) {
  return role === "ADMIN" || role === "PROFESSOR";
}

export function canSeeAllData(role: Role) {
  return role === "ADMIN";
}

export function canCreateProfessors(role: Role) {
  return role === "ADMIN";
}

export function canCreateStudents(role: Role) {
  return role === "ADMIN" || role === "PROFESSOR";
}