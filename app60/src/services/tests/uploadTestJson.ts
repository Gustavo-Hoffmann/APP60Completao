import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

import { supabase } from "../supabase/client";
import type { Participant } from "../../models/types";
import type { NativeImuStopResult } from "../sensors/nativeImu";

const BUCKET = "test-data";
const SAMPLING_HZ = 60;

export type SupportedTestType = "MARCHA" | "TUG" | "LOS" | "SL30S" | "UTT" | "IVCF20";

type BaseJsonPayload<T extends Exclude<SupportedTestType, "IVCF20">> = {
  schema_version: 1;
  test_type: T;
  participant_id: string;
  participant_name?: string;
  session_number: number;
  session_label: string;
  performed_at: string;
  platform: string;
  sampling_hz: 60;
  signals: {
    t: number[];
    ax: number[];
    ay: number[];
    az: number[];
    gx: number[];
    gy: number[];
    gz: number[];
  };
  stats?: NativeImuStopResult["stats"];
};

export type MarchaJsonPayload = BaseJsonPayload<"MARCHA">;

export type TugJsonPayload = BaseJsonPayload<"TUG"> & {
  tug?: NativeImuStopResult["tug"];
};

export type Sl30sJsonPayload = BaseJsonPayload<"SL30S">;
export type LosJsonPayload = BaseJsonPayload<"LOS">;
export type UttJsonPayload = BaseJsonPayload<"UTT">;

export type Ivcf20Classification = {
  key: "robusto" | "prefragil" | "fragil";
  label: string;
};

