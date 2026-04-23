import type { Participant } from "../models/types";
import { apiFetch, apiJson } from "./apiClient";
import { getCurrentResearcher } from "./authLocal";
import { getGuestProfile } from "./guestSession";

export const TEST_PARTICIPANT_ID = "__participant_test__";
export const GUEST_PARTICIPANT_ID = "__participant_guest__";

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
  created_at: string;
  updated_at: string;
};

function isUuid(value?: string | null) {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
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
  const bio =
    row.sex === "M" || row.sex === "Masculino"
      ? "Masculino"
      : row.sex === "F" || row.sex === "Feminino"
        ? "Feminino"
        : undefined;

  return {
    id: row.id,
    name: row.full_name,
    cpf: row.cpf ?? "",
    dob: row.birth_date ?? "2000-01-01",
    biologicalSex: bio,
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

function ageToDob(age: number): string {
  const now = new Date();
  const year = now.getUTCFullYear() - Math.max(0, Math.floor(age));
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

export function getGuestParticipant(): Participant {
  const now = new Date().toISOString();
  const profile = getGuestProfile();

  const age = profile?.age ?? 70;
  const sex = profile?.sex ?? "F";

  return {
    id: GUEST_PARTICIPANT_ID,
    name: "Visitante",
    cpf: "",
    dob: ageToDob(age),
    biologicalSex: sex === "M" ? "Masculino" : "Feminino",
    address: {
      street: "",
      number: "",
      neighborhood: "",
      city: "",
      uf: "",
      complement: "",
    },
    createdAt: now,
    updatedAt: now,
  };
}

export function getParticipantSubtitle(p: Participant) {
  const cpf = formatCpf(p.cpf);
  return cpf ? `CPF: ${cpf}` : "Sem CPF";
}

export async function listParticipants(): Promise<Participant[]> {
  const bundle = await apiJson<{ participants: ParticipantRow[] }>("/api/participants");
  const rows = bundle.participants ?? [];
  const mapped = rows.map((row) => mapRowToParticipant(row));
  return [getTestParticipant(), ...mapped];
}

export async function getParticipantById(id: string): Promise<Participant | null> {
  if (id === TEST_PARTICIPANT_ID) return getTestParticipant();

  const data = await apiJson<{ participant: ParticipantRow }>(`/api/participants/${id}`);
  if (!data?.participant) return null;
  return mapRowToParticipant(data.participant);
}

export async function upsertParticipant(p: Participant): Promise<Participant> {
  if (p.id === TEST_PARTICIPANT_ID) {
    throw new Error("O sujeito exemplo é fixo e não pode ser alterado.");
  }

  await getCurrentResearcher();

  const payload = {
    id: isUuid(p.id) ? p.id : undefined,
    fullName: p.name.trim(),
    cpf: String(p.cpf ?? "").replace(/\D/g, ""),
    birthDate: p.dob,
    sex:
      p.biologicalSex === "Masculino" ? "M" : p.biologicalSex === "Feminino" ? "F" : undefined,
    cep: p.cep ? String(p.cep).replace(/\D/g, "") : undefined,
    street: p.address?.street?.trim() || undefined,
    number: p.address?.number?.trim() || undefined,
    neighborhood: p.address?.neighborhood?.trim() || undefined,
    city: p.address?.city?.trim() || undefined,
    state: p.address?.uf?.trim()?.toUpperCase() || undefined,
    complement: p.address?.complement?.trim() || undefined,
  };

  const created = await apiJson<ParticipantRow>("/api/participants", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return mapRowToParticipant(created);
}

export async function deleteParticipant(id: string) {
  if (id === TEST_PARTICIPANT_ID) {
    throw new Error("O sujeito exemplo é fixo e não pode ser removido.");
  }

  const res = await apiFetch(`/api/participants/${id}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) {
    const t = await res.text();
    throw new Error(t || "Erro ao excluir.");
  }
}
