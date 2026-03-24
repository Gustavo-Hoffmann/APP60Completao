import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

import { supabase } from "../supabase/client";
import type { Participant } from "../../models/types";
import type { NativeImuStopResult } from "../sensors/nativeImu";

const BUCKET = "test-data";
const SAMPLING_HZ = 60;
const MAX_SESSION_INSERT_RETRIES = 6;

export type SupportedTestType = "MARCHA" | "TUG" | "LOS" | "SL30S" | "UTT" | "IVCF20";
type SensorCsvTestType = Exclude<SupportedTestType, "IVCF20">;

export type Ivcf20Classification = {
  key: "robusto" | "prefragil" | "fragil";
  label: string;
};

export type Ivcf20CategoryKey =
  | "idade"
  | "percepcao"
  | "avd_i"
  | "avd_b"
  | "cognicao"
  | "humor"
  | "mobilidade"
  | "continencia"
  | "comunicacao"
  | "comorbidades";

export type Ivcf20CategoryScore = {
  key: Ivcf20CategoryKey;
  label: string;
  score: number;
  max_score: number;
};

export type Ivcf20Categories = {
  idade: Ivcf20CategoryScore;
  percepcao: Ivcf20CategoryScore;
  avd_i: Ivcf20CategoryScore;
  avd_b: Ivcf20CategoryScore;
  cognicao: Ivcf20CategoryScore;
  humor: Ivcf20CategoryScore;
  mobilidade: Ivcf20CategoryScore;
  continencia: Ivcf20CategoryScore;
  comunicacao: Ivcf20CategoryScore;
  comorbidades: Ivcf20CategoryScore;
};

export type Ivcf20JsonPayload = {
  schema_version: 1;
  test_type: "IVCF20";
  participant_id: string;
  participant_name?: string;
  session_number: number;
  session_label: string;
  performed_at: string;
  platform: string;
  sampling_hz: number;
  questionnaire: {
    score_total: number;
    classification: Ivcf20Classification;
    categories: Ivcf20Categories;
    block_scores: Ivcf20CategoryScore[];
    answers?: Record<string, unknown>;
    meta?: Record<string, unknown>;
  };
};

type NativeImuStatsLike = {
  n?: number;
  hzMean?: number;
  dtMeanMs?: number;
  dtMinMs?: number;
  dtMaxMs?: number;
  pctIn58to62?: number;
  droppedEstimated?: number;
  targetHz?: number;
  targetDtMs?: number;
  dtCount?: number;

  accAgeMeanMs?: number;
  accAgeMaxMs?: number;
  userAccAgeMeanMs?: number;
  userAccAgeMaxMs?: number;
  gravAgeMeanMs?: number;
  gravAgeMaxMs?: number;
  attAgeMeanMs?: number;
  attAgeMaxMs?: number;

  deviceMotionActive?: boolean;
};

type NativeImuTugLike = {
  detected?: boolean;
  startDetectedMs?: number;
  endDetectedMs?: number;
  durationMs?: number;
  stopReason?: string;
};

type NativeImuLikeResult = NativeImuStopResult & {
  stats?: NativeImuStatsLike;
  tug?: NativeImuTugLike;
};

type ReservedSessionRow = {
  id: string;
  session_number: number;
};

type UploadedSessionResult = {
  sessionNumber: number;
  path: string;
};

type ParticipantAnthropometryFields = {
  bodyMassKg?: unknown;
  massKg?: unknown;
  weight?: unknown;
  massa?: unknown;
  peso?: unknown;
  heightCm?: unknown;
  estaturaCm?: unknown;
  height?: unknown;
  estatura?: unknown;
  altura?: unknown;
};

