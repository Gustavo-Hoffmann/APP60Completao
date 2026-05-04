import type { NativeImuStopResult } from "../../../services/sensors/nativeImu";
import { IMU22 } from "../nativeImuSampleLayout";

/** 60 Hz fixo como na marcha; passa-baixa ~1 Hz, picos/vales, ciclos (protocolo UTT). */
const DT = 1 / 60;
const FC_HZ = 1.0;
/** Janela da média móvel (s) para estimar baseline lenta; sinal = ay − baseline → perto de zero ao longo do tempo. */
const MA_BASELINE_SEC = 2.2;
/** Corte inicial (s) para ignorar preparação — só quando a gravação é longa o bastante. */
const CROP_S = 1.3;
const MIN_DIST_SAMPLES = 15;
const PROM_FACTOR = 0.2;
/** Gravações curtas (ex.: teste interrompido): menos amostras e corte leve. */
const MIN_RAW_SAMPLES = 20;
/** ~0,37 s a 60 Hz — permite interrupção logo após o “começa”. */
const MIN_SAMPLES = 22;
const MIN_PLOT_SAMPLES = 14;

export type UttAnalysis = {
  time: number[];
  signal: number[];
  peakIndices: number[];
  cycles: number;
  meanCycleSec: number;
  meanRiseSec: number;
  meanFallSec: number;
  meanTransitionSec: number;
};

