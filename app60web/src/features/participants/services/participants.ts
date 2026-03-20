import { supabase } from "../../../lib/supabase/client";
import { mariaSilvaMock } from "../../../mocks/participants";
import type { Participant } from "../../../types/participant";

type ParticipantRow = {
  id: string;
  full_name: string;
  cpf: string | null;
  birth_date: string | null;
  sex: string | null;
  created_by: string;
  owner_student_id: string | null;
  owner_professor_id: string | null;
  city: string | null;
  state: string | null;
  created_at: string;
  updated_at: string;
};

function calcAgeFromDate(date?: string | null) {
  if (!date) return 0;
  const birth = new Date(date);
  if (Number.isNaN(birth.getTime())) return 0;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }

  return age;
}

function formatCpf(value?: string | null) {
  const d = String(value ?? "")
    .replace(/\D/g, "")
    .slice(0, 11);

  if (!d) return "";

  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

function mapParticipant(row: ParticipantRow): Participant {
  return {
    id: row.id,
    name: row.full_name,
    cpf: formatCpf(row.cpf),
    age: calcAgeFromDate(row.birth_date),
    sex: row.sex === "Masculino" ? "Masculino" : "Feminino",
    createdByUserId: row.created_by,
    professorId: row.owner_professor_id ?? undefined,
    studentId: row.owner_student_id ?? undefined,
    dob: row.birth_date ?? undefined,
    city: row.city ?? undefined,
    state: row.state ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getFallbackParticipant(): Participant {
  return mariaSilvaMock;
}

export async function listParticipants(): Promise<Participant[]> {
  const { data, error } = await supabase
    .from("participants")
    .select(
      "id, full_name, cpf, birth_date, sex, created_by, owner_student_id, owner_professor_id, city, state, created_at, updated_at",
    )
    .order("full_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const real = (data ?? []).map((row) => mapParticipant(row as ParticipantRow));

  const hasMariaMockAlready = real.some((participant) => participant.id === mariaSilvaMock.id);

  return hasMariaMockAlready ? real : [mariaSilvaMock, ...real];
}

export async function getParticipantById(id: string): Promise<Participant | null> {
  if (id === mariaSilvaMock.id) {
    return mariaSilvaMock;
  }

  const { data, error } = await supabase
    .from("participants")
    .select(
      "id, full_name, cpf, birth_date, sex, created_by, owner_student_id, owner_professor_id, city, state, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) return null;
  return mapParticipant(data as ParticipantRow);
}