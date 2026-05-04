import type { Participant } from "../../../models/types";
import type { NativeImuSampleRow, NativeImuStopResult } from "../../../services/sensors/nativeImu";
import { IMU22 } from "../nativeImuSampleLayout";

type LoSDirection = "F" | "R" | "B" | "L";

export type LosDirectionResult = {
  direction: LoSDirection;
  directionName: string;
  excursionCM: number;
  preCompensationCM: number;
  totalCM: number;
  deltaPostCompensationCM: number;
  compensated: boolean;
  tOnsetCompensationSec: number | null;
  limitCM: number | null;
  limitPercent: number | null;
  comExcursionCM: number;
  comLimitCM: number | null;
  comLimitPercent: number | null;
  phaseDurationSec: number;
  timeToPeakSec: number;
  /** Tempos absolutos no traço (s desde o primeiro sample), alinhados ao LoSCollector. */
  tStartSec: number;
  tPeakSec: number;
  tEndSec: number;
  omegaPeak: number;
  nSubmovements: number;
  hadPause: boolean;
  quality: string;
  warning: string;
  peakIndex: number;
  apAtPeakCM: number;
  mlAtPeakCM: number;
};

export type LosAnalysis = {
  samplingHz: number;
  dtMeanSec: number;
  radialStartThresholdCM: number;
  radialReturnThresholdCM: number;
  omegaThreshold: number;
  directionResults: LosDirectionResult[];
  warnings: string[];
  analysisVersion: string;
  movementStartTimeSec: number | null;
  heightCM: number | null;
  phoneHeightCM: number;
  processed: {
    tSec: number[];
    phoneAPCM: number[];
    phoneMLCM: number[];
    radialPhoneCM: number[];
    omega: number[];
    /** Fase por amostra ("" = fora de fase segmentada). */
    losPhase: string[];
    isPostCompensationRegion: boolean[];
  };
};

type ParticipantLosFields = {
  heightCm?: unknown;
  estaturaCm?: unknown;
  height?: unknown;
  estatura?: unknown;
  altura?: unknown;
  phoneHeightCm?: unknown;
  alturaCelularCm?: unknown;
  baseAPCm?: unknown;
  baseMLCm?: unknown;
  baseApCm?: unknown;
  baseMlCm?: unknown;
};

