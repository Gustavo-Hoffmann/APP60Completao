import { supabase } from "./supabase/client";
import type { AuthUser } from "../models/auth";
import { normalizeDigits } from "../models/utils";

type ProfileRow = {
  id: string;
  name: string;
  email: string | null;
  role: "ADMIN" | "PROFESSOR" | "ALUNO";
  professor_id: string | null;
  is_active: boolean | null;
  cpf: string | null;
  phone: string | null;
  institution: string | null;
  city: string | null;
  state: string | null;
  birth_date: string | null;
};

function mapProfileToAuthUser(profile: ProfileRow): AuthUser {
  return {
    id: profile.id,
    name: profile.name ?? "",
    email: profile.email ?? "",
    role: profile.role,
    professor_id: profile.professor_id,
    is_active: profile.is_active ?? true,
    cpf: profile.cpf,
    phone: profile.phone,
    institution: profile.institution,
    city: profile.city,
    state: profile.state,
    birth_date: profile.birth_date,
  };
}

async function fetchOwnProfile(userId: string): Promise<AuthUser> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, name, email, role, professor_id, is_active, cpf, phone, institution, city, state, birth_date"
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao carregar perfil: ${error.message}`);
  }

  if (!data) {
    throw new Error("Perfil não encontrado.");
  }

  if (!data.is_active) {
    throw new Error("Seu usuário está inativo. Fale com o administrador.");
  }

  return mapProfileToAuthUser(data as ProfileRow);
}

export async function getCurrentResearcherId(): Promise<string | null> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw new Error(error.message);
  }

  return session?.user?.id ?? null;
}

export async function getCurrentResearcher(): Promise<AuthUser | null> {
  const userId = await getCurrentResearcherId();
  if (!userId) return null;
  return fetchOwnProfile(userId);
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    throw new Error("Informe o e-mail.");
  }

  if (!password.trim()) {
    throw new Error("Informe a senha.");
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (error || !data.user) {
    throw new Error("E-mail ou senha inválidos.");
  }

  return fetchOwnProfile(data.user.id);
}

export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

export async function registerResearcher() {
  throw new Error(
    "Cadastro no app foi desativado. Crie usuários pelo web com perfil ADMIN ou PROFESSOR."
  );
}

export async function updateResearcher(
  id: string,
  next: { name: string; dob: string; cpf: string; email: string },
  currentPassword: string | null,
  newPassword?: string
): Promise<AuthUser> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw new Error(userError.message);
  if (!user || user.id !== id) throw new Error("Sem sessão válida.");

  const normalizedEmail = next.email.trim().toLowerCase();
  const normalizedCpf = normalizeDigits(next.cpf);

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      name: next.name.trim(),
      email: normalizedEmail,
      cpf: normalizedCpf,
      birth_date: next.dob,
    })
    .eq("id", id);

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (newPassword?.trim()) {
    if (!currentPassword?.trim()) {
      throw new Error("Informe a senha atual para trocar a senha.");
    }

    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: user.email ?? normalizedEmail,
      password: currentPassword,
    });

    if (reauthError) {
      throw new Error("Senha atual inválida.");
    }

    const { error: pwError } = await supabase.auth.updateUser({
      password: newPassword.trim(),
    });

    if (pwError) {
      throw new Error(pwError.message);
    }
  }

  if ((user.email ?? "").toLowerCase() !== normalizedEmail) {
    const { error: emailError } = await supabase.auth.updateUser({
      email: normalizedEmail,
    });

    if (emailError) {
      throw new Error(emailError.message);
    }
  }

  return fetchOwnProfile(id);
}