export type Ivcf20CategoryScore = {
  key:
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

function buildBaseJsonPayload<T extends Exclude<SupportedTestType, "IVCF20">>(
  testType: T,
  result: NativeImuStopResult,
  participant: Participant,
  sessionNumber: number,
  performedAt = new Date()
): BaseJsonPayload<T> {
  const rows = result?.samples ?? [];
  const t0 = rows.length ? Number(rows[0][0] ?? 0) : 0;

  return {
    schema_version: 1,
    test_type: testType,
    participant_id: String(participant.id),
    participant_name: participant.name,
    session_number: sessionNumber,
    session_label: `S${sessionNumber}`,
    performed_at: performedAt.toISOString(),
    platform: Platform.OS,
    sampling_hz: 60,
    signals: {
      t: rows.map((r) => Number(((Number(r[0] ?? 0) - t0) / 1000).toFixed(6))),
      ax: rows.map((r) => Number(r[1] ?? 0)),
      ay: rows.map((r) => Number(r[2] ?? 0)),
      az: rows.map((r) => Number(r[3] ?? 0)),
      gx: rows.map((r) => Number(r[4] ?? 0)),
      gy: rows.map((r) => Number(r[5] ?? 0)),
      gz: rows.map((r) => Number(r[6] ?? 0)),
    },
    stats: result?.stats,
  };
}

function buildJsonFilename(
  testType: SupportedTestType,
  participant: Participant,
  sessionNumber: number
) {
  const pid = participant?.id ? safeSlug(String(participant.id)) : "sem_participante";
  const pname = participant?.name ? safeSlug(participant.name) : "sem_nome";
  const stamp = fileStamp();

  switch (testType) {
    case "MARCHA":
      return `app60_marcha_2min_${pid}_${pname}_S${sessionNumber}_${stamp}.json`;
    case "TUG":
      return `app60_tug_${pid}_${pname}_S${sessionNumber}_${stamp}.json`;
    case "SL30S":
      return `app60_sl30s_${pid}_${pname}_S${sessionNumber}_${stamp}.json`;
    case "LOS":
      return `app60_los_${pid}_${pname}_S${sessionNumber}_${stamp}.json`;
    case "UTT":
      return `app60_utt_${pid}_${pname}_S${sessionNumber}_${stamp}.json`;
    case "IVCF20":
      return `app60_ivcf20_${pid}_${pname}_S${sessionNumber}_${stamp}.json`;
    default:
      return `app60_teste_${pid}_${pname}_S${sessionNumber}_${stamp}.json`;
  }
}

async function saveJsonToCache<TPayload>(
  payload: TPayload,
  filename: string
): Promise<{ uri: string; filename: string; payload: TPayload }> {
  const finalName = filename.toLowerCase().endsWith(".json") ? filename : `${filename}.json`;
  const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;

  if (!baseDir) {
    throw new Error("Sem diretório disponível para salvar o arquivo.");
  }

  const uri = baseDir + finalName;
  const json = JSON.stringify(payload, null, 2);

  await FileSystem.writeAsStringAsync(uri, json, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  return { uri, filename: finalName, payload };
}

async function uploadJsonToSupabase<TPayload extends { performed_at: string; sampling_hz?: number | null }>(
  testType: SupportedTestType,
  payload: TPayload,
  participant: Participant,
  sessionNumber: number
): Promise<{
  sessionNumber: number;
  path: string;
  payload: TPayload;
}> {
  const path = `raw/${testType}/${participant.id}/S${sessionNumber}/raw.json`;
  const body = JSON.stringify(payload);
  const binary = new TextEncoder().encode(body);

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, binary, {
      contentType: "application/json",
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { error: insertError } = await supabase.from("test_sessions").insert({
    participant_id: participant.id,
    test_type: testType,
    session_number: sessionNumber,
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
    sessionNumber,
    path,
    payload,
  };
}

export function buildMarchaJsonPayload(
  result: NativeImuStopResult,
  participant: Participant,
  sessionNumber: number,
  performedAt = new Date()
): MarchaJsonPayload {
  return buildBaseJsonPayload("MARCHA", result, participant, sessionNumber, performedAt);
}

export function buildTugJsonPayload(
  result: NativeImuStopResult,
  participant: Participant,
  sessionNumber: number,
  performedAt = new Date()
): TugJsonPayload {
  return {
    ...buildBaseJsonPayload("TUG", result, participant, sessionNumber, performedAt),
    tug: result?.tug,
  };
}

export function buildSl30sJsonPayload(
  result: NativeImuStopResult,
  participant: Participant,
  sessionNumber: number,
  performedAt = new Date()
): Sl30sJsonPayload {
  return buildBaseJsonPayload("SL30S", result, participant, sessionNumber, performedAt);
}

export function buildLosJsonPayload(
  result: NativeImuStopResult,
  participant: Participant,
  sessionNumber: number,
  performedAt = new Date()
): LosJsonPayload {
  return buildBaseJsonPayload("LOS", result, participant, sessionNumber, performedAt);
}

export function buildUttJsonPayload(
  result: NativeImuStopResult,
  participant: Participant,
  sessionNumber: number,
  performedAt = new Date()
): UttJsonPayload {
  return buildBaseJsonPayload("UTT", result, participant, sessionNumber, performedAt);
}

export function buildIvcf20JsonPayload(
  data: {
    participant: Participant;
    sessionNumber: number;
    scoreTotal: number;
    classification: Ivcf20Classification;
    categories: Ivcf20Categories;
    blockScores: Ivcf20CategoryScore[];
    answers?: Record<string, unknown>;
    meta?: Record<string, unknown>;
  },
  performedAt = new Date()
): Ivcf20JsonPayload {
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
      categories: data.categories,
      block_scores: data.blockScores,
      answers: data.answers,
      meta: data.meta,
    },
  };
}

export async function saveIvcf20JsonToCache(
  data: {
    participant: Participant;
    sessionNumber: number;
    scoreTotal: number;
    classification: Ivcf20Classification;
    categories: Ivcf20Categories;
    blockScores: Ivcf20CategoryScore[];
    answers?: Record<string, unknown>;
    meta?: Record<string, unknown>;
  }
): Promise<{ uri: string; filename: string; payload: Ivcf20JsonPayload }> {
  const payload = buildIvcf20JsonPayload(data);
  const filename = buildJsonFilename("IVCF20", data.participant, data.sessionNumber);
  return saveJsonToCache(payload, filename);
}

export async function saveMarchaJsonToCache(
  result: NativeImuStopResult,
  participant: Participant,
  sessionNumber = 1
): Promise<{ uri: string; filename: string; payload: MarchaJsonPayload }> {
  const payload = buildMarchaJsonPayload(result, participant, sessionNumber);
  const filename = buildJsonFilename("MARCHA", participant, sessionNumber);
  return saveJsonToCache(payload, filename);
}

export async function saveTugJsonToCache(
  result: NativeImuStopResult,
  participant: Participant,
  sessionNumber = 1
): Promise<{ uri: string; filename: string; payload: TugJsonPayload }> {
  const payload = buildTugJsonPayload(result, participant, sessionNumber);
  const filename = buildJsonFilename("TUG", participant, sessionNumber);
  return saveJsonToCache(payload, filename);
}

export async function saveSl30sJsonToCache(
  result: NativeImuStopResult,
  participant: Participant,
  sessionNumber = 1
): Promise<{ uri: string; filename: string; payload: Sl30sJsonPayload }> {
  const payload = buildSl30sJsonPayload(result, participant, sessionNumber);
  const filename = buildJsonFilename("SL30S", participant, sessionNumber);
  return saveJsonToCache(payload, filename);
}

export async function saveLosJsonToCache(
  result: NativeImuStopResult,
  participant: Participant,
  sessionNumber = 1
): Promise<{ uri: string; filename: string; payload: LosJsonPayload }> {
  const payload = buildLosJsonPayload(result, participant, sessionNumber);
  const filename = buildJsonFilename("LOS", participant, sessionNumber);
  return saveJsonToCache(payload, filename);
}

export async function saveUttJsonToCache(
  result: NativeImuStopResult,
  participant: Participant,
  sessionNumber = 1
): Promise<{ uri: string; filename: string; payload: UttJsonPayload }> {
  const payload = buildUttJsonPayload(result, participant, sessionNumber);
  const filename = buildJsonFilename("UTT", participant, sessionNumber);
  return saveJsonToCache(payload, filename);
}

export async function getNextSessionNumber(
  participantId: string,
  testType: SupportedTestType = "MARCHA"
): Promise<number> {
  const { data, error } = await supabase
    .from("test_sessions")
    .select("session_number")
    .eq("participant_id", participantId)
    .eq("test_type", testType)
    .order("session_number", { ascending: false })
    .limit(1);

  if (error) throw error;

  const currentMax = data?.[0]?.session_number ?? 0;
  return currentMax + 1;
}

export async function uploadMarchaJsonToSupabase(
  result: NativeImuStopResult,
  participant: Participant
) {
  const sessionNumber = await getNextSessionNumber(String(participant.id), "MARCHA");
  const payload = buildMarchaJsonPayload(result, participant, sessionNumber);

  return uploadJsonToSupabase("MARCHA", payload, participant, sessionNumber);
}

export async function uploadTugJsonToSupabase(
  result: NativeImuStopResult,
  participant: Participant
) {
  const sessionNumber = await getNextSessionNumber(String(participant.id), "TUG");
  const payload = buildTugJsonPayload(result, participant, sessionNumber);

  return uploadJsonToSupabase("TUG", payload, participant, sessionNumber);
}

export async function uploadSl30sJsonToSupabase(
  result: NativeImuStopResult,
  participant: Participant
) {
  const sessionNumber = await getNextSessionNumber(String(participant.id), "SL30S");
  const payload = buildSl30sJsonPayload(result, participant, sessionNumber);

  return uploadJsonToSupabase("SL30S", payload, participant, sessionNumber);
}

export async function uploadLosJsonToSupabase(
  result: NativeImuStopResult,
  participant: Participant
) {
  const sessionNumber = await getNextSessionNumber(String(participant.id), "LOS");
  const payload = buildLosJsonPayload(result, participant, sessionNumber);

  return uploadJsonToSupabase("LOS", payload, participant, sessionNumber);
}

export async function uploadUttJsonToSupabase(
  result: NativeImuStopResult,
  participant: Participant
) {
  const sessionNumber = await getNextSessionNumber(String(participant.id), "UTT");
  const payload = buildUttJsonPayload(result, participant, sessionNumber);

  return uploadJsonToSupabase("UTT", payload, participant, sessionNumber);
}

export async function uploadIvcf20JsonToSupabase(
  payload: Ivcf20JsonPayload,
  participant: Participant
) {
  return uploadJsonToSupabase("IVCF20", payload, participant, payload.session_number);
}