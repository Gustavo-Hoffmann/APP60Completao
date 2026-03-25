import { supabase } from "../../../lib/supabase/client";
import { mariaSilvaMock } from "../../../mocks/participants";
import type {
  IvcfClassification,
  IvcfSession,
  Participant,
  ParticipantBlockScores,
  Sl30sGodaLabel,
  Sl30sRikliJonesLabel,
  Sl30sSession,
  Sl30sSignalPoint,
  TwoMstSession,
  TwoMstSignalPoint,
  TwoMstStrategyLabel,
} from "../../../types/participant";

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
  strategy?: string | null;
};

type MarchaPlotJson = {
  t_rel_s?: unknown;
  signal_deg_s?: unknown;
  t_phone_peaks_s?: unknown;
  y_phone_peaks_deg_s?: unknown;
  t_pred_peaks_s?: unknown;
  y_pred_peaks_deg_s?: unknown;
};

type Sl30sMetricsJson = {
  sex?: string | null;
  age_bin?: string | null;
  repetitions?: number | null;
  mean_power_w?: number | null;
  total_work_j?: number | null;
  work_per_rep_j?: number | null;
  mean_cycle_duration_s?: number | null;
  mean_stand_time_s?: number | null;
  mean_sit_time_s?: number | null;
  mean_transition_to_stand_s?: number | null;
  mean_transition_to_sit_s?: number | null;
  mean_frequency_hz?: number | null;
  cv_cycle_time_pct?: number | null;
  signal_amplitude_deg?: number | null;
  vel_flex_stand_mean_deg_s?: number | null;
  vel_ext_stand_mean_deg_s?: number | null;
  vel_flex_sit_mean_deg_s?: number | null;
  vel_ext_sit_mean_deg_s?: number | null;
  goda_classification?: string | null;
  rikli_jones_classification?: string | null;
  z_score?: number | null;
  percentile?: number | null;
};

type Sl30sPlotJson = {
  t_s?: unknown;
  signal_deg?: unknown;
  peak_indices?: unknown;
  valley_indices?: unknown;
};

type IvcfBlockScoreJson = {
  key?: string | null;
  label?: string | null;
  score?: number | null;
  max_score?: number | null;
  maxScore?: number | null;
};

type IvcfMetricsJson = {
  score_total?: number | null;
  classification_label?: string | null;
  classification_key?: string | null;
  block_scores?: IvcfBlockScoreJson[] | null;
  blocks_map?: Record<string, unknown> | null;
};

type TestSessionResultRow = {
  participant_id: string;
  test_type: string;
  session_number: number | null;
  metrics_json: MarchaMetricsJson | Sl30sMetricsJson | IvcfMetricsJson | string | null;
  plot_json: MarchaPlotJson | Sl30sPlotJson | string | null;
  created_at: string | null;
  updated_at: string | null;
};

type Norm30StsStats = {
  mean: number;
  sd: number;
};

