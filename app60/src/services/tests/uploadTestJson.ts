import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

import { supabase } from "../supabase/client";
import type { Participant } from "../../models/types";
import type { NativeImuStopResult } from "../sensors/nativeImu";

const BUCKET = "test-data";
const SAMPLING_HZ = 60;

export type SupportedTestType = "MARCHA" | "TUG" | "LOS" | "SL30S" | "UTT" | "IVCF20";

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

type SensorCsvTestType = Exclude<SupportedTestType, "IVCF20">;

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
    .slice(0, 40);
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

function normalizeSensorRow(row: unknown): number[] {
  const arr = Array.isArray(row) ? row : [];
  return [
    asFiniteNumber(arr[0]),  // wall_t_ms
    asFiniteNumber(arr[1]),  // row_t_ms

    asFiniteNumber(arr[2]),  // acc_t_ms
    asFiniteNumber(arr[3]),  // ax
    asFiniteNumber(arr[4]),  // ay
    asFiniteNumber(arr[5]),  // az

    asFiniteNumber(arr[6]),  // gyro_t_ms
    asFiniteNumber(arr[7]),  // gx
    asFiniteNumber(arr[8]),  // gy
    asFiniteNumber(arr[9]),  // gz

    asFiniteNumber(arr[10]), // user_acc_t_ms
    asFiniteNumber(arr[11]), // user_ax
    asFiniteNumber(arr[12]), // user_ay
    asFiniteNumber(arr[13]), // user_az

    asFiniteNumber(arr[14]), // grav_t_ms
    asFiniteNumber(arr[15]), // grav_x
    asFiniteNumber(arr[16]), // grav_y
    asFiniteNumber(arr[17]), // grav_z

    asFiniteNumber(arr[18]), // att_t_ms
    asFiniteNumber(arr[19]), // roll
    asFiniteNumber(arr[20]), // pitch
    asFiniteNumber(arr[21]), // yaw
  ];
}

function escapeCsvValue(value: unknown): string {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function round3(value: unknown): number {
  const n = asFiniteNumber(value, 0);
  return Math.round(n * 1000) / 1000;
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
    `# schema_version=2`,
    `# test_type=${testType}`,
    `# participant_id=${String(participant?.id ?? "")}`,
    `# participant_name=${String(participant?.name ?? "")}`,
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

function buildCsvFilename(
  testType: SensorCsvTestType,
  participant: Participant,
  sessionNumber: number
) {
  const pid = participant?.id ? safeSlug(String(participant.id)) : "sem_participante";
  const pname = participant?.name ? safeSlug(participant.name) : "sem_nome";
  const stamp = fileStamp();

  switch (testType) {
    case "MARCHA":
      return `app60_marcha_${pid}_${pname}_S${sessionNumber}_${stamp}.csv`;
    case "TUG":
      return `app60_tug_${pid}_${pname}_S${sessionNumber}_${stamp}.csv`;
    case "SL30S":
      return `app60_sl30s_${pid}_${pname}_S${sessionNumber}_${stamp}.csv`;
    case "LOS":
      return `app60_los_${pid}_${pname}_S${sessionNumber}_${stamp}.csv`;
    case "UTT":
      return `app60_utt_${pid}_${pname}_S${sessionNumber}_${stamp}.csv`;
    default:
      return `app60_teste_${pid}_${pname}_S${sessionNumber}_${stamp}.csv`;
  }
}

function buildIvcf20Filename(participant: Participant, sessionNumber: number) {
  const pid = participant?.id ? safeSlug(String(participant.id)) : "sem_participante";
  const pname = participant?.name ? safeSlug(participant.name) : "sem_nome";
  const stamp = fileStamp();
  return `app60_ivcf20_${pid}_${pname}_S${sessionNumber}_${stamp}.json`;
}

async function saveTextToCache(
  content: string,
  filename: string,
  mime: "text/csv" | "application/json"
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

async function uploadCsvToSupabase(
  testType: SensorCsvTestType,
  csvContent: string,
  participant: Participant,
  sessionNumber: number,
  performedAt: string
): Promise<{
  sessionNumber: number;
  path: string;
}> {
  const dbTestType = getDbTestType(testType);
  const path = `raw/${testType}/${participant.id}/S${sessionNumber}/raw.csv`;
  const binary = new TextEncoder().encode(csvContent);

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, binary, {
    contentType: "text/csv",
    upsert: false,
  });

  if (uploadError) throw uploadError;

  const { error: insertError } = await supabase.from("test_sessions").insert({
    participant_id: participant.id,
    test_type: dbTestType,
    session_number: sessionNumber,
    raw_file_path: path,
    platform: Platform.OS,
    sampling_hz: SAMPLING_HZ,
    performed_at: performedAt,
  });

  if (insertError) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw insertError;
  }

  return {
    sessionNumber,
    path,
  };
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
    sampling_hz: 60,
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
  const filename = buildIvcf20Filename(data.participant, data.sessionNumber);
  const json = JSON.stringify(payload, null, 2);
  const saved = await saveTextToCache(json, filename, "application/json");
  return { uri: saved.uri, filename: saved.filename, payload };
}

async function saveSensorCsvToCache(
  testType: SensorCsvTestType,
  result: NativeImuLikeResult,
  participant: Participant,
  sessionNumber = 1
): Promise<{ uri: string; filename: string; csv: string }> {
  const performedAt = new Date().toISOString();
  const csv = buildSensorCsv(testType, result, participant, sessionNumber, performedAt);
  const filename = buildCsvFilename(testType, participant, sessionNumber);
  const saved = await saveTextToCache(csv, filename, "text/csv");
  return { uri: saved.uri, filename: saved.filename, csv };
}

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

async function uploadSensorCsvResultToSupabase(
  testType: SensorCsvTestType,
  result: NativeImuStopResult,
  participant: Participant
) {
  const sessionNumber = await getNextSessionNumber(String(participant.id), testType);
  const performedAt = new Date().toISOString();
  const csv = buildSensorCsv(
    testType,
    result as NativeImuLikeResult,
    participant,
    sessionNumber,
    performedAt
  );

  return uploadCsvToSupabase(testType, csv, participant, sessionNumber, performedAt);
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

async function uploadIvcf20JsonToSupabaseInternal(
  payload: Ivcf20JsonPayload,
  participant: Participant
) {
  const path = `raw/IVCF20/${participant.id}/S${payload.session_number}/raw.json`;
  const body = JSON.stringify(payload);
  const binary = new TextEncoder().encode(body);

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, binary, {
    contentType: "application/json",
    upsert: false,
  });

  if (uploadError) throw uploadError;

  const { error: insertError } = await supabase.from("test_sessions").insert({
    participant_id: participant.id,
    test_type: "IVCF_20",
    session_number: payload.session_number,
    raw_file_path: path,
    platform: Platform.OS,
    sampling_hz: payload.sampling_hz ?? SAMPLING_HZ,
    performed_at: payload.performed_at,
  });

  if (insertError) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw insertError;
  }

  return {
    sessionNumber: payload.session_number,
    path,
    payload,
  };
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
  const sessionNumber =
    data.sessionNumber ?? (await getNextSessionNumber(String(data.participant.id), "IVCF20"));

  const payload = buildIvcf20JsonPayload({
    participant: data.participant,
    sessionNumber,
    scoreTotal: data.scoreTotal,
    classification: data.classification,
    blockScores: data.blockScores,
    answers: data.answers,
    meta: data.meta,
  });

  return uploadIvcf20JsonToSupabaseInternal(payload, data.participant);
}