function toOptionalNumber(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function median(values: number[]) {
  const s = values.filter((v) => Number.isFinite(v)).slice().sort((a, b) => a - b);
  if (!s.length) return 0;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function mean(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

function std(values: number[]) {
  if (values.length < 2) return 0;
  const m = mean(values);
  const v = values.reduce((acc, x) => acc + (x - m) * (x - m), 0) / (values.length - 1);
  return Math.sqrt(v);
}

function mad(values: number[], center: number) {
  const absDev = values.map((v) => Math.abs(v - center));
  return median(absDev) * 1.4826;
}

function lowPassOnePole(values: number[], fs: number, cutoffHz: number) {
  if (values.length < 2 || fs <= 0 || cutoffHz <= 0) return values.slice();
  const dt = 1 / fs;
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const alpha = dt / (rc + dt);
  const out: number[] = new Array(values.length);
  let prev = values[0];
  out[0] = prev;
  for (let i = 1; i < values.length; i++) {
    const v = values[i];
    prev = prev + alpha * (v - prev);
    out[i] = prev;
  }
  return out;
}

function lowPassZeroPhase(values: number[], fs: number, cutoffHz: number) {
  const fwd = lowPassOnePole(values, fs, cutoffHz);
  const rev = lowPassOnePole(fwd.slice().reverse(), fs, cutoffHz).reverse();
  return rev;
}

function computeVelocity(signal: number[], fs: number) {
  if (signal.length < 2) return signal.map(() => 0);
  const out: number[] = new Array(signal.length);
  out[0] = 0;
  for (let i = 1; i < signal.length; i++) out[i] = (signal[i] - signal[i - 1]) * fs;
  return out;
}

function primarySignal(direction: LoSDirection, ap: number[], ml: number[]) {
  switch (direction) {
    case "F":
      return ap;
    case "R":
      return ml;
    case "B":
      return ap.map((v) => -v);
    case "L":
      return ml.map((v) => -v);
  }
}

function classifyDirection(ap: number, ml: number): LoSDirection {
  if (Math.abs(ap) >= Math.abs(ml)) return ap >= 0 ? "F" : "B";
  return ml >= 0 ? "R" : "L";
}

function directionName(direction: LoSDirection) {
  switch (direction) {
    case "F":
      return "Frente";
    case "R":
      return "Direita";
    case "B":
      return "Trás";
    case "L":
      return "Esquerda";
  }
}

function resolveFsFromT(tSec: number[], fallbackHz: number) {
  if (tSec.length < 3) return fallbackHz;
  const diffs: number[] = [];
  for (let i = 1; i < tSec.length; i++) {
    const dt = tSec[i] - tSec[i - 1];
    if (dt > 0 && Number.isFinite(dt)) diffs.push(dt);
  }
  const dtMed = median(diffs);
  const hz = dtMed > 0 ? 1 / dtMed : fallbackHz;
  return clamp(hz, 10, 200);
}

function readLosParticipantParams(participant: Participant | null | undefined) {
  const p = (participant ?? ({} as Participant)) as Participant & ParticipantLosFields;

  const heightRaw =
    p.heightCm ?? p.estaturaCm ?? p.height ?? p.estatura ?? p.altura;
  let heightCm = toOptionalNumber(heightRaw);
  if (heightCm != null && heightCm > 0 && heightCm <= 3) heightCm *= 100;
  if (heightCm != null && (heightCm < 50 || heightCm > 260)) heightCm = null;

  const phoneHeightCm = toOptionalNumber(p.phoneHeightCm ?? p.alturaCelularCm);
  const baseAPCm = toOptionalNumber(p.baseAPCm ?? p.baseApCm);
  const baseMLCm = toOptionalNumber(p.baseMLCm ?? p.baseMlCm);

  return { heightCm, phoneHeightCm, baseAPCm, baseMLCm };
}

function geometricLimitsCM(args: {
  baseAPCm: number | null;
  baseMLCm: number | null;
  hComM: number;
  hPhoneM: number;
}) {
  const { baseAPCm, baseMLCm, hComM, hPhoneM } = args;

  if (baseAPCm == null || baseMLCm == null || baseAPCm <= 0 || baseMLCm <= 0) {
    return null;
  }

  // Mesmas frações do LoSCollector.
  const frontFraction = 0.57;
  const backFraction = 0.43;
  const ratio = hComM > 0 ? hPhoneM / hComM : 1;

  const com = {
    F: frontFraction * baseAPCm,
    B: backFraction * baseAPCm,
    R: baseMLCm / 2,
    L: baseMLCm / 2,
  } satisfies Record<LoSDirection, number>;

  const out: Record<LoSDirection, { com: number; phone: number }> = {
    F: { com: com.F, phone: com.F * ratio },
    R: { com: com.R, phone: com.R * ratio },
    B: { com: com.B, phone: com.B * ratio },
    L: { com: com.L, phone: com.L * ratio },
  };

  return out;
}

type Phase = {
  direction: LoSDirection;
  startIndex: number;
  peakIndex: number;
  endIndex: number;
  tStart: number;
  tPeak: number;
  tEnd: number;
  nSubmovements: number;
  hadPause: boolean;
  quality: string;
  warnings: string[];
};

function countSubmovements(primary: number[], start: number, end: number, peakValue: number, fs: number) {
  if (end - start <= 4) return 1;
  const minDistance = Math.max(2, Math.floor(0.6 * fs));
  const threshold = Math.max(0.005, peakValue * 0.45);
  const peaks: number[] = [];

  for (let i = Math.max(start + 1, 1); i < Math.min(end, primary.length - 1); i++) {
    if (primary[i] < threshold) continue;
    if (!(primary[i] >= primary[i - 1] && primary[i] > primary[i + 1])) continue;
    const last = peaks[peaks.length - 1];
    if (last != null && i - last < minDistance) {
      if (primary[i] > primary[last]) peaks[peaks.length - 1] = i;
    } else {
      peaks.push(i);
    }
  }

  return Math.max(1, peaks.length);
}

function findPrimaryPhaseStart(primary: number[], cursor: number, peakIndex: number, peakValue: number, returnThreshold: number, fs: number) {
  const threshold = Math.max(returnThreshold, 0.2 * peakValue);
  const sustain = Math.max(2, Math.floor(0.15 * fs));
  let belowStreak = 0;
  let best = cursor;

  if (peakIndex <= cursor) return cursor;
  for (let i = peakIndex; i >= cursor; i--) {
    if (primary[i] <= threshold) {
      belowStreak += 1;
      if (belowStreak >= sustain) {
        best = Math.min(peakIndex, i + sustain - 1);
        break;
      }
    } else {
      belowStreak = 0;
    }
  }
  return best;
}

function findPrimaryPhaseEnd(primary: number[], peakIndex: number, peakValue: number, returnThreshold: number, fs: number) {
  const n = primary.length;
  if (peakIndex >= n) return Math.max(0, n - 1);

  const threshold = Math.max(returnThreshold, 0.2 * peakValue);
  const sustain = Math.max(3, Math.floor(0.45 * fs));
  let belowStreak = 0;

  for (let i = peakIndex; i < n; i++) {
    if (primary[i] <= threshold) {
      belowStreak += 1;
      if (belowStreak >= sustain) {
        return Math.max(peakIndex, i - belowStreak + 1);
      }
    } else {
      belowStreak = 0;
    }
  }

  const searchEnd = Math.min(n - 1, peakIndex + Math.floor(8 * fs));
  let best = searchEnd;
  for (let i = peakIndex; i <= searchEnd; i++) {
    if (primary[i] < primary[best]) best = i;
  }
  return best;
}

function segmentDirectionsByPrimaryPeaks(args: {
  t: number[];
  apM: number[];
  mlM: number[];
  radialM: number[];
  startThresholdM: number;
  returnThresholdM: number;
  limitsCM: Record<LoSDirection, { com: number; phone: number }> | null;
  fromIndex: number;
  fs: number;
}) {
  const { t, apM, mlM, radialM, startThresholdM, returnThresholdM, limitsCM, fromIndex, fs } = args;
  const n = Math.min(t.length, apM.length, mlM.length, radialM.length);
  const order: LoSDirection[] = ["F", "R", "B", "L"];

  const warnings: string[] = [];
  const phases: Phase[] = [];

  if (n < 12 || fromIndex >= n - 3) {
    return { phases, warnings: ["Sem amostras suficientes para segmentação por pico"] };
  }

  const absoluteFloorM = 0.025; // 2.5 cm
  const thresholdFromNoiseM = Math.max(absoluteFloorM, startThresholdM * 2.0);
  const minPeakGapFrames = Math.max(1, Math.floor(0.75 * fs));

  let cursor = Math.max(fromIndex, 0);

  for (const dir of order) {
    if (cursor >= n - 3) {
      warnings.push(`${dir}: fim do sinal antes da busca`);
      continue;
    }

    const primary = primarySignal(dir, apM, mlM);
    const phoneLimitM =
      limitsCM && limitsCM[dir]?.phone != null ? Math.max(limitsCM[dir].phone / 100, 0.001) : null;
    const minPrimaryPeakM = Math.max(thresholdFromNoiseM, phoneLimitM != null ? phoneLimitM * 0.08 : 0);

    let peakIndex = -1;
    let peakVal = -Infinity;
    for (let i = cursor; i < n - 1; i++) {
      const v = primary[i];
      if (!Number.isFinite(v)) continue;
      if (v > peakVal) {
        peakVal = v;
        peakIndex = i;
      }
    }

    if (peakIndex < 0 || !(peakVal >= minPrimaryPeakM)) {
      warnings.push(`${dir}: pico abaixo do limiar`);
      cursor = Math.min(n - 1, cursor + Math.floor(1 * fs));
      continue;
    }

    const startIdx = findPrimaryPhaseStart(primary, cursor, peakIndex, Math.max(peakVal, 1e-9), returnThresholdM, fs);
    const endIdx = findPrimaryPhaseEnd(primary, peakIndex, Math.max(peakVal, 1e-9), returnThresholdM, fs);
    const safeStart = clamp(startIdx, 0, n - 1);
    const safePeak = clamp(peakIndex, safeStart, n - 1);
    const safeEnd = clamp(endIdx, safePeak, n - 1);

    const nSub = countSubmovements(primary, safeStart, safeEnd, Math.max(peakVal, 1e-9), fs);
    const hadPause = nSub > 1;

    const radialAtPeak = Math.max(radialM[safePeak], 1e-9);
    const axisPeak = Math.max(0, primary[safePeak]);
    const diagonalRatio = axisPeak / radialAtPeak;

    const phaseWarnings: string[] = [];
    const qualityFlags: string[] = [];

    if (diagonalRatio < 0.7) {
      qualityFlags.push("MOVIMENTO_DIAGONAL");
      phaseWarnings.push(`Projeção no eixo ${(diagonalRatio * 100).toFixed(0)}% do radial`);
    }

    const radialDir = classifyDirection(apM[safePeak], mlM[safePeak]);
    if (radialDir !== dir) {
      qualityFlags.push("ORIENTACAO_SUSPEITA");
      phaseWarnings.push(`No pico, radial sugeriu ${radialDir}`);
    }

    if (hadPause) {
      qualityFlags.push("PAUSA_NA_FASE");
      phaseWarnings.push("Mais de um pico relevante no eixo");
    }

    phases.push({
      direction: dir,
      startIndex: safeStart,
      peakIndex: safePeak,
      endIndex: safeEnd,
      tStart: t[safeStart],
      tPeak: t[safePeak],
      tEnd: t[safeEnd],
      nSubmovements: nSub,
      hadPause,
      quality: qualityFlags.length ? qualityFlags.join("+") : "OK",
      warnings: phaseWarnings,
    });

    cursor = Math.min(n - 1, safePeak + minPeakGapFrames);
  }

  return { phases, warnings };
}

type CompensationDetection = { index: number; reason: "gyro" | "geometrica" | "abrupta"; cleanCapM: number | null };

function detectCompensation(args: {
  t: number[];
  phase: Phase;
  primary: number[];
  omega: number[];
  omegaThreshold: number;
  fs: number;
  totalM: number;
  phoneLimitM: number | null;
}) {
  const { t, phase, primary, omega, omegaThreshold, fs, totalM, phoneLimitM } = args;
  if (!(totalM > 0)) return null;

  const minOmegaThreshold = 0.18;
  const minOnsetS = 0.2;
  const compensationSustainS = 0.1;
  const minPostCompensationGainM = 0.003;
  const minPrimaryFractionForComp = 0.015;

  const geomLimitTriggerFactor = 1.03;
  const geomLimitCrossFactor = 0.98;
  const abruptVelocityFloorMS = 0.45;

  const firstIndex = Math.max(phase.startIndex, 0);
  const lastIndex = Math.min(phase.peakIndex, phase.endIndex, primary.length - 1, omega.length - 1, t.length - 1);
  if (lastIndex <= firstIndex) return null;

  const startTime = phase.tStart + minOnsetS;
  const sustainFrames = Math.max(2, Math.floor(compensationSustainS * fs));
  const candidates: CompensationDetection[] = [];

  // 1) Gatilho por gyro (antes do pico)
  let streak = 0;
  let candidateStart: number | null = null;
  for (let i = firstIndex; i <= lastIndex; i++) {
    if (t[i] < startTime) continue;
    const enoughExcursion = primary[i] >= totalM * minPrimaryFractionForComp || primary[i] >= 0.002;
    const active = omega[i] > omegaThreshold && enoughExcursion;

    if (active) {
      if (streak === 0) candidateStart = i;
      streak += 1;
      if (streak >= sustainFrames && candidateStart != null) {
        const preM = Math.max(0, Math.max(...primary.slice(firstIndex, candidateStart + 1)));
        const gain = Math.max(0, totalM - preM);
        if (gain >= minPostCompensationGainM) {
          candidates.push({ index: candidateStart, reason: "gyro", cleanCapM: null });
        }
        break;
      }
    } else {
      streak = 0;
      candidateStart = null;
    }
  }

  // 2) Gatilho geométrico
  if (phoneLimitM != null && phoneLimitM > 0.001 && totalM >= phoneLimitM * geomLimitTriggerFactor) {
    const crossM = phoneLimitM * geomLimitCrossFactor;
    for (let i = firstIndex; i <= lastIndex; i++) {
      if (t[i] < startTime) continue;
      if (primary[i] >= crossM) {
        candidates.push({ index: i, reason: "geometrica", cleanCapM: phoneLimitM });
        break;
      }
    }
  }

  // 3) Gatilho abrupto
  if (lastIndex - firstIndex >= 3) {
    const velocityThreshold = Math.max(abruptVelocityFloorMS, (phoneLimitM ?? 0) * 2.0);
    for (let i = Math.max(firstIndex + 1, 1); i <= lastIndex; i++) {
      if (t[i] < startTime) continue;
      const dt = Math.max(t[i] - t[i - 1], 1 / Math.max(fs, 1));
      const v = (primary[i] - primary[i - 1]) / dt;
      const enoughGain = Math.max(0, totalM - Math.max(primary[i], 0)) >= minPostCompensationGainM;
      if (v > velocityThreshold && omega[i] > Math.max(omegaThreshold, minOmegaThreshold) && enoughGain) {
        candidates.push({ index: i, reason: "abrupta", cleanCapM: null });
        break;
      }
    }
  }

  candidates.sort((a, b) => a.index - b.index);
  return candidates[0] ?? null;
}

export function analyzeLosFromSamples(
  result: NativeImuStopResult,
  participant?: Participant | null,
  samplingHzFallback = 60
): LosAnalysis | null {
  const rows = result?.samples ?? [];
  if (!rows || rows.length < 30) return null;

  const { heightCm, phoneHeightCm, baseAPCm, baseMLCm } = readLosParticipantParams(participant);

  const tSecRaw = rows.map((r) => Number(r[IMU22.ROW_T_MS] ?? 0) / 1000);
  const t0 = tSecRaw[0] ?? 0;
  const t = tSecRaw.map((x) => x - t0);

  const fs = resolveFsFromT(t, result?.stats?.hzMean ?? samplingHzFallback);
  const dtMeanSec = fs > 0 ? 1 / fs : 1 / samplingHzFallback;
  const baselineS = 3.0;
  const baselineCount = clamp(Math.floor(baselineS * fs), 10, rows.length);

  const gravX = rows.map((r) => Number(r[IMU22.GRAV_X] ?? 0));
  const gravY = rows.map((r) => Number(r[IMU22.GRAV_Y] ?? 0));
  const gravZ = rows.map((r) => Number(r[IMU22.GRAV_Z] ?? 0));

  // Mesma convenção do LoSCollector: apAngle/ mlAngle a partir do vetor gravidade
  const apAngle = gravZ.map((gz, i) => Math.atan2(-gz, -(gravY[i] ?? 0)));
  const mlAngle = gravX.map((gx, i) => Math.atan2(gx, -(gravY[i] ?? 0)));

  const apBase = mean(apAngle.slice(0, baselineCount));
  const mlBase = mean(mlAngle.slice(0, baselineCount));

  const hComFraction = 0.55;
  const defaultPhoneFraction = 0.77;

  const hComM = heightCm != null ? Math.max(0.3, (heightCm / 100) * hComFraction) : Math.max(0.3, 1.65 * hComFraction);
  const hPhoneM =
    phoneHeightCm != null && phoneHeightCm > 0
      ? Math.max(0.3, phoneHeightCm / 100)
      : heightCm != null
        ? Math.max(0.3, (heightCm / 100) * defaultPhoneFraction)
        : Math.max(0.3, 1.65 * defaultPhoneFraction);

  let phoneAPM = apAngle.map((a) => hPhoneM * Math.tan(a - apBase));
  let phoneMLM = mlAngle.map((a) => hPhoneM * Math.tan(a - mlBase));
  let comAPM = apAngle.map((a) => hComM * Math.tan(a - apBase));
  let comMLM = mlAngle.map((a) => hComM * Math.tan(a - mlBase));

  phoneAPM = lowPassZeroPhase(phoneAPM, fs, 2.0);
  phoneMLM = lowPassZeroPhase(phoneMLM, fs, 2.0);
  comAPM = lowPassZeroPhase(comAPM, fs, 2.0);
  comMLM = lowPassZeroPhase(comMLM, fs, 2.0);

  const apDriftPhone = mean(phoneAPM.slice(0, baselineCount));
  const mlDriftPhone = mean(phoneMLM.slice(0, baselineCount));
  const apDriftCom = mean(comAPM.slice(0, baselineCount));
  const mlDriftCom = mean(comMLM.slice(0, baselineCount));

  phoneAPM = phoneAPM.map((v) => v - apDriftPhone);
  phoneMLM = phoneMLM.map((v) => v - mlDriftPhone);
  comAPM = comAPM.map((v) => v - apDriftCom);
  comMLM = comMLM.map((v) => v - mlDriftCom);

  const radialPhoneM = phoneAPM.map((ap, i) => Math.sqrt(ap * ap + (phoneMLM[i] ?? 0) * (phoneMLM[i] ?? 0)));
  const radialComM = comAPM.map((ap, i) => Math.sqrt(ap * ap + (comMLM[i] ?? 0) * (comMLM[i] ?? 0)));

  const vAP = lowPassZeroPhase(computeVelocity(phoneAPM, fs), fs, 1.5);
  const vML = lowPassZeroPhase(computeVelocity(phoneMLM, fs), fs, 1.5);
  void vAP;
  void vML;

  const gx = rows.map((r) => Number(r[IMU22.GX] ?? 0));
  const gy = rows.map((r) => Number(r[IMU22.GY] ?? 0));
  const gz = rows.map((r) => Number(r[IMU22.GZ] ?? 0));
  const omegaRaw = gx.map((x, i) => Math.sqrt(x * x + (gy[i] ?? 0) * (gy[i] ?? 0) + (gz[i] ?? 0) * (gz[i] ?? 0)));
  const omega = lowPassZeroPhase(omegaRaw, fs, 5.0);

  const omegaBase = omega.slice(0, baselineCount);
  const omegaThreshold = Math.max(
    Math.max(mean(omegaBase) + 2.2 * std(omegaBase), median(omegaBase) + 3.2 * mad(omegaBase, median(omegaBase))),
    0.18
  );

  const radialBase = radialPhoneM.slice(0, baselineCount);
  const radialCenter = median(radialBase);
  const radialScale = Math.max(mad(radialBase, radialCenter), 0.001);
  const radialStartThresholdM = Math.max(0.01, radialCenter + 6.0 * radialScale);
  const radialReturnThresholdM = Math.max(0.007, radialCenter + 3.0 * radialScale);

  // Começa a segmentação depois do baseline.
  const fromIndex = Math.max(baselineCount, 0);

  const limits = geometricLimitsCM({ baseAPCm, baseMLCm, hComM, hPhoneM });
  const { phases, warnings: segWarnings } = segmentDirectionsByPrimaryPeaks({
    t,
    apM: phoneAPM,
    mlM: phoneMLM,
    radialM: radialPhoneM,
    startThresholdM: radialStartThresholdM,
    returnThresholdM: radialReturnThresholdM,
    limitsCM: limits,
    fromIndex,
    fs,
  });

  const warnings: string[] = [...segWarnings];
  const order: LoSDirection[] = ["F", "R", "B", "L"];
  for (const dir of order) {
    if (!phases.some((p) => p.direction === dir)) warnings.push(`${dir} não detectada`);
  }

  const minPostCompensationGainM = 0.003;
  const radialMinPeakM = 0.015;

  const directionResults: LosDirectionResult[] = phases.map((phase) => {
    const phonePrimary = primarySignal(phase.direction, phoneAPM, phoneMLM);
    const comPrimary = primarySignal(phase.direction, comAPM, comMLM);

    const peakIndex = clamp(phase.peakIndex, phase.startIndex, phonePrimary.length - 1);
    const totalPhoneM = Math.max(0, phonePrimary[peakIndex] ?? 0);
    const totalComM = Math.max(0, comPrimary[peakIndex] ?? 0);
    const radialPhonePeakM = Math.max(0, radialPhoneM[peakIndex] ?? 0);
    const axisProjectionM = totalPhoneM;
    const diagonalRatio = radialPhonePeakM > 0 ? axisProjectionM / radialPhonePeakM : 1;

    let omegaPeak = 0;
    for (let i = phase.startIndex; i <= phase.endIndex && i < omega.length; i++) omegaPeak = Math.max(omegaPeak, omega[i] ?? 0);

    const limitPair = limits?.[phase.direction] ?? null;
    const phoneLimitCM = limitPair ? Math.max(limitPair.phone, 1e-4) : null;
    const comLimitCM = limitPair ? Math.max(limitPair.com, 1e-4) : null;
    const phoneLimitM = phoneLimitCM != null ? phoneLimitCM / 100 : null;

    const compensation = detectCompensation({
      t,
      phase,
      primary: phonePrimary,
      omega,
      omegaThreshold,
      fs,
      totalM: totalPhoneM,
      phoneLimitM,
    });

    let preM = totalPhoneM;
    let deltaM = 0;
    let compensated = false;
    let onsetSec: number | null = null;

    if (compensation) {
      const onsetIndex = compensation.index;
      const preRawM = Math.max(0, Math.max(...phonePrimary.slice(phase.startIndex, onsetIndex + 1)));
      preM = compensation.cleanCapM != null ? Math.min(preRawM, compensation.cleanCapM) : preRawM;
      deltaM = Math.max(0, totalPhoneM - preM);
      compensated = deltaM >= minPostCompensationGainM;
      onsetSec = compensated ? (t[onsetIndex] ?? null) : null;
    }

    const qualityFlags: string[] = [];
    if (phase.quality !== "OK") qualityFlags.push(phase.quality);
    if (totalPhoneM < radialMinPeakM) qualityFlags.push("SINAL_FRACO");
    if (phoneLimitCM != null) {
      const pct = (totalPhoneM * 100) / phoneLimitCM * 100;
      if (pct > 120) qualityFlags.push("ACIMA_LIMITE");
      else if (pct > 100) qualityFlags.push("LIMITE_GEOMETRICO");
    }

    const warningParts = [...phase.warnings];
    if (compensated && compensation) warningParts.push(`compensacao_${compensation.reason}`);

    const quality = qualityFlags.length ? Array.from(new Set(qualityFlags)).sort().join("+") : "OK";
    const warning = warningParts.join(" | ");

    return {
      direction: phase.direction,
      directionName: directionName(phase.direction),
      excursionCM: totalPhoneM * 100,
      preCompensationCM: preM * 100,
      totalCM: totalPhoneM * 100,
      deltaPostCompensationCM: deltaM * 100,
      compensated,
      tOnsetCompensationSec: onsetSec,
      limitCM: phoneLimitCM,
      limitPercent: phoneLimitCM != null ? (totalPhoneM * 100) / phoneLimitCM * 100 : null,
      comExcursionCM: totalComM * 100,
      comLimitCM,
      comLimitPercent: comLimitCM != null ? (totalComM * 100) / comLimitCM * 100 : null,
      phaseDurationSec: Math.max(0, phase.tEnd - phase.tStart),
      timeToPeakSec: Math.max(0, phase.tPeak - phase.tStart),
      tStartSec: phase.tStart,
      tPeakSec: phase.tPeak,
      tEndSec: phase.tEnd,
      omegaPeak,
      nSubmovements: phase.nSubmovements,
      hadPause: phase.hadPause,
      quality,
      warning,
      peakIndex,
      apAtPeakCM: (phoneAPM[peakIndex] ?? 0) * 100,
      mlAtPeakCM: (phoneMLM[peakIndex] ?? 0) * 100,
    };
  });

  // Avisos de qualidade globais (antropometria faltando)
  if (heightCm == null) warnings.push("Estatura não cadastrada (normalização pode ficar incompleta)");
  if (baseAPCm == null || baseMLCm == null) warnings.push("Base AP/ML não cadastrada (limites geométricos indisponíveis)");

  const nSeries = t.length;
  const losPhase: string[] = new Array(nSeries).fill("");
  const isPostCompensationRegion = new Array<boolean>(nSeries).fill(false);

  for (let pi = 0; pi < phases.length; pi++) {
    const phase = phases[pi];
    const dr = directionResults[pi];
    if (!phase || !dr) continue;

    let onsetIdx: number | null = null;
    if (dr.compensated && dr.tOnsetCompensationSec != null) {
      for (let i = phase.startIndex; i <= phase.endIndex && i < nSeries; i++) {
        if ((t[i] ?? 0) >= dr.tOnsetCompensationSec) {
          onsetIdx = i;
          break;
        }
      }
    }

    for (let i = phase.startIndex; i <= phase.endIndex && i < nSeries; i++) {
      losPhase[i] = phase.direction;
      if (onsetIdx != null && i >= onsetIdx) {
        isPostCompensationRegion[i] = true;
      }
    }
  }

  const phoneHeightCM = hPhoneM * 100;

  return {
    samplingHz: fs,
    dtMeanSec,
    radialStartThresholdCM: radialStartThresholdM * 100,
    radialReturnThresholdCM: radialReturnThresholdM * 100,
    omegaThreshold,
    directionResults,
    warnings: Array.from(new Set(warnings)).sort(),
    analysisVersion: "LoSAnalyzer_ts_app60_v1",
    movementStartTimeSec: fromIndex < nSeries ? (t[fromIndex] ?? null) : null,
    heightCM: heightCm,
    phoneHeightCM,
    processed: {
      tSec: t,
      phoneAPCM: phoneAPM.map((v) => v * 100),
      phoneMLCM: phoneMLM.map((v) => v * 100),
      radialPhoneCM: radialPhoneM.map((v) => v * 100),
      omega,
      losPhase,
      isPostCompensationRegion,
    },
  };
}

export function losDirectionSortKey(d: LoSDirection) {
  return d === "F" ? 0 : d === "R" ? 1 : d === "B" ? 2 : 3;
}

export function pickLosRow(result: NativeImuSampleRow, idx: number) {
  return Number(result[idx] ?? 0);
}

