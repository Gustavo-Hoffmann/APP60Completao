import type { Participant } from "../../../models/types";
import { calcAge } from "../../../models/utils";

type ParticipantAnthropometry = Participant & {
  bodyMassKg?: number | null;
  massKg?: number | null;
  weight?: number | null;
  massa?: number | null;
  peso?: number | null;
  heightCm?: number | null;
  estaturaCm?: number | null;
  height?: number | null;
  estatura?: number | null;
  altura?: number | null;
  birthDate?: string | null;
  sex?: string | null;
  gender?: string | null;
  sexo?: string | null;
};

function formatCpfDigits(value?: string | null) {
  const digits = String(value ?? "").replace(/\D/g, "").slice(0, 11);
  if (!digits) return "";
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

export function normalizeSexKey(value?: string | null): "M" | "F" | null {
  const s = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!s) return null;
  if (["m", "masculino", "male", "homem"].includes(s)) return "M";
  if (["f", "feminino", "female", "mulher"].includes(s)) return "F";
  return null;
}

export function formatSexLabel(
  value?: string | null,
  t?: (key: string, options?: Record<string, unknown>) => string
): string {
  const unknown = t ? t("tests:common.notInformed") : "Não informado";
  const sex = normalizeSexKey(value);
  if (sex === "M") return t ? t("tests:common.sexMale") : "Masculino";
  if (sex === "F") return t ? t("tests:common.sexFemale") : "Feminino";
  return unknown;
}

export function formatParticipantName(
  participant?: Participant | null,
  t?: (key: string) => string
): string {
  const name = participant?.name?.trim();
  if (!name) {
    return t ? t("tests:common.notInformed") : "Não informado";
  }
  return name;
}

export function formatParticipantCpf(
  participant?: Participant | null,
  t?: (key: string) => string
): string {
  const unknown = t ? t("tests:common.notInformed") : "Não informado";
  const nat = String(participant?.nationality ?? "BR")
    .trim()
    .toUpperCase();

  if (nat !== "BR") {
    const doc = String(participant?.cpf ?? "").trim();
    return doc || unknown;
  }

  const cpf = formatCpfDigits(participant?.cpf);
  return cpf || unknown;
}

export function formatParticipantAge(
  participant?: ParticipantAnthropometry | null,
  t?: (key: string) => string
): string {
  const unknown = t ? t("tests:common.notInformed") : "Não informado";
  const dob = participant?.dob ?? participant?.birthDate;
  if (!dob) return unknown;

  try {
    const age = calcAge(dob);
    if (!Number.isFinite(age) || age < 0 || age > 120) return unknown;
    const suffix = t ? t("tests:common.yearsSuffix") : "anos";
    return `${age} ${suffix}`;
  } catch {
    return unknown;
  }
}

export function readParticipantMassKg(participant?: ParticipantAnthropometry | null): number | null {
  if (!participant) return null;
  const candidate =
    participant.bodyMassKg ??
    participant.massKg ??
    participant.weight ??
    participant.massa ??
    participant.peso;
  if (candidate == null) return null;
  const n = Number(candidate);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 1000) / 1000 : null;
}

export function readParticipantHeightCm(participant?: ParticipantAnthropometry | null): number | null {
  if (!participant) return null;
  let candidate =
    participant.heightCm ??
    participant.estaturaCm ??
    participant.height ??
    participant.estatura ??
    participant.altura;
  if (candidate == null) return null;
  let n = Number(candidate);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n <= 3) n *= 100;
  return Math.round(n * 10) / 10;
}

function formatDecimal(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function formatParticipantMass(
  participant?: ParticipantAnthropometry | null,
  t?: (key: string) => string
): string {
  const unknown = t ? t("tests:common.notInformed") : "Não informado";
  const mass = readParticipantMassKg(participant);
  if (mass == null) return unknown;
  return `${formatDecimal(mass)} kg`;
}

export function formatParticipantHeight(
  participant?: ParticipantAnthropometry | null,
  t?: (key: string) => string
): string {
  const unknown = t ? t("tests:common.notInformed") : "Não informado";
  const height = readParticipantHeightCm(participant);
  if (height == null) return unknown;
  return `${formatDecimal(height)} cm`;
}

export function getParticipantSexValue(participant?: ParticipantAnthropometry | null) {
  return (
    participant?.biologicalSex ??
    participant?.sex ??
    participant?.gender ??
    participant?.sexo
  );
}
