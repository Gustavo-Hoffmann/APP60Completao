import { NativeEventEmitter, NativeModules, Platform, EmitterSubscription } from "react-native";

const { NativeIMU } = NativeModules as any;

export type NativeImuSampleRow = [
  number, // t_ms
  number, // ax
  number, // ay
  number, // az
  number, // gx
  number, // gy
  number, // gz
  number, // userAx
  number, // userAy
  number, // userAz
  number, // gravX
  number, // gravY
  number, // gravZ
  number, // roll
  number, // pitch
  number // yaw
];

export type NativeImuStats = {
  n: number;
  hzMean?: number;
  dtMeanMs?: number;
  dtMinMs?: number;
  dtMaxMs?: number;
  pctIn58to62?: number;
  droppedEstimated?: number;
  targetHz?: number;
  targetDtMs?: number;
  dtCount?: number;
};

export type NativeImuStopReason = "auto_finish" | "manual" | "timeout" | string;

export type NativeImuTugInfo = {
  detected?: boolean;
  startDetectedMs?: number;
  endDetectedMs?: number;
  durationMs?: number;
  stopReason?: NativeImuStopReason;
};

export type NativeImuStopResult = {
  samples: NativeImuSampleRow[];
  stats: NativeImuStats;
  tug?: NativeImuTugInfo;
};

export type NativeImuAutoStopEvent = NativeImuStopResult;

export type NativeImuStartOptions = {
  hz?: number;
  mode?: "default" | "tug";
};

let nativeImuEmitter: NativeEventEmitter | null = null;

function ensureNativeImu() {
  if (!NativeIMU) {
    throw new Error(
      `Módulo nativo NativeIMU não encontrado em ${Platform.OS}. Verifique se os arquivos nativos foram adicionados ao target/build corretamente.`
    );
  }
}

function getEmitter() {
  ensureNativeImu();
  if (!nativeImuEmitter) {
    nativeImuEmitter = new NativeEventEmitter(NativeIMU);
  }
  return nativeImuEmitter;
}

export function imuIsAvailable(): boolean {
  return !!NativeIMU;
}

export async function imuStart(
  hzOrOptions: number | NativeImuStartOptions = 60,
  modeArg: "default" | "tug" = "default"
): Promise<void> {
  ensureNativeImu();

  if (typeof NativeIMU.start !== "function") {
    throw new Error("NativeIMU.start não está disponível.");
  }

  const options: NativeImuStartOptions =
    typeof hzOrOptions === "number"
      ? { hz: hzOrOptions, mode: modeArg }
      : {
          hz: hzOrOptions?.hz ?? 60,
          mode: hzOrOptions?.mode ?? "default",
        };

  await NativeIMU.start({
    hz: options.hz ?? 60,
    mode: options.mode ?? "default",
  });
}

export async function imuStop(): Promise<NativeImuStopResult> {
  ensureNativeImu();

  if (typeof NativeIMU.stop !== "function") {
    throw new Error("NativeIMU.stop não está disponível.");
  }

  const out = await NativeIMU.stop();
  return normalizeStopResult(out);
}

export function imuClear(): void {
  ensureNativeImu();

  if (typeof NativeIMU.clear !== "function") {
    throw new Error("NativeIMU.clear não está disponível.");
  }

  NativeIMU.clear();
}

export function imuAddAutoStopListener(
  callback: (event: NativeImuAutoStopEvent) => void
): EmitterSubscription {
  const emitter = getEmitter();

  return emitter.addListener("NativeIMUAutoStop", (event: unknown) => {
    callback(normalizeStopResult(event));
  });
}

export function addNativeImuAutoStopListener(
  callback: (event: NativeImuAutoStopEvent) => void
): EmitterSubscription {
  return imuAddAutoStopListener(callback);
}

function normalizeStopResult(out: any): NativeImuStopResult {
  return {
    samples: normalizeSamples(out?.samples),
    stats: {
      n: toInt(out?.stats?.n, 0),
      hzMean: toNumOrUndef(out?.stats?.hzMean),
      dtMeanMs: toNumOrUndef(out?.stats?.dtMeanMs),
      dtMinMs: toNumOrUndef(out?.stats?.dtMinMs),
      dtMaxMs: toNumOrUndef(out?.stats?.dtMaxMs),
      pctIn58to62: toNumOrUndef(out?.stats?.pctIn58to62),
      droppedEstimated: toIntOrUndef(out?.stats?.droppedEstimated),
      targetHz: toNumOrUndef(out?.stats?.targetHz),
      targetDtMs: toNumOrUndef(out?.stats?.targetDtMs),
      dtCount: toIntOrUndef(out?.stats?.dtCount),
    },
    tug: out?.tug
      ? {
          detected:
            typeof out?.tug?.detected === "boolean"
              ? out.tug.detected
              : Boolean(out?.tug?.detected),
          startDetectedMs: toNumOrUndef(out?.tug?.startDetectedMs),
          endDetectedMs: toNumOrUndef(out?.tug?.endDetectedMs),
          durationMs: toNumOrUndef(out?.tug?.durationMs),
          stopReason: normalizeStopReason(out?.tug?.stopReason),
        }
      : undefined,
  };
}

function normalizeSamples(value: unknown): NativeImuSampleRow[] {
  if (!Array.isArray(value)) return [];

  const out: NativeImuSampleRow[] = [];

  for (const row of value) {
    if (!Array.isArray(row) || row.length < 16) continue;

    out.push([
      toNum(row[0]),
      toNum(row[1]),
      toNum(row[2]),
      toNum(row[3]),
      toNum(row[4]),
      toNum(row[5]),
      toNum(row[6]),
      toNum(row[7]),
      toNum(row[8]),
      toNum(row[9]),
      toNum(row[10]),
      toNum(row[11]),
      toNum(row[12]),
      toNum(row[13]),
      toNum(row[14]),
      toNum(row[15]),
    ]);
  }

  return out;
}

function normalizeStopReason(v: unknown): NativeImuStopReason | undefined {
  if (typeof v !== "string" || !v.trim()) return undefined;
  return v;
}

function toNumOrUndef(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;

  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }

  return undefined;
}

function toIntOrUndef(v: unknown): number | undefined {
  const n = toNumOrUndef(v);
  return n == null ? undefined : Math.trunc(n);
}

function toNum(v: unknown, fallback = 0): number {
  const n = toNumOrUndef(v);
  return n == null ? fallback : n;
}

function toInt(v: unknown, fallback = 0): number {
  const n = toIntOrUndef(v);
  return n == null ? fallback : n;
}