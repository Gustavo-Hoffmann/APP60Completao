import type { Participant } from "../models/types";
import { supabase } from "./supabase/client";

export const TEST_PARTICIPANT_ID = "__participant_test__";

type ParticipantRow = {
  id: string;
  full_name: string;
  cpf: string | null;
  birth_date: string | null;
  sex: string | null;
  cep: string | null;
  street: string | null;
  number: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  complement: string | null;
  notes: string | null;
  created_by: string;
  owner_student_id: string | null;
  owner_professor_id: string;
  created_at: string;
  updated_at: string;
};

type MyProfile = {
  id: string;
  role: "ADMIN" | "PROFESSOR" | "ALUNO";
  professor_id: string | null;
};

function isUuid(value?: string | null) {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function formatCpf(value?: string | null) {
  const d = String(value ?? "").replace(/\D/g, "").slice(0, 11);
  if (!d) return "";
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

function mapRowToParticipant(row: ParticipantRow): Participant {
  return {
    id: row.id,
    name: row.full_name,
    cpf: row.cpf ?? "",
    dob: row.birth_date ?? "2000-01-01",
    biologicalSex:
      row.sex === "Masculino" || row.sex === "Feminino" ? row.sex : undefined,
    cep: row.cep ?? undefined,
    address: {
      street: row.street ?? undefined,
      number: row.number ?? undefined,
      neighborhood: row.neighborhood ?? undefined,
      city: row.city ?? undefined,
      uf: row.state ?? undefined,
      complement: row.complement ?? undefined,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getTestParticipant(): Participant {
  const now = new Date().toISOString();

  return {
    id: TEST_PARTICIPANT_ID,
    name: "Sujeito exemplo",
    cpf: "12345678900",
    dob: "1957-01-01",
    biologicalSex: "Feminino",
    address: {
      street: "",
      number: "",
      neighborhood: "",
      city: "Curitiba",
      uf: "PR",
      complement: "",
    },
    createdAt: now,
    updatedAt: now,
  };
}

async function getMyProfile(): Promise<MyProfile> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw new Error(userError.message);
  if (!user) throw new Error("Usuário não autenticado.");

  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, professor_id")
    .eq("id", user.id)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Perfil não encontrado.");
  }

  return data as MyProfile;
}

export async function listParticipants(): Promise<Participant[]> {
  const { data, error } = await supabase
    .from("participants")
    .select(`
      id,
      full_name,
      cpf,
      birth_date,
      sex,
      cep,
      street,
      number,
      neighborhood,
      city,
      state,
      complement,
      notes,
      created_by,
      owner_student_id,
      owner_professor_id,
      created_at,
      updated_at
    `)
    .order("full_name", { ascending: true });

  if (error) {
    throw new Error(`Erro ao listar participantes: ${error.message}`);
  }

  const others = (data ?? []).map((row) => mapRowToParticipant(row as ParticipantRow));
  return [getTestParticipant(), ...others];
}

export async function getParticipantById(id: string): Promise<Participant | null> {
  if (id === TEST_PARTICIPANT_ID) return getTestParticipant();

  const { data, error } = await supabase
    .from("participants")
    .select(`
      id,
      full_name,
      cpf,
      birth_date,
      sex,
      cep,
      street,
      number,
      neighborhood,
      city,
      state,
      complement,
      notes,
      created_by,
      owner_student_id,
      owner_professor_id,
      created_at,
      updated_at
    `)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao carregar participante: ${error.message}`);
  }

  if (!data) return null;
  return mapRowToParticipant(data as ParticipantRow);
}

export async function upsertParticipant(p: Participant): Promise<Participant> {
  if (p.id === TEST_PARTICIPANT_ID) {
    throw new Error("O sujeito exemplo é fixo e não pode ser alterado.");
  }

  const me = await getMyProfile();

  let existing: Pick<
    ParticipantRow,
    "id" | "created_by" | "owner_student_id" | "owner_professor_id" | "created_at"
  > | null = null;

  if (isUuid(p.id)) {
    const { data, error } = await supabase
      .from("participants")
      .select("id, created_by, owner_student_id, owner_professor_id, created_at")
      .eq("id", p.id)
      .maybeSingle();

    if (error) {
      throw new Error(`Erro ao validar participante existente: ${error.message}`);
    }

    existing = data;
  }

  const ownerStudentId =
    existing?.owner_student_id ??
    (me.role === "ALUNO" ? me.id : null);

  const ownerProfessorId =
    existing?.owner_professor_id ??
    (me.role === "ALUNO" ? me.professor_id : me.id);

  if (!ownerProfessorId) {
    throw new Error("Professor responsável não encontrado para este usuário.");
  }

  const payload = {
    ...(existing?.id ? { id: existing.id } : {}),
    full_name: p.name.trim(),
    cpf: String(p.cpf ?? "").replace(/\D/g, ""),
    birth_date: p.dob,
    sex: p.biologicalSex ?? null,
    cep: p.cep ? String(p.cep).replace(/\D/g, "") : null,
    street: p.address?.street?.trim() || null,
    number: p.address?.number?.trim() || null,
    neighborhood: p.address?.neighborhood?.trim() || null,
    city: p.address?.city?.trim() || null,
    state: p.address?.uf?.trim()?.toUpperCase() || null,
    complement: p.address?.complement?.trim() || null,
    notes: null,
    created_by: existing?.created_by ?? me.id,
    owner_student_id: ownerStudentId,
    owner_professor_id: ownerProfessorId,
  };

  const { data, error } = await supabase
    .from("participants")
    .upsert(payload, { onConflict: "id" })
    .select(`
      id,
      full_name,
      cpf,
      birth_date,
      sex,
      cep,
      street,
      number,
      neighborhood,
      city,
      state,
      complement,
      notes,
      created_by,
      owner_student_id,
      owner_professor_id,
      created_at,
      updated_at
    `)
    .single();

  if (error) {
    if (error.message.toLowerCase().includes("duplicate")) {
      throw new Error("Já existe participante com esse CPF.");
    }
    throw new Error(`Erro ao salvar participante: ${error.message}`);
  }

  return mapRowToParticipant(data as ParticipantRow);
}

export async function deleteParticipant(id: string) {
  if (id === TEST_PARTICIPANT_ID) {
    throw new Error("O sujeito exemplo é fixo e não pode ser removido.");
  }

  const { error } = await supabase.from("participants").delete().eq("id", id);

  if (error) {
    throw new Error(`Erro ao excluir participante: ${error.message}`);
  }
}

export function getParticipantSubtitle(p: Participant) {
  const cpf = formatCpf(p.cpf);
  return cpf ? `CPF: ${cpf}` : "Sem CPF";
}