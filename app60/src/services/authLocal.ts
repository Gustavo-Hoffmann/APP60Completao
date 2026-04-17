import type { AuthUser } from "../models/auth";
import { normalizeDigits } from "../models/utils";
import { apiFetch, apiJson } from "./apiClient";
import { signInWithPassword, signOut } from "./cognitoClient";

async function fetchMe(): Promise<AuthUser> {
  const data = await apiJson<{
    id: string;
    email: string;
    name: string;
    role: AuthUser["role"];
    institution_id: string | null;
    is_active: boolean;
  }>("/api/me");

  if (!data.is_active) {
    throw new Error("Seu usuário está inativo. Fale com o administrador.");
  }

  return {
    id: data.id,
    email: data.email,
    name: data.name,
    role: data.role,
    institution_id: data.institution_id,
    is_active: data.is_active,
  };
}

export async function getCurrentResearcherId(): Promise<string | null> {
  try {
    const me = await fetchMe();
    return me.id;
  } catch {
    return null;
  }
}

export async function getCurrentResearcher(): Promise<AuthUser | null> {
  try {
    return await fetchMe();
  } catch {
    return null;
  }
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    throw new Error("Informe o e-mail.");
  }

  if (!password.trim()) {
    throw new Error("Informe a senha.");
  }

  await signInWithPassword(normalizedEmail, password);
  return fetchMe();
}

export async function logout() {
  await signOut();
}

export async function registerResearcher(
  _p: { name: string; dob: string; cpf: string; email: string },
  _password: string
) {
  throw new Error(
    "Cadastro no app foi desativado. Crie usuários pelo web com perfil ADMIN ou SUPER_ADMIN."
  );
}

export async function updateResearcher(
  id: string,
  next: { name: string; dob: string; cpf: string; email: string },
  _currentPassword: string | null,
  _newPassword?: string
): Promise<AuthUser> {
  const me = await fetchMe();
  if (me.id !== id) throw new Error("Sem sessão válida.");

  const normalizedCpf = normalizeDigits(next.cpf);

  const res = await apiFetch(`/api/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      fullName: next.name.trim(),
      cpf: normalizedCpf,
      birth_date: next.dob,
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || "Erro ao atualizar perfil.");
  }

  return fetchMe();
}