function mean(xs: number[]): number {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stdSample(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v = mean(xs.map((x) => (x - m) * (x - m)));
  return Math.sqrt(Math.max(v, 0));
}

/** Passa-baixa 1ª ordem, dois sentidos (aprox. filtfilt), fc em Hz. */
/** Média móvel centrada (janela ímpar); bordas usam vizinhos disponíveis. */
function movingAverageSymmetric(x: number[], windowOdd: number): number[] {
  const n = x.length;
  if (n === 0) return [];
  const w = Math.max(3, windowOdd % 2 === 0 ? windowOdd + 1 : windowOdd);
  const half = Math.floor(w / 2);
  const out = new Array(n);
  for (let i = 0; i < n; i += 1) {
    const j0 = Math.max(0, i - half);
    const j1 = Math.min(n - 1, i + half);
    let s = 0;
    for (let j = j0; j <= j1; j += 1) s += x[j];
    out[i] = s / (j1 - j0 + 1);
  }
  return out;
}

function lowpassFiltfilt(x: number[], dt: number, fc: number): number[] {
  const n = x.length;
  if (n === 0) return [];
  const RC = 1 / (2 * Math.PI * fc);
  const alpha = dt / (RC + dt);
  const y = new Array(n);
  y[0] = x[0];
  for (let i = 1; i < n; i += 1) {
    y[i] = y[i - 1] + alpha * (x[i] - y[i - 1]);
  }
  const z = new Array(n);
  z[n - 1] = y[n - 1];
  for (let i = n - 2; i >= 0; i -= 1) {
    z[i] = z[i + 1] + alpha * (y[i] - z[i + 1]);
  }
  return z;
}

function prominence1D(y: number[], i: number): number {
  const peak = y[i];
  let leftMin = peak;
  for (let j = i - 1; j >= 0; j -= 1) {
    if (y[j] > peak) break;
    leftMin = Math.min(leftMin, y[j]);
  }
  let rightMin = peak;
  for (let j = i + 1; j < y.length; j += 1) {
    if (y[j] > peak) break;
    rightMin = Math.min(rightMin, y[j]);
  }
  return peak - Math.max(leftMin, rightMin);
}

function findPeaksProminence(
  y: number[],
  opts: { minProminence: number; minDistance: number; height: number }
): number[] {
  const locals: number[] = [];
  for (let i = 1; i < y.length - 1; i += 1) {
    if (y[i] < opts.height) continue;
    if (!(y[i] > y[i - 1] && y[i] >= y[i + 1])) continue;
    if (prominence1D(y, i) < opts.minProminence) continue;
    locals.push(i);
  }
  locals.sort((a, b) => y[b] - y[a]);
  const chosen: number[] = [];
  for (const i of locals) {
    if (chosen.some((j) => Math.abs(i - j) < opts.minDistance)) continue;
    chosen.push(i);
  }
  chosen.sort((a, b) => a - b);
  return chosen;
}

function signedZeroCrossTimes(t: number[], y: number[]): { up: number[]; down: number[] } {
  const s = y.map((v) => {
    if (v > 0) return 1;
    if (v < 0) return -1;
    return 1;
  });
  const up: number[] = [];
  const down: number[] = [];
  for (let k = 0; k < s.length - 1; k += 1) {
    if (s[k] === s[k + 1]) continue;
    const y0 = y[k];
    const y1 = y[k + 1];
    const t0 = t[k];
    const t1 = t[k + 1];
    const dn = y1 - y0;
    if (Math.abs(dn) < 1e-15) continue;
    const tz = t0 - (y0 * (t1 - t0)) / dn;
    if (y0 < 0 && y1 > 0) up.push(tz);
    else if (y0 > 0 && y1 < 0) down.push(tz);
  }
  up.sort((a, b) => a - b);
  down.sort((a, b) => a - b);
  return { up, down };
}

function buildCycles(
  tPlot: number[],
  tPk: number[],
  tVl: number[],
  tUp: number[],
  tDown: number[]
): { tStart: number[]; tMid: number[]; tEnd: number[] } {
  const tPkS = [...tPk].sort((a, b) => a - b);
  const tVlS = [...tVl].sort((a, b) => a - b);
  const tUpS = [...tUp].sort((a, b) => a - b);
  const tDownS = [...tDown].sort((a, b) => a - b);

  const tStart: number[] = [];
  const tMid: number[] = [];
  const tEnd: number[] = [];
  let prevEnd = -Infinity;

  for (const tp of tPkS) {
    let start: number;
    if (tUpS.length > 0) {
      const lb = lowerBound(tUpS, tp);
      const i0 = lb - 1;
      start = i0 >= 0 ? tUpS[i0] : tp - 0.4;
    } else {
      start = tp - 0.4;
    }
    if (start < prevEnd) continue;

    if (!tDownS.length) continue;
    const i1 = upperBound(tDownS, tp);
    if (i1 >= tDownS.length) continue;
    const mid = tDownS[i1];

    if (!tVlS.length) continue;
    const i2 = upperBound(tVlS, mid);
    if (i2 >= tVlS.length) continue;
    const end = tVlS[i2];

    if (!(start < tp && tp < mid && mid < end)) continue;

    tStart.push(start);
    tMid.push(mid);
    tEnd.push(end);
    prevEnd = end;
  }

  return { tStart, tMid, tEnd };
}

/** Primeiro índice i com arr[i] >= x (numpy searchsorted left). */
function lowerBound(arr: number[], x: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (arr[mid] < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Primeiro índice i com arr[i] > x (numpy searchsorted right). */
function upperBound(arr: number[], x: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (arr[mid] <= x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function meanTransitionGaps(tGlobal0: number, tGlobal1: number, tStart: number[], tEnd: number[]): number {
  const gaps: number[] = [];
  if (tStart.length === 0) return 0;
  if (tStart[0] > tGlobal0) gaps.push(tStart[0] - tGlobal0);
  for (let i = 0; i < tStart.length - 1; i += 1) {
    const g = tStart[i + 1] - tEnd[i];
    if (g > 0) gaps.push(g);
  }
  if (tGlobal1 > tEnd[tEnd.length - 1]) gaps.push(tGlobal1 - tEnd[tEnd.length - 1]);
  if (!gaps.length) return 0;
  return mean(gaps);
}

function ayGFromRow(row: unknown[]): number | null {
  if (!Array.isArray(row) || row.length < 22) return null;
  const ay = Number(row[IMU22.AY]);
  return Number.isFinite(ay) ? ay : null;
}

function pickCropSec(spanSec: number): number {
  if (!(spanSec > 0)) return 0;
  if (spanSec >= CROP_S + 2.0) return CROP_S;
  const light = Math.min(0.55, spanSec * 0.14);
  if (spanSec - light < 0.32) return 0;
  return light;
}

export function analyzeUttFromSamples(result: NativeImuStopResult): UttAnalysis | null {
  const rows = result?.samples ?? [];
  if (rows.length < MIN_RAW_SAMPLES) return null;

  const ayList: number[] = [];
  for (const rowAny of rows as unknown[]) {
    const row = Array.isArray(rowAny) ? (rowAny as unknown[]) : [];
    const ay = ayGFromRow(row);
    if (ay == null) continue;
    ayList.push(-ay);
  }
  if (ayList.length < MIN_RAW_SAMPLES) return null;

  const n = ayList.length;
  if (n < MIN_SAMPLES) return null;

  let maWin = Math.round(MA_BASELINE_SEC / DT);
  if (maWin % 2 === 0) maWin += 1;
  maWin = Math.min(Math.max(maWin, 31), Math.max(31, n - 2));

  const baseline = movingAverageSymmetric(ayList, maWin);
  const ayCentered = ayList.map((v, i) => v - baseline[i]);

  const tU = Array.from({ length: n }, (_, i) => i * DT);
  const ayF = lowpassFiltfilt(ayCentered, DT, FC_HZ);

  const spanSec = Math.max(0, (n - 1) * DT);
  const cropSec = pickCropSec(spanSec);
  const cropN = cropSec <= 0 ? 0 : Math.min(Math.max(0, n - 1), Math.round(cropSec / DT));
  const tPlot = tU.slice(cropN).map((t) => t - cropN * DT);
  const ayPlot = ayF.slice(cropN);
  if (tPlot.length < MIN_PLOT_SAMPLES) return null;

  const sigStd = stdSample(ayPlot);
  const prom = Math.max(sigStd * PROM_FACTOR, 1e-9);
  const peakMinDist = Math.max(4, Math.min(MIN_DIST_SAMPLES, Math.floor(ayPlot.length / 4)));
  const pkI = findPeaksProminence(ayPlot, {
    minProminence: prom,
    minDistance: peakMinDist,
    height: 0,
  });
  const vlI = findPeaksProminence(
    ayPlot.map((v) => -v),
    { minProminence: prom, minDistance: peakMinDist, height: 0 }
  );

  const tPk = pkI.map((i) => tPlot[i]);
  const tVl = vlI.map((i) => tPlot[i]);
  const { up: tUp, down: tDown } = signedZeroCrossTimes(tPlot, ayPlot);

  const { tStart, tMid, tEnd } = buildCycles(tPlot, tPk, tVl, tUp, tDown);
  const nCyc = tStart.length;
  if (nCyc === 0) {
    return {
      time: tPlot,
      signal: ayPlot,
      peakIndices: pkI,
      cycles: 0,
      meanCycleSec: 0,
      meanRiseSec: 0,
      meanFallSec: 0,
      meanTransitionSec: 0,
    };
  }

  const durCycle = tEnd.map((te, i) => te - tStart[i]);
  const durRise = tMid.map((tm, i) => tm - tStart[i]);
  const durFall = tEnd.map((te, i) => te - tMid[i]);
  const meanTr = meanTransitionGaps(tPlot[0], tPlot[tPlot.length - 1], tStart, tEnd);

  return {
    time: tPlot,
    signal: ayPlot,
    peakIndices: pkI,
    cycles: nCyc,
    meanCycleSec: mean(durCycle),
    meanRiseSec: mean(durRise),
    meanFallSec: mean(durFall),
    meanTransitionSec: meanTr,
  };
}