const IVCF20_DOMAIN_META: Record<Ivcf20CategoryKey, { label: string; max_score: number }> = {
  idade: { label: "Idade", max_score: 3 },
  percepcao: { label: "Saúde", max_score: 1 },
  avd_i: { label: "AVD-I", max_score: 4 },
  avd_b: { label: "AVD-B", max_score: 6 },
  cognicao: { label: "Cognição", max_score: 4 },
  humor: { label: "Humor", max_score: 4 },
  mobilidade: { label: "Mobilidade", max_score: 8 },
  continencia: { label: "Continência", max_score: 2 },
  comunicacao: { label: "Comunicação", max_score: 4 },
  comorbidades: { label: "Comorbidades", max_score: 4 },
};

function safeSlug(s: string) {
  return (s || "sem_nome")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase()
    .slice(0, 48);
}

function fileStamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");

  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(
    d.getHours()
  )}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function getDbTestType(testType: SupportedTestType): string {
  switch (testType) {
    case "IVCF20":
      return "IVCF_20";
    default:
      return testType;
  }
}

function asFiniteNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round3(value: unknown): number {
  const n = asFiniteNumber(value, 0);
  return Math.round(n * 1000) / 1000;
}

function round1(value: unknown): number {
  const n = asFiniteNumber(value, 0);
  return Math.round(n * 10) / 10;
}