const NORM_30STS: Record<"M" | "F", Record<string, Norm30StsStats>> = {
  F: {
    "60-64": { mean: 15.4, sd: 4.3 },
    "65-69": { mean: 13.5, sd: 4.3 },
    "70-74": { mean: 12.9, sd: 3.7 },
    "75-79": { mean: 12.5, sd: 3.9 },
    "80-84": { mean: 10.3, sd: 4.0 },
    "85-89": { mean: 8.0, sd: 5.1 },
    "90-94": { mean: 6.0, sd: 4.0 },
  },
  M: {
    "60-64": { mean: 16.4, sd: 3.3 },
    "65-69": { mean: 15.2, sd: 4.5 },
    "70-74": { mean: 14.5, sd: 4.2 },
    "75-79": { mean: 14.0, sd: 4.3 },
    "80-84": { mean: 12.4, sd: 3.9 },
    "85-89": { mean: 10.3, sd: 4.0 },
    "90-94": { mean: 9.7, sd: 6.8 },
  },
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

function normalizeOptionalSex(value?: string | null): Participant["sex"] | undefined {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (["m", "masculino", "male", "masc"].includes(normalized)) {
    return "Masculino";
  }

  if (["f", "feminino", "female", "fem"].includes(normalized)) {
    return "Feminino";
  }

  return undefined;
}

function normalizeIvcfClass(label?: unknown, key?: unknown): IvcfClassification | undefined {
  const normalizedLabel = String(label ?? "").trim().toLowerCase();

  if (normalizedLabel === "robusto") return "Robusto";
  if (["pré-frágil", "pre-frágil", "pre-fragil", "pré-fragil"].includes(normalizedLabel)) {
    return "Pré-Frágil";
  }
  if (["frágil", "fragil"].includes(normalizedLabel)) return "Frágil";

  const normalizedKey = String(key ?? "").trim().toLowerCase();
  if (normalizedKey === "robusto") return "Robusto";
  if (["pre_fragil", "pre-fragil", "pré_fragil", "pré-frágil"].includes(normalizedKey)) {
    return "Pré-Frágil";
  }
  if (normalizedKey === "fragil") return "Frágil";

  return undefined;
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

function asNullableNumber(value: unknown): number | null {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
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

function asNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => Number(v)).filter((v) => Number.isFinite(v));
}

function asIndexArray(value: unknown): number[] {
  return asNumberArray(value).map((v) => Math.round(v));
}

function findNearestIndex(times: number[], target: number) {
  let bestIndex = -1;
  let bestDist = Number.POSITIVE_INFINITY;

  for (let i = 0; i < times.length; i += 1) {
    const dist = Math.abs(times[i] - target);
    if (dist < bestDist) {
      bestDist = dist;
      bestIndex = i;
    }
  }

  return bestIndex;
}

function mapStrategyLabel(value: unknown): TwoMstStrategyLabel {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (normalized === "ascending") return "Ascendente";
  if (normalized === "descending") return "Descendente";
  if (normalized === "constant") return "Constante";
  return "Indefinida";
}

function mapGodaLabel(value: unknown): Sl30sGodaLabel {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (normalized === "constante") return "Constante";
  if (normalized === "flutuante") return "Flutuante";
  if (normalized === "desacelerador") return "Desacelerador";
  if (normalized === "acelerador") return "Acelerador";
  if (normalized === "desacelerador (tendência)") return "Desacelerador (Tendência)";
  if (normalized === "acelerador (tendência)") return "Acelerador (Tendência)";
  if (normalized === "flutuante (misto)") return "Flutuante (Misto)";
  return "—";
}

function mapRikliJonesLabel(value: unknown): Sl30sRikliJonesLabel {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (normalized === "abaixo da média") return "Abaixo da média";
  if (normalized === "na média") return "Na média";
  if (normalized === "acima da média") return "Acima da média";
  if (normalized === "idade fora da faixa da tabela") return "Idade fora da faixa da tabela";
  return "—";
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

function mapIvcfBlocks(metrics: Record<string, unknown>): ParticipantBlockScores {
  const blocks: ParticipantBlockScores = {};

  const blockScores = metrics["block_scores"];
  if (Array.isArray(blockScores) && blockScores.length) {
    for (const item of blockScores) {
      const row = asRecord(item);
      if (!row) continue;

      const label = String(row["label"] ?? row["key"] ?? "").trim();
      const score = asNullableNumber(row["score"]);

      if (!label || score === null) continue;
      blocks[label] = score;
    }

    return blocks;
  }

  const blocksMap = asRecord(metrics["blocks_map"]);
  if (blocksMap) {
    for (const [label, rawScore] of Object.entries(blocksMap)) {
      const score = asNullableNumber(rawScore);
      if (!label || score === null) continue;
      blocks[label] = score;
    }
  }

  return blocks;
}

function mapIvcfSession(row: TestSessionResultRow): IvcfSession | null {
  const sessionNumber = asNumber(row.session_number, Number.NaN);
  if (!Number.isFinite(sessionNumber)) return null;

  const metrics = asRecord(row.metrics_json) ?? {};
  const classification = normalizeIvcfClass(
    metrics["classification_label"],
    metrics["classification_key"],
  );
  const scoreTotal = asNumber(metrics["score_total"], Number.NaN);
  const blocks = mapIvcfBlocks(metrics);

  if (!Number.isFinite(scoreTotal) && !classification && !Object.keys(blocks).length) {
    return null;
  }

  return {
    sessao: sessionNumber,
    date: formatDateBr(row.updated_at ?? row.created_at),
    scoreTotal: Number.isFinite(scoreTotal) ? Math.round(scoreTotal) : 0,
    classification,
    blocks,
  };
}

function mapTwoMstSession(row: TestSessionResultRow): TwoMstSession | null {
  const sessionNumber = asNumber(row.session_number, Number.NaN);
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
    strategy: mapStrategyLabel(metrics["strategy"]),
  };
}

function mapTwoMstSignalPoints(row: TestSessionResultRow): TwoMstSignalPoint[] {
  const plot = asRecord(row.plot_json) as MarchaPlotJson | null;
  if (!plot) return [];

  const tRel = asNumberArray(plot.t_rel_s);
  const signal = asNumberArray(plot.signal_deg_s);
  const n = Math.min(tRel.length, signal.length);

  if (!n) return [];

  const points: TwoMstSignalPoint[] = [];

  for (let i = 0; i < n; i += 1) {
    points.push({
      time: Number(tRel[i].toFixed(3)),
      value: Number(signal[i].toFixed(3)),
      phonePeak: null,
      predPeak: null,
    });
  }

  const times = points.map((p) => p.time);

  const tPhone = asNumberArray(plot.t_phone_peaks_s);
  const yPhone = asNumberArray(plot.y_phone_peaks_deg_s);
  for (let i = 0; i < Math.min(tPhone.length, yPhone.length); i += 1) {
    const idx = findNearestIndex(times, tPhone[i]);
    if (idx >= 0) {
      points[idx].phonePeak = Number(yPhone[i].toFixed(3));
    }
  }

  const tPred = asNumberArray(plot.t_pred_peaks_s);
  const yPred = asNumberArray(plot.y_pred_peaks_deg_s);
  for (let i = 0; i < Math.min(tPred.length, yPred.length); i += 1) {
    const idx = findNearestIndex(times, tPred[i]);
    if (idx >= 0) {
      points[idx].predPeak = Number(yPred[i].toFixed(3));
    }
  }

  return points;
}

function getSl30sNormStats(sex: unknown, ageBin: unknown): Norm30StsStats | null {
  const normalizedSex = String(sex ?? "").trim().toUpperCase();
  if (normalizedSex !== "M" && normalizedSex !== "F") return null;

  const normalizedAgeBin = String(ageBin ?? "").trim();
  return NORM_30STS[normalizedSex][normalizedAgeBin] ?? null;
}

function mapSl30sSession(row: TestSessionResultRow): Sl30sSession | null {
  const sessionNumber = asNumber(row.session_number, Number.NaN);
  if (!Number.isFinite(sessionNumber)) return null;

  const metrics = (asRecord(row.metrics_json) ?? {}) as Record<string, unknown>;
  const norm = getSl30sNormStats(metrics["sex"], metrics["age_bin"]);
  const normMean = norm ? round(norm.mean, 1) : null;
  const normLower = norm ? round(norm.mean - norm.sd, 1) : null;
  const normUpper = norm ? round(norm.mean + norm.sd, 1) : null;

  return {
    sessao: sessionNumber,
    date: formatDateBr(row.updated_at ?? row.created_at),
    repeticoes: Math.round(asNumber(metrics["repetitions"])),
    potenciaMedia: round(asNumber(metrics["mean_power_w"]), 2),
    trabalhoTotal: round(asNumber(metrics["total_work_j"]), 2),
    trabalhoPorRep: round(asNumber(metrics["work_per_rep_j"]), 2),
    tempoMedioCiclo: round(asNumber(metrics["mean_cycle_duration_s"]), 3),
    tempoMedioLevantar: round(asNumber(metrics["mean_stand_time_s"]), 3),
    tempoMedioSentar: round(asNumber(metrics["mean_sit_time_s"]), 3),
    transicaoMediaLevantar: round(asNumber(metrics["mean_transition_to_stand_s"]), 3),
    transicaoMediaSentar: round(asNumber(metrics["mean_transition_to_sit_s"]), 3),
    frequenciaMedia: round(asNumber(metrics["mean_frequency_hz"]), 3),
    cvTempoCiclo: round(asNumber(metrics["cv_cycle_time_pct"]), 2),
    amplitudeSinal: round(asNumber(metrics["signal_amplitude_deg"]), 2),
    velFlexLevantar: round(asNumber(metrics["vel_flex_stand_mean_deg_s"]), 2),
    velExtLevantar: round(asNumber(metrics["vel_ext_stand_mean_deg_s"]), 2),
    velFlexSentar: round(asNumber(metrics["vel_flex_sit_mean_deg_s"]), 2),
    velExtSentar: round(asNumber(metrics["vel_ext_sit_mean_deg_s"]), 2),
    goda: mapGodaLabel(metrics["goda_classification"]),
    rikliJones: mapRikliJonesLabel(metrics["rikli_jones_classification"]),
    zScore: asNullableNumber(metrics["z_score"]),
    percentile: asNullableNumber(metrics["percentile"]),
    ageBin: String(metrics["age_bin"] ?? "").trim() || undefined,
    sex: normalizeOptionalSex(String(metrics["sex"] ?? "")),
    normativeMean: normMean,
    normativeLower: normLower,
    normativeUpper: normUpper,
  };
}

function mapSl30sSignalPoints(row: TestSessionResultRow): Sl30sSignalPoint[] {
  const plot = asRecord(row.plot_json) as Sl30sPlotJson | null;
  if (!plot) return [];

  const times = asNumberArray(plot.t_s);
  const signal = asNumberArray(plot.signal_deg);
  const n = Math.min(times.length, signal.length);

  if (!n) return [];

  const points: Sl30sSignalPoint[] = [];
  for (let i = 0; i < n; i += 1) {
    points.push({
      time: Number(times[i].toFixed(3)),
      value: Number(signal[i].toFixed(3)),
      peak: null,
      valley: null,
    });
  }

  const peakIndices = asIndexArray(plot.peak_indices);
  const valleyIndices = asIndexArray(plot.valley_indices);

  for (const idx of peakIndices) {
    if (idx >= 0 && idx < points.length) {
      points[idx].peak = points[idx].value;
    }
  }

  for (const idx of valleyIndices) {
    if (idx >= 0 && idx < points.length) {
      points[idx].valley = points[idx].value;
    }
  }

  return points;
}

function buildParticipantTests(rows: TestSessionResultRow[]): Participant["tests"] | undefined {
  const orderedRows = [...rows].sort(
    (a, b) => asNumber(a.session_number) - asNumber(b.session_number),
  );

  const twoMstSessions: TwoMstSession[] = [];
  const twoMstSignals: Record<number, TwoMstSignalPoint[]> = {};
  const sl30sSessions: Sl30sSession[] = [];
  const sl30sSignals: Record<number, Sl30sSignalPoint[]> = {};
  const ivcfSessions: IvcfSession[] = [];

  for (const row of orderedRows) {
    const testType = String(row.test_type ?? "").toUpperCase();

    if (testType === "MARCHA") {
      const session = mapTwoMstSession(row);
      if (!session) continue;

      twoMstSessions.push(session);

      const signal = mapTwoMstSignalPoints(row);
      if (signal.length) {
        twoMstSignals[session.sessao] = signal;
      }

      continue;
    }

    if (testType === "SL30S") {
      const session = mapSl30sSession(row);
      if (!session) continue;

      sl30sSessions.push(session);

      const signal = mapSl30sSignalPoints(row);
      if (signal.length) {
        sl30sSignals[session.sessao] = signal;
      }

      continue;
    }

    if (testType === "IVCF20") {
      const session = mapIvcfSession(row);
      if (!session) continue;
      ivcfSessions.push(session);
    }
  }

  if (!twoMstSessions.length && !sl30sSessions.length && !ivcfSessions.length) return undefined;

  return {
    has2MST: twoMstSessions.length > 0,
    twoMstSessions,
    twoMstSignals,
    hasSL30S: sl30sSessions.length > 0,
    sl30sSessions,
    sl30sSignals,
    hasIVCF20: ivcfSessions.length > 0,
    ivcfSessions,
  };
}

function applyLatestIvcf(participant: Participant, tests?: Participant["tests"]): Participant {
  const latestIvcf = tests?.ivcfSessions?.[tests.ivcfSessions.length - 1];

  if (!latestIvcf) return tests ? { ...participant, tests } : participant;

  return {
    ...participant,
    ivcfScore: latestIvcf.scoreTotal,
    ivcfClass: latestIvcf.classification,
    blocks: latestIvcf.blocks,
    tests,
  };
}

function buildParticipantWithResults(
  row: ParticipantRow,
  resultRows: TestSessionResultRow[],
): Participant {
  const base = mapParticipant(row);
  const tests = buildParticipantTests(resultRows);
  return applyLatestIvcf(base, tests);
}

export function getFallbackParticipant(): Participant {
  return mariaSilvaMock;
}

export async function listParticipants(): Promise<Participant[]> {
  const [participantsResult, resultsResult] = await Promise.all([
    supabase
      .from("participants")
      .select(
        "id, full_name, cpf, birth_date, sex, created_by, owner_student_id, owner_professor_id, city, state, created_at, updated_at",
      )
      .order("full_name", { ascending: true }),

    supabase
      .from("test_session_results")
      .select(
        "participant_id, test_type, session_number, metrics_json, plot_json, created_at, updated_at",
      )
      .in("test_type", ["MARCHA", "IVCF20"])
      .order("session_number", { ascending: true }),
  ]);

  if (participantsResult.error) {
    throw new Error(participantsResult.error.message);
  }

  if (resultsResult.error) {
    throw new Error(resultsResult.error.message);
  }

  const rows = (participantsResult.data ?? []) as ParticipantRow[];
  const results = (resultsResult.data ?? []) as TestSessionResultRow[];

  const resultsByParticipant = new Map<string, TestSessionResultRow[]>();
  for (const row of results) {
    const key = row.participant_id;
    const bucket = resultsByParticipant.get(key) ?? [];
    bucket.push(row);
    resultsByParticipant.set(key, bucket);
  }

  const real = rows.map((row) =>
    buildParticipantWithResults(row, resultsByParticipant.get(row.id) ?? []),
  );
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
      .in("test_type", ["MARCHA", "SL30S", "IVCF20"])
      .order("session_number", { ascending: true }),
  ]);

  if (participantResult.error) {
    throw new Error(participantResult.error.message);
  }

  if (resultsResult.error) {
    throw new Error(resultsResult.error.message);
  }

  if (!participantResult.data) return null;

  return buildParticipantWithResults(
    participantResult.data as ParticipantRow,
    (resultsResult.data ?? []) as TestSessionResultRow[],
  );
}