import { supabase } from "../../../lib/supabase/client";
import { mariaSilvaMock } from "../../../mocks/participants";
import type { Participant, SignalPoint, TwoMstSession } from "../../../types/participant";

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

type MarchaMetricsJson = {
  cv_vel?: number | null;
  cv_time?: number | null;
  n_peaks?: number | null;
  time_mean_s?: number | null;
  vel_mean_deg_s?: number | null;
  vel_max_deg_s?: number | null;
  vel_min_deg_s?: number | null;
  cadence_cycles_min?: number | null;
};

type MarchaPlotJson = {
  t_rel_s?: unknown;
  signal_deg_s?: unknown;
};

type TestSessionResultRow = {
  participant_id: string;
  test_type: string;
  session_number: number | null;
  metrics_json: MarchaMetricsJson | string | null;
  plot_json: MarchaPlotJson | string | null;
  created_at: string | null;
  updated_at: string | null;
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

function normalizeSex(value?: string | null): Participant["sex"] {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (["m", "masculino", "male", "masc"].includes(normalized)) {
    return "Masculino";
  }

  return "Feminino";
}

function formatDateBr(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function asNumber(value: unknown, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }

  return null;
}

function mapParticipant(row: ParticipantRow): Participant {
  return {
    id: row.id,
    name: row.full_name,
    cpf: formatCpf(row.cpf),
    age: calcAgeFromDate(row.birth_date),
    sex: normalizeSex(row.sex),
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

function mapTwoMstSession(row: TestSessionResultRow): TwoMstSession | null {
  const sessionNumber = asNumber(row.session_number, NaN);
  if (!Number.isFinite(sessionNumber)) return null;

  const metrics = asRecord(row.metrics_json) ?? {};

  return {
    sessao: sessionNumber,
    date: formatDateBr(row.updated_at ?? row.created_at),
    repeticoes: Math.round(asNumber(metrics["n_peaks"])),
    cadencia: round(asNumber(metrics["cadence_cycles_min"]), 1),
    velAngularMedia: round(asNumber(metrics["vel_mean_deg_s"]), 2),
    cvVelocidade: round(asNumber(metrics["cv_vel"]) * 100, 2),
    tempoMedioCiclo: round(asNumber(metrics["time_mean_s"]), 3),
    cvTempoCiclo: round(asNumber(metrics["cv_time"]) * 100, 2),
    velMaxima: round(asNumber(metrics["vel_max_deg_s"]), 2),
    velMinima: round(asNumber(metrics["vel_min_deg_s"]), 2),
  };
}

function mapSignalPoints(row: TestSessionResultRow): SignalPoint[] {
  const plot = asRecord(row.plot_json);
  if (!plot) return [];

  const tRel = Array.isArray(plot["t_rel_s"]) ? plot["t_rel_s"] : [];
  const signal = Array.isArray(plot["signal_deg_s"]) ? plot["signal_deg_s"] : [];
  const n = Math.min(tRel.length, signal.length);

  if (!n) return [];

  const points: SignalPoint[] = [];

  for (let i = 0; i < n; i += 1) {
    const time = round(asNumber(tRel[i]), 1).toFixed(1);
    const value = round(asNumber(signal[i]), 2);

    points.push({ time, value });
  }

  return points;
}

function buildParticipantTests(rows: TestSessionResultRow[]): Participant["tests"] | undefined {
  const orderedRows = [...rows].sort(
    (a, b) => asNumber(a.session_number) - asNumber(b.session_number),
  );

  const sessions: TwoMstSession[] = [];
  const signals: Record<number, SignalPoint[]> = {};

  for (const row of orderedRows) {
    const session = mapTwoMstSession(row);
    if (!session) continue;

    sessions.push(session);

    const signal = mapSignalPoints(row);
    if (signal.length) {
      signals[session.sessao] = signal;
    }
  }

  if (!sessions.length) return undefined;

  return {
    has2MST: true,
    twoMstSessions: sessions,
    twoMstSignals: signals,
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

  const [participantResult, resultsResult] = await Promise.all([
    supabase
      .from("participants")
      .select(
        "id, full_name, cpf, birth_date, sex, created_by, owner_student_id, owner_professor_id, city, state, created_at, updated_at",
      )
      .eq("id", id)
      .maybeSingle(),

    supabase
      .from("test_session_results")
      .select(
        "participant_id, test_type, session_number, metrics_json, plot_json, created_at, updated_at",
      )
      .eq("participant_id", id)
      .eq("test_type", "MARCHA")
      .order("session_number", { ascending: true }),
  ]);

  if (participantResult.error) {
    throw new Error(participantResult.error.message);
  }

  if (resultsResult.error) {
    throw new Error(resultsResult.error.message);
  }

  if (!participantResult.data) return null;

  const participant = mapParticipant(participantResult.data as ParticipantRow);
  const tests = buildParticipantTests((resultsResult.data ?? []) as TestSessionResultRow[]);

  return tests ? { ...participant, tests } : participant;
}