function escapeCsvValue(value: unknown): string {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function normalizeSensorRow(row: unknown): number[] {
  const arr = Array.isArray(row) ? row : [];
  return [
    asFiniteNumber(arr[0]),
    asFiniteNumber(arr[1]),

    asFiniteNumber(arr[2]),
    asFiniteNumber(arr[3]),
    asFiniteNumber(arr[4]),
    asFiniteNumber(arr[5]),

    asFiniteNumber(arr[6]),
    asFiniteNumber(arr[7]),
    asFiniteNumber(arr[8]),
    asFiniteNumber(arr[9]),

    asFiniteNumber(arr[10]),
    asFiniteNumber(arr[11]),
    asFiniteNumber(arr[12]),
    asFiniteNumber(arr[13]),

    asFiniteNumber(arr[14]),
    asFiniteNumber(arr[15]),
    asFiniteNumber(arr[16]),
    asFiniteNumber(arr[17]),

    asFiniteNumber(arr[18]),
    asFiniteNumber(arr[19]),
    asFiniteNumber(arr[20]),
    asFiniteNumber(arr[21]),
  ];
}

function getResultSampleCount(result: NativeImuLikeResult): number {
  return Array.isArray(result?.samples) ? result.samples.length : 0;
}

function computeCollectionQuality(
  result: NativeImuLikeResult
): "GOOD" | "WARN" | "BAD" {
  const stats = result?.stats ?? {};
  const sampleCount = getResultSampleCount(result);

  if (sampleCount < 30) return "BAD";

  const hzMean = asFiniteNumber(stats.hzMean, 0);
  const pctIn58to62 = asFiniteNumber(stats.pctIn58to62, 0);
  const droppedEstimated = asFiniteNumber(stats.droppedEstimated, 0);
  const accAgeMaxMs = asFiniteNumber(stats.accAgeMaxMs, 0);
  const attAgeMaxMs = asFiniteNumber(stats.attAgeMaxMs, 0);

  if (hzMean < 45 || pctIn58to62 < 40 || droppedEstimated > 20) {
    return "BAD";
  }

  if (
    hzMean < 55 ||
    pctIn58to62 < 75 ||
    droppedEstimated > 5 ||
    accAgeMaxMs > 80 ||
    attAgeMaxMs > 80
  ) {
    return "WARN";
  }

  return "GOOD";
}

function toOptionalFloat(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function getParticipantBodyMassKg(participant: Participant): number | null {
  const p = participant as Participant & ParticipantAnthropometryFields;
  const value = p.bodyMassKg ?? p.massKg ?? p.weight ?? p.massa ?? p.peso;
  const n = toOptionalFloat(value);
  if (n == null || n <= 0 || n > 400) return null;
  return round3(n);
}

function getParticipantHeightCm(participant: Participant): number | null {
  const p = participant as Participant & ParticipantAnthropometryFields;
  const value = p.heightCm ?? p.estaturaCm ?? p.height ?? p.estatura ?? p.altura;
  let n = toOptionalFloat(value);
  if (n == null || n <= 0) return null;
  if (n <= 3) n *= 100;
  if (n < 50 || n > 260) return null;
  return round1(n);
}

function buildSensorMetadataLines(
  testType: SensorCsvTestType,
  result: NativeImuLikeResult,
  participant: Participant,
  sessionNumber: number,
  performedAt: string
): string[] {
  const stats = result?.stats ?? {};
  const tug = result?.tug ?? {};
  const quality = computeCollectionQuality(result);
  const sampleCount = getResultSampleCount(result);

  const lines: string[] = [
    "# app=app60",
    "# schema_version=2",
    `# test_type=${testType}`,
    `# participant_id=${String(participant?.id ?? "")}`,
    `# participant_name=${String(participant?.name ?? "")}`,
    `# body_mass_kg=${getParticipantBodyMassKg(participant) ?? ""}`,
    `# height_cm=${getParticipantHeightCm(participant) ?? ""}`,
    `# session_number=${sessionNumber}`,
    `# session_label=S${sessionNumber}`,
    `# performed_at=${performedAt}`,
    `# platform=${Platform.OS}`,
    `# sampling_hz=${asFiniteNumber(stats.targetHz, SAMPLING_HZ)}`,
    `# samples_count=${sampleCount}`,
    `# quality=${quality}`,
    `# stats_n=${asFiniteNumber(stats.n, sampleCount)}`,
    `# stats_dt_count=${asFiniteNumber(stats.dtCount, 0)}`,
    `# stats_hz_mean=${round3(stats.hzMean)}`,
    `# stats_dt_mean_ms=${round3(stats.dtMeanMs)}`,
    `# stats_dt_min_ms=${round3(stats.dtMinMs)}`,
    `# stats_dt_max_ms=${round3(stats.dtMaxMs)}`,
    `# stats_pct_in_58_62=${round3(stats.pctIn58to62)}`,
    `# stats_dropped_estimated=${asFiniteNumber(stats.droppedEstimated, 0)}`,
    `# stats_target_hz=${round3(stats.targetHz || SAMPLING_HZ)}`,
    `# stats_target_dt_ms=${round3(stats.targetDtMs || 1000 / SAMPLING_HZ)}`,
    `# stats_acc_age_mean_ms=${round3(stats.accAgeMeanMs)}`,
    `# stats_acc_age_max_ms=${round3(stats.accAgeMaxMs)}`,
    `# stats_user_acc_age_mean_ms=${round3(stats.userAccAgeMeanMs)}`,
    `# stats_user_acc_age_max_ms=${round3(stats.userAccAgeMaxMs)}`,
    `# stats_grav_age_mean_ms=${round3(stats.gravAgeMeanMs)}`,
    `# stats_grav_age_max_ms=${round3(stats.gravAgeMaxMs)}`,
    `# stats_att_age_mean_ms=${round3(stats.attAgeMeanMs)}`,
    `# stats_att_age_max_ms=${round3(stats.attAgeMaxMs)}`,
    `# stats_device_motion_active=${Boolean(stats.deviceMotionActive)}`,
  ];

  if (testType === "TUG") {
    lines.push(`# tug_detected=${Boolean(tug.detected)}`);
    lines.push(`# tug_start_detected_ms=${round3(tug.startDetectedMs)}`);
    lines.push(`# tug_end_detected_ms=${round3(tug.endDetectedMs)}`);
    lines.push(`# tug_duration_ms=${round3(tug.durationMs)}`);
    lines.push(`# tug_stop_reason=${String(tug.stopReason ?? "")}`);
  }

  return lines;
}

function buildSensorCsv(
  testType: SensorCsvTestType,
  result: NativeImuLikeResult,
  participant: Participant,
  sessionNumber: number,
  performedAt: string
): string {
  const rows = (result?.samples ?? []).map(normalizeSensorRow);

  const header = [
    "wall_t_ms",
    "row_t_ms",
    "acc_t_ms",
    "ax",
    "ay",
    "az",
    "gyro_t_ms",
    "gx",
    "gy",
    "gz",
    "user_acc_t_ms",
    "user_ax",
    "user_ay",
    "user_az",
    "grav_t_ms",
    "grav_x",
    "grav_y",
    "grav_z",
    "att_t_ms",
    "roll",
    "pitch",
    "yaw",
  ].join(",");

  const metadata = buildSensorMetadataLines(
    testType,
    result,
    participant,
    sessionNumber,
    performedAt
  ).join("\n");

  const body = rows
    .map((row) => row.map((v) => escapeCsvValue(Number.isFinite(v) ? v : 0)).join(","))
    .join("\n");

  return `${metadata}\n${header}\n${body}${body ? "\n" : ""}`;
}

function buildLocalSensorCsvFilename(
  testType: SensorCsvTestType,
  participant: Participant,
  sessionNumber: number
) {
  const pidShort = safeSlug(String(participant?.id ?? "sem_participante")).slice(0, 12);
  const pname = safeSlug(participant?.name ?? "sem_nome");
  const stamp = fileStamp();
  return `${safeSlug(testType)}_${pname}_${pidShort}_S${sessionNumber}_${stamp}.csv`;
}

function buildLocalIvcf20Filename(participant: Participant, sessionNumber: number) {
  const pidShort = safeSlug(String(participant?.id ?? "sem_participante")).slice(0, 12);
  const pname = safeSlug(participant?.name ?? "sem_nome");
  const stamp = fileStamp();
  return `ivcf20_${pname}_${pidShort}_S${sessionNumber}_${stamp}.json`;
}

function buildSessionRawPath(
  testType: SupportedTestType,
  participantId: string,
  sessionNumber: number,
  ext: "csv" | "json"
) {
  return `raw/${testType}/${participantId}/S${sessionNumber}/raw.${ext}`;
}

function buildPlaceholderRawPath(
  testType: SupportedTestType,
  participantId: string
) {
  const stamp = fileStamp();
  const rand = Math.random().toString(36).slice(2, 10);
  return `uploading/${testType}/${participantId}/${stamp}_${rand}.tmp`;
}

function isUniqueViolation(error: unknown): boolean {
  const code = String((error as { code?: unknown })?.code ?? "");
  const message = String((error as { message?: unknown })?.message ?? "").toLowerCase();

  return (
    code === "23505" ||
    message.includes("duplicate key") ||
    message.includes("already exists") ||
    message.includes("unique constraint")
  );
}

function toOptionalText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

function toOptionalInt(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function normalizeSexForSession(value: unknown): string | null {
  const s = toOptionalText(value)?.toUpperCase();
  if (!s) return null;
  if (["M", "MALE", "MASC", "MASCULINO"].includes(s)) return "M";
  if (["F", "FEMALE", "FEM", "FEMININO"].includes(s)) return "F";
  return s;
}

function getParticipantSessionFields(participant: Participant) {
  const p = participant as Participant & {
    sex?: unknown;
    sexo?: unknown;
    age?: unknown;
    idade?: unknown;
  };

  return {
    participant_name: toOptionalText(participant?.name),
    sex: normalizeSexForSession(p.sex ?? p.sexo),
    age: toOptionalInt(p.age ?? p.idade),
  };
}

async function removeFromStorageIfExists(path: string) {
  try {
    await supabase.storage.from(BUCKET).remove([path]);
  } catch {
    // segue o baile
  }
}

async function deleteSessionIfExists(sessionId: string) {
  try {
    await supabase.from("test_sessions").delete().eq("id", sessionId);
  } catch {
    // segue o baile
  }
}

async function saveTextToCache(
  content: string,
  filename: string
): Promise<{ uri: string; filename: string; content: string }> {
  const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;

  if (!baseDir) {
    throw new Error("Sem diretório disponível para salvar o arquivo.");
  }

  const uri = baseDir + filename;

  await FileSystem.writeAsStringAsync(uri, content, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  return { uri, filename, content };
}

export async function getNextSessionNumber(
  participantId: string,
  testType: SupportedTestType = "MARCHA"
): Promise<number> {
  const dbTestType = getDbTestType(testType);

  const { data, error } = await supabase
    .from("test_sessions")
    .select("session_number")
    .eq("participant_id", participantId)
    .eq("test_type", dbTestType)
    .order("session_number", { ascending: false })
    .limit(1);

  if (error) throw error;

  const currentMax = data?.[0]?.session_number ?? 0;
  return currentMax + 1;
}

async function reserveTestSessionWithRetry(args: {
  testType: SupportedTestType;
  participant: Participant;
  sessionNumber: number;
  samplingHz: number;
  performedAt: string;
}): Promise<ReservedSessionRow> {
  const dbTestType = getDbTestType(args.testType);
  const participantFields = getParticipantSessionFields(args.participant);
  let nextSessionNumber = args.sessionNumber;
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_SESSION_INSERT_RETRIES; attempt += 1) {
    const { data, error } = await supabase
      .from("test_sessions")
      .insert({
        participant_id: args.participant.id,
        test_type: dbTestType,
        session_number: nextSessionNumber,
        raw_bucket: BUCKET,
        raw_file_path: buildPlaceholderRawPath(args.testType, String(args.participant.id)),
        processing_status: "uploading",
        processing_error: null,
        platform: Platform.OS,
        sampling_hz: args.samplingHz,
        performed_at: args.performedAt,
        participant_name: participantFields.participant_name,
        sex: participantFields.sex,
        age: participantFields.age,
      })
      .select("id, session_number")
      .single();

    if (!error && data) {
      return data as ReservedSessionRow;
    }

    lastError = error;

    if (!isUniqueViolation(error)) {
      throw error;
    }

    nextSessionNumber = await getNextSessionNumber(String(args.participant.id), args.testType);
  }

  throw lastError ?? new Error("Não foi possível reservar a sessão.");
}

async function finalizeReservedSession(args: {
  sessionId: string;
  path: string;
  performedAt: string;
}) {
  const { error } = await supabase
    .from("test_sessions")
    .update({
      raw_bucket: BUCKET,
      raw_file_path: args.path,
      processing_status: "pending",
      processing_error: null,
      performed_at: args.performedAt,
    })
    .eq("id", args.sessionId);

  if (error) throw error;
}

async function failReservedSession(sessionId: string, message: string) {
  try {
    await supabase
      .from("test_sessions")
      .update({
        processing_status: "error",
        processing_error: message.slice(0, 4000),
      })
      .eq("id", sessionId);
  } catch {
    // sem escândalo
  }
}

async function uploadCsvToSupabase(
  testType: SensorCsvTestType,
  result: NativeImuStopResult,
  participant: Participant
): Promise<UploadedSessionResult> {
  const performedAt = new Date().toISOString();
  const firstGuessSessionNumber = await getNextSessionNumber(String(participant.id), testType);

  const reserved = await reserveTestSessionWithRetry({
    testType,
    participant,
    sessionNumber: firstGuessSessionNumber,
    samplingHz: SAMPLING_HZ,
    performedAt,
  });

  const finalSessionNumber = reserved.session_number;
  const csv = buildSensorCsv(
    testType,
    result as NativeImuLikeResult,
    participant,
    finalSessionNumber,
    performedAt
  );

  const path = buildSessionRawPath(
    testType,
    String(participant.id),
    finalSessionNumber,
    "csv"
  );

  const binary = new TextEncoder().encode(csv);

  try {
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, binary, {
      contentType: "text/csv",
      upsert: false,
    });

    if (uploadError) throw uploadError;

    await finalizeReservedSession({
      sessionId: reserved.id,
      path,
      performedAt,
    });

    return {
      sessionNumber: finalSessionNumber,
      path,
    };
  } catch (error) {
    await removeFromStorageIfExists(path);
    await failReservedSession(
      reserved.id,
      error instanceof Error ? error.message : "Falha no upload do CSV."
    );
    await deleteSessionIfExists(reserved.id);
    throw error;
  }
}

export function buildIvcf20CategoriesFromBlockScores(
  blockScores: Array<Partial<Ivcf20CategoryScore> & { key: string; score?: number }>
): Ivcf20Categories {
  const buildItem = (key: Ivcf20CategoryKey): Ivcf20CategoryScore => {
    const meta = IVCF20_DOMAIN_META[key];
    const found = blockScores.find((item) => item?.key === key);

    return {
      key,
      label: String(found?.label ?? meta.label),
      score: Number(found?.score ?? 0),
      max_score: Number(found?.max_score ?? meta.max_score),
    };
  };

  return {
    idade: buildItem("idade"),
    percepcao: buildItem("percepcao"),
    avd_i: buildItem("avd_i"),
    avd_b: buildItem("avd_b"),
    cognicao: buildItem("cognicao"),
    humor: buildItem("humor"),
    mobilidade: buildItem("mobilidade"),
    continencia: buildItem("continencia"),
    comunicacao: buildItem("comunicacao"),
    comorbidades: buildItem("comorbidades"),
  };
}

export function normalizeIvcf20BlockScores(
  blockScores: Array<Partial<Ivcf20CategoryScore> & { key: string; score?: number }>
): Ivcf20CategoryScore[] {
  const categories = buildIvcf20CategoriesFromBlockScores(blockScores);

  return [
    categories.idade,
    categories.percepcao,
    categories.avd_i,
    categories.avd_b,
    categories.cognicao,
    categories.humor,
    categories.mobilidade,
    categories.continencia,
    categories.comunicacao,
    categories.comorbidades,
  ];
}

export function buildIvcf20JsonPayload(
  data: {
    participant: Participant;
    sessionNumber: number;
    scoreTotal: number;
    classification: Ivcf20Classification;
    categories?: Ivcf20Categories;
    blockScores: Array<Partial<Ivcf20CategoryScore> & { key: string; score?: number }>;
    answers?: Record<string, unknown>;
    meta?: Record<string, unknown>;
  },
  performedAt = new Date()
): Ivcf20JsonPayload {
  const normalizedBlockScores = normalizeIvcf20BlockScores(data.blockScores);
  const categories =
    data.categories ?? buildIvcf20CategoriesFromBlockScores(normalizedBlockScores);

  return {
    schema_version: 1,
    test_type: "IVCF20",
    participant_id: String(data.participant.id),
    participant_name: data.participant.name,
    session_number: data.sessionNumber,
    session_label: `S${data.sessionNumber}`,
    performed_at: performedAt.toISOString(),
    platform: Platform.OS,
    sampling_hz: SAMPLING_HZ,
    questionnaire: {
      score_total: Number(data.scoreTotal ?? 0),
      classification: data.classification,
      categories,
      block_scores: normalizedBlockScores,
      answers: data.answers,
      meta: data.meta,
    },
  };
}

async function saveSensorCsvToCache(
  testType: SensorCsvTestType,
  result: NativeImuLikeResult,
  participant: Participant,
  sessionNumber = 1
): Promise<{ uri: string; filename: string; csv: string }> {
  const performedAt = new Date().toISOString();
  const csv = buildSensorCsv(testType, result, participant, sessionNumber, performedAt);
  const filename = buildLocalSensorCsvFilename(testType, participant, sessionNumber);
  const saved = await saveTextToCache(csv, filename);
  return { uri: saved.uri, filename: saved.filename, csv };
}

export async function saveIvcf20JsonToCache(data: {
  participant: Participant;
  sessionNumber: number;
  scoreTotal: number;
  classification: Ivcf20Classification;
  categories?: Ivcf20Categories;
  blockScores: Array<Partial<Ivcf20CategoryScore> & { key: string; score?: number }>;
  answers?: Record<string, unknown>;
  meta?: Record<string, unknown>;
}): Promise<{ uri: string; filename: string; payload: Ivcf20JsonPayload }> {
  const payload = buildIvcf20JsonPayload(data);
  const filename = buildLocalIvcf20Filename(data.participant, data.sessionNumber);
  const json = JSON.stringify(payload, null, 2);
  const saved = await saveTextToCache(json, filename);
  return { uri: saved.uri, filename: saved.filename, payload };
}

/**
 * Mantidos por compatibilidade com as telas atuais.
 * Apesar do nome antigo "Json", os testes de sensor salvam CSV.
 */
export async function saveMarchaJsonToCache(
  result: NativeImuStopResult,
  participant: Participant,
  sessionNumber = 1
) {
  return saveSensorCsvToCache("MARCHA", result as NativeImuLikeResult, participant, sessionNumber);
}

export async function saveTugJsonToCache(
  result: NativeImuStopResult,
  participant: Participant,
  sessionNumber = 1
) {
  return saveSensorCsvToCache("TUG", result as NativeImuLikeResult, participant, sessionNumber);
}

export async function saveSl30sJsonToCache(
  result: NativeImuStopResult,
  participant: Participant,
  sessionNumber = 1
) {
  return saveSensorCsvToCache("SL30S", result as NativeImuLikeResult, participant, sessionNumber);
}

export async function saveLosJsonToCache(
  result: NativeImuStopResult,
  participant: Participant,
  sessionNumber = 1
) {
  return saveSensorCsvToCache("LOS", result as NativeImuLikeResult, participant, sessionNumber);
}

export async function saveUttJsonToCache(
  result: NativeImuStopResult,
  participant: Participant,
  sessionNumber = 1
) {
  return saveSensorCsvToCache("UTT", result as NativeImuLikeResult, participant, sessionNumber);
}

export async function saveMarchaCsvToCache(
  result: NativeImuStopResult,
  participant: Participant,
  sessionNumber = 1
) {
  return saveMarchaJsonToCache(result, participant, sessionNumber);
}

export async function saveTugCsvToCache(
  result: NativeImuStopResult,
  participant: Participant,
  sessionNumber = 1
) {
  return saveTugJsonToCache(result, participant, sessionNumber);
}

export async function saveSl30sCsvToCache(
  result: NativeImuStopResult,
  participant: Participant,
  sessionNumber = 1
) {
  return saveSl30sJsonToCache(result, participant, sessionNumber);
}

export async function saveLosCsvToCache(
  result: NativeImuStopResult,
  participant: Participant,
  sessionNumber = 1
) {
  return saveLosJsonToCache(result, participant, sessionNumber);
}

export async function saveUttCsvToCache(
  result: NativeImuStopResult,
  participant: Participant,
  sessionNumber = 1
) {
  return saveUttJsonToCache(result, participant, sessionNumber);
}

async function uploadSensorCsvResultToSupabase(
  testType: SensorCsvTestType,
  result: NativeImuStopResult,
  participant: Participant
) {
  return uploadCsvToSupabase(testType, result, participant);
}

export async function uploadMarchaJsonToSupabase(
  result: NativeImuStopResult,
  participant: Participant
) {
  return uploadSensorCsvResultToSupabase("MARCHA", result, participant);
}

export async function uploadTugJsonToSupabase(
  result: NativeImuStopResult,
  participant: Participant
) {
  return uploadSensorCsvResultToSupabase("TUG", result, participant);
}

export async function uploadSl30sJsonToSupabase(
  result: NativeImuStopResult,
  participant: Participant
) {
  return uploadSensorCsvResultToSupabase("SL30S", result, participant);
}

export async function uploadLosJsonToSupabase(
  result: NativeImuStopResult,
  participant: Participant
) {
  return uploadSensorCsvResultToSupabase("LOS", result, participant);
}

export async function uploadUttJsonToSupabase(
  result: NativeImuStopResult,
  participant: Participant
) {
  return uploadSensorCsvResultToSupabase("UTT", result, participant);
}

export async function uploadMarchaCsvToSupabase(
  result: NativeImuStopResult,
  participant: Participant
) {
  return uploadMarchaJsonToSupabase(result, participant);
}

export async function uploadTugCsvToSupabase(
  result: NativeImuStopResult,
  participant: Participant
) {
  return uploadTugJsonToSupabase(result, participant);
}

export async function uploadSl30sCsvToSupabase(
  result: NativeImuStopResult,
  participant: Participant
) {
  return uploadSl30sJsonToSupabase(result, participant);
}

export async function uploadLosCsvToSupabase(
  result: NativeImuStopResult,
  participant: Participant
) {
  return uploadLosJsonToSupabase(result, participant);
}

export async function uploadUttCsvToSupabase(
  result: NativeImuStopResult,
  participant: Participant
) {
  return uploadUttJsonToSupabase(result, participant);
}

async function uploadIvcf20JsonToSupabaseInternal(
  payload: Ivcf20JsonPayload,
  participant: Participant
) {
  const performedAt = payload.performed_at || new Date().toISOString();

  const firstGuessSessionNumber =
    payload.session_number || (await getNextSessionNumber(String(participant.id), "IVCF20"));

  const reserved = await reserveTestSessionWithRetry({
    testType: "IVCF20",
    participant,
    sessionNumber: firstGuessSessionNumber,
    samplingHz: payload.sampling_hz ?? SAMPLING_HZ,
    performedAt,
  });

  const finalSessionNumber = reserved.session_number;
  const finalPayload: Ivcf20JsonPayload = {
    ...payload,
    session_number: finalSessionNumber,
    session_label: `S${finalSessionNumber}`,
    participant_id: String(participant.id),
    participant_name: participant.name,
    platform: Platform.OS,
    performed_at: performedAt,
    sampling_hz: payload.sampling_hz ?? SAMPLING_HZ,
  };

  const path = buildSessionRawPath(
    "IVCF20",
    String(participant.id),
    finalSessionNumber,
    "json"
  );

  const body = JSON.stringify(finalPayload);
  const binary = new TextEncoder().encode(body);

  try {
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, binary, {
      contentType: "application/json",
      upsert: false,
    });

    if (uploadError) throw uploadError;

    await finalizeReservedSession({
      sessionId: reserved.id,
      path,
      performedAt,
    });

    return {
      sessionNumber: finalSessionNumber,
      path,
      payload: finalPayload,
    };
  } catch (error) {
    await removeFromStorageIfExists(path);
    await failReservedSession(
      reserved.id,
      error instanceof Error ? error.message : "Falha no upload do JSON."
    );
    await deleteSessionIfExists(reserved.id);
    throw error;
  }
}

export async function uploadIvcf20JsonToSupabase(
  payload: Ivcf20JsonPayload,
  participant: Participant
) {
  return uploadIvcf20JsonToSupabaseInternal(payload, participant);
}

export async function uploadIvcf20ResultToSupabase(data: {
  participant: Participant;
  scoreTotal: number;
  classification: Ivcf20Classification;
  blockScores: Array<Partial<Ivcf20CategoryScore> & { key: string; score?: number }>;
  answers?: Record<string, unknown>;
  meta?: Record<string, unknown>;
  sessionNumber?: number;
}) {
  const guessedSessionNumber =
    data.sessionNumber ?? (await getNextSessionNumber(String(data.participant.id), "IVCF20"));

  const payload = buildIvcf20JsonPayload({
    participant: data.participant,
    sessionNumber: guessedSessionNumber,
    scoreTotal: data.scoreTotal,
    classification: data.classification,
    blockScores: data.blockScores,
    answers: data.answers,
    meta: data.meta,
  });

  return uploadIvcf20JsonToSupabaseInternal(payload, data.participant);
}