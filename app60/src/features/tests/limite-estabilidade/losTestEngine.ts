/**
 * Port direto da máquina de estados de `LoSCollector/Services/TestEngine.swift`
 * (fases, janelas, limiares e tempos). Os sensores são alimentados via `LosMotionSample`.
 */
import type { LosMotionSample } from "./losExpoMotion";
import type { NativeImuSampleRow, NativeImuStats, NativeImuStopResult } from "../../../services/sensors/nativeImu";
import { IMU22 } from "../nativeImuSampleLayout";

export type LosCollectorPhase =
  | "idle"
  | "waitingStillness"
  | "ready"
  | "countdown"
  | "recording"
  | "finished";

export type LosFinishReason = "stability" | "timeout" | "manual";

type RecordedLosSample = LosMotionSample & {
  rollRel: number;
  pitchRel: number;
  yawRel: number;
  phaseLabel: string;
};

const startWindowCount = 36;
const finishWindowCount = 90;
const minSamplesToEvaluate = 18;

/** Mais permissivo que o Swift original: permite micro-ajustes antes da contagem. */
const requiredStartStillnessMs = 0.45 * 1000;
const requiredFinishStillnessMs = 2.0 * 1000;// afrouxado: encerra com menos tempo parado
const minimumTestDurationMs = 22.0 * 1000;
const maximumTestDurationMs = 180.0 * 1000;

const baselineWindowMax = 180;

function mean(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.map((v) => (v - m) * (v - m)).reduce((a, b) => a + b, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function trimEnd<T>(arr: T[], maxCount: number) {
  if (arr.length > maxCount) {
    arr.splice(0, arr.length - maxCount);
  }
}

function angleDelta(current: number, reference: number) {
  let delta = current - reference;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;
  return delta;
}

function isStillForStart(window: LosMotionSample[]) {
  if (window.length < minSamplesToEvaluate) return false;
  const gyroMean = mean(window.map((s) => s.gyroNorm));
  const userAccMean = mean(window.map((s) => s.userAccNorm));
  const pitchStd = standardDeviation(window.map((s) => s.pitch));
  const rollStd = standardDeviation(window.map((s) => s.roll));

  // Swift: 0.25 / 0.08 / 0.06 / 0.06 — afrouxado para aceitar “quase parado”.
  return gyroMean < 0.55 && userAccMean < 0.16 && pitchStd < 0.1 && rollStd < 0.1;
}

function movedAwayFromBaseline(sample: RecordedLosSample) {
  // Só considera “saiu do baseline” com desvio claro (evita disparar com tremor mínimo).
  return (
    Math.abs(sample.pitchRel) > 0.1 ||
    Math.abs(sample.rollRel) > 0.1 ||
    sample.gyroNorm > 0.38 ||
    sample.userAccNorm > 0.12
  );
}

function isNearBaselineAndStill(window: RecordedLosSample[]) {
  if (window.length < minSamplesToEvaluate) return false;
  const pitchMeanAbs = mean(window.map((s) => Math.abs(s.pitchRel)));
  const rollMeanAbs = mean(window.map((s) => Math.abs(s.rollRel)));
  const gyroMean = mean(window.map((s) => s.gyroNorm));
  const userAccMean = mean(window.map((s) => s.userAccNorm));
  const pitchStd = standardDeviation(window.map((s) => s.pitchRel));
  const rollStd = standardDeviation(window.map((s) => s.rollRel));

  return (
     pitchMeanAbs < 0.45 &&
    rollMeanAbs < 0.45 &&
    gyroMean < 0.55 &&
    userAccMean < 0.18 &&
    pitchStd < 0.14 &&
    rollStd < 0.14
  );
}

function meanOrientation(window: LosMotionSample[]) {
  return {
    roll: mean(window.map((s) => s.roll)),
    pitch: mean(window.map((s) => s.pitch)),
    yaw: mean(window.map((s) => s.yaw)),
  };
}

function buildRows(recorded: RecordedLosSample[]): NativeImuSampleRow[] {
  return recorded.map((s) => {
    const rowMs = Math.round(s.elapsedSec * 1000);
    // Ordem IMU22; LoS sintético: todos os *_t_ms = rowMs (sem relógios separados).
    return [
      rowMs,
      rowMs,
      rowMs,
      s.ax,
      s.ay,
      s.az,
      rowMs,
      s.gx,
      s.gy,
      s.gz,
      rowMs,
      s.userAx,
      s.userAy,
      s.userAz,
      rowMs,
      s.gravX,
      s.gravY,
      s.gravZ,
      rowMs,
      s.roll,
      s.pitch,
      s.yaw,
    ] as NativeImuSampleRow;
  });
}

function buildStats(samples: NativeImuSampleRow[], targetHz: number): NativeImuStats {
  const n = samples.length;
  if (n < 2) {
    return {
      n,
      hzMean: targetHz,
      dtMeanMs: 1000 / targetHz,
      dtMinMs: 1000 / targetHz,
      dtMaxMs: 1000 / targetHz,
      pctIn58to62: 100,
      droppedEstimated: 0,
      targetHz,
      targetDtMs: 1000 / targetHz,
      dtCount: Math.max(0, n - 1),
    };
  }

  const dts: number[] = [];
  for (let i = 1; i < n; i++) {
    dts.push(samples[i][IMU22.ROW_T_MS] - samples[i - 1][IMU22.ROW_T_MS]);
  }
  const dtMeanMs = mean(dts);
  const dtMinMs = Math.min(...dts);
  const dtMaxMs = Math.max(...dts);
  const hzMean = dtMeanMs > 0 ? 1000 / dtMeanMs : targetHz;
  const dtLo = 1000 / 62;
  const dtHi = 1000 / 58;
  const in58 = dts.filter((dt) => dt >= dtLo && dt <= dtHi).length;
  const pctIn58to62 = dts.length ? (in58 / dts.length) * 100 : 0;

  return {
    n,
    hzMean,
    dtMeanMs,
    dtMinMs,
    dtMaxMs,
    pctIn58to62,
    droppedEstimated: 0,
    targetHz,
    targetDtMs: 1000 / targetHz,
    dtCount: dts.length,
  };
}

export type LosSpeakKey =
  | "placePhone"
  | "readyToStart"
  | "count3"
  | "count2"
  | "count1"
  | "go";

export type LosTestEngineConfig = {
  sampleHz: number;
  speak: (key: LosSpeakKey) => Promise<void>;
  /** Atualização de UI (fase, contagem, chave de status). */
  onPatch: (patch: {
    phase: LosCollectorPhase;
    countdownText: string;
    statusKey: string | null;
  }) => void;
  onFinished: (result: NativeImuStopResult, reason: LosFinishReason) => void;
};

export class LosTestEngine {
  phase: LosCollectorPhase = "idle";

  private baselineWindow: LosMotionSample[] = [];
  private recordedSamples: RecordedLosSample[] = [];
  private baselineOrientation: { roll: number; pitch: number; yaw: number } | null = null;

  private hasLeftBaseline = false;
  private testStartedAtMs: number | null = null;
  private goTimestampMs: number | null = null;

  private startStillnessBeganAtMs: number | null = null;
  private finishStillnessBeganAtMs: number | null = null;

  private didTimeout = false;

  private countdownTimeouts: ReturnType<typeof globalThis.setTimeout>[] = [];
  private readyChainStarted = false;
  private aborted = false;

  constructor(private readonly cfg: LosTestEngineConfig) {}

  resetForNewSession() {
    this.cancelCountdownTimers();
    this.aborted = false;
    this.readyChainStarted = false;
    this.baselineWindow = [];
    this.recordedSamples = [];
    this.baselineOrientation = null;
    this.hasLeftBaseline = false;
    this.testStartedAtMs = null;
    this.goTimestampMs = null;
    this.startStillnessBeganAtMs = null;
    this.finishStillnessBeganAtMs = null;
    this.didTimeout = false;
    this.phase = "waitingStillness";
    this.emit({ phase: this.phase, countdownText: "", statusKey: "waitStillness" });
  }

  abort() {
    this.aborted = true;
    this.cancelCountdownTimers();
    this.readyChainStarted = false;
    this.phase = "idle";
    this.emit({ phase: "idle", countdownText: "", statusKey: null });
  }

  /** Chamado após `motion.start` e `resetForNewSession`. */
  speakPlacementHint() {
    void this.cfg.speak("placePhone");
  }

  handle(sample: LosMotionSample) {
    if (this.aborted) return;

    switch (this.phase) {
      case "idle":
      case "finished":
        return;

      case "waitingStillness": {
        this.baselineWindow.push(sample);
        trimEnd(this.baselineWindow, baselineWindowMax);

        const stillWindow = this.baselineWindow.slice(-startWindowCount);
        if (stillWindow.length < minSamplesToEvaluate) return;

        if (isStillForStart(stillWindow)) {
          if (this.startStillnessBeganAtMs == null) {
            this.startStillnessBeganAtMs = sample.timestampMs;
            this.emit({ phase: this.phase, countdownText: "", statusKey: "stableHold" });
          }

          if (
            this.startStillnessBeganAtMs != null &&
            sample.timestampMs - this.startStillnessBeganAtMs >= requiredStartStillnessMs
          ) {
            this.baselineOrientation = meanOrientation(stillWindow);
            this.phase = "ready";
            this.emit({ phase: this.phase, countdownText: "", statusKey: "readyOrder" });

            if (!this.readyChainStarted) {
              this.readyChainStarted = true;
              queueMicrotask(() => this.runReadyThenCountdown());
            }
          }
        } else {
          this.startStillnessBeganAtMs = null;
          this.emit({ phase: this.phase, countdownText: "", statusKey: "waitStable" });
        }
        return;
      }

      case "ready":
        return;

      case "countdown":
        this.appendRecordedSample(sample, "countdown");
        return;

      case "recording": {
        this.appendRecordedSample(sample, "recording");
        const last = this.recordedSamples[this.recordedSamples.length - 1];
        if (!last) return;

        if (!this.hasLeftBaseline) {
          if (movedAwayFromBaseline(last)) {
            this.hasLeftBaseline = true;
            this.testStartedAtMs = last.timestampMs;
            this.emit({ phase: this.phase, countdownText: "", statusKey: "inProgress" });
          }
          return;
        }

        if (this.testStartedAtMs == null) return;
        const elapsedSinceMoveStart = sample.timestampMs - this.testStartedAtMs;
        if (elapsedSinceMoveStart < minimumTestDurationMs) return;

        const finishWindow = this.recordedSamples.slice(-finishWindowCount);
        if (finishWindow.length < minSamplesToEvaluate) return;

        if (isNearBaselineAndStill(finishWindow)) {
          if (this.finishStillnessBeganAtMs == null) {
            this.finishStillnessBeganAtMs = last.timestampMs;
            this.emit({ phase: this.phase, countdownText: "", statusKey: "returnBaseline" });
          }

          if (
            this.finishStillnessBeganAtMs != null &&
            last.timestampMs - this.finishStillnessBeganAtMs >= requiredFinishStillnessMs
          ) {
            this.finishTest(false, "stability");
            return;
          }
        } else {
          this.finishStillnessBeganAtMs = null;
        }

        if (
          this.goTimestampMs != null &&
          sample.timestampMs - this.goTimestampMs >= maximumTestDurationMs
        ) {
          this.finishTest(true, "timeout");
        }
        return;
      }

      default:
        return;
    }
  }

  /** Equivalente a `finishAndAnalyzeNow()` no Swift. */
  finishManual(): boolean {
    if (this.phase !== "recording" && this.phase !== "countdown") {
      return false;
    }
    if (this.recordedSamples.length < minSamplesToEvaluate) {
      return false;
    }

    if (this.phase === "countdown") {
      this.phase = "recording";
      this.goTimestampMs = Date.now();
    }

    this.hasLeftBaseline = true;
    if (this.testStartedAtMs == null) {
      this.testStartedAtMs = this.recordedSamples[0]?.timestampMs ?? Date.now();
    }

    this.finishTest(false, "manual");
    return true;
  }

  private async runReadyThenCountdown() {
    try {
      if (this.aborted || this.phase !== "ready") return;
      await this.cfg.speak("readyToStart");
      if (this.aborted || this.phase !== "ready") return;
      this.beginCountdown();
    } catch {
      if (this.aborted) return;
      this.phase = "waitingStillness";
      this.readyChainStarted = false;
      this.startStillnessBeganAtMs = null;
      this.baselineWindow = [];
      this.emit({ phase: this.phase, countdownText: "", statusKey: "waitStable" });
    }
  }

  private beginCountdown() {
    this.cancelCountdownTimers();
    this.phase = "countdown";
    this.recordedSamples = [];
    this.hasLeftBaseline = false;
    this.testStartedAtMs = null;
    this.goTimestampMs = null;
    this.finishStillnessBeganAtMs = null;
    this.didTimeout = false;

    this.emit({ phase: this.phase, countdownText: "3", statusKey: "countdown" });
    void this.cfg.speak("count3");

    this.scheduleCountdownStep(1000, "2", "count2");
    this.scheduleCountdownStep(2000, "1", "count1");

    const goId = globalThis.setTimeout(() => {
      if (this.aborted || this.phase !== "countdown") return;
      this.countdownTextAtGo();
    }, 3000);
    this.countdownTimeouts.push(goId);

    const clearId = globalThis.setTimeout(() => {
      if (this.aborted) return;
      if (this.phase === "countdown" || this.phase === "recording") {
        this.emit({ phase: this.phase, countdownText: "", statusKey: this.phase === "recording" ? "inProgress" : null });
      }
    }, 4000);
    this.countdownTimeouts.push(clearId);
  }

  private countdownTextAtGo() {
    this.phase = "recording";
    this.goTimestampMs = Date.now();
    this.emit({ phase: this.phase, countdownText: "VAI", statusKey: "afterGo" });
    void this.cfg.speak("go");
  }

  private scheduleCountdownStep(delayMs: number, text: string, speakKey: LosSpeakKey) {
    const id = globalThis.setTimeout(() => {
      if (this.aborted || this.phase !== "countdown") return;
      this.emit({ phase: "countdown", countdownText: text, statusKey: "countdown" });
      void this.cfg.speak(speakKey);
    }, delayMs);
    this.countdownTimeouts.push(id);
  }

  private cancelCountdownTimers() {
    for (const id of this.countdownTimeouts) {
      globalThis.clearTimeout(id);
    }
    this.countdownTimeouts = [];
  }

  private appendRecordedSample(sample: LosMotionSample, phaseLabel: "countdown" | "recording") {
    if (!this.baselineOrientation) return;

    const rollRel = angleDelta(sample.roll, this.baselineOrientation.roll);
    const pitchRel = angleDelta(sample.pitch, this.baselineOrientation.pitch);
    const yawRel = angleDelta(sample.yaw, this.baselineOrientation.yaw);

    this.recordedSamples.push({
      ...sample,
      rollRel,
      pitchRel,
      yawRel,
      phaseLabel,
    });
  }

  private finishTest(timeoutExceeded: boolean, finishReason: LosFinishReason) {
    if (this.phase !== "recording") return;

    this.cancelCountdownTimers();
    this.phase = "finished";
    this.didTimeout = timeoutExceeded;

    this.emit({ phase: "finished", countdownText: "", statusKey: timeoutExceeded ? "processingTimeout" : "processing" });

    const rows = buildRows(this.recordedSamples);
    const stats = buildStats(rows, this.cfg.sampleHz);
    const result: NativeImuStopResult = {
      samples: rows,
      stats,
      tug: {
        detected: true,
        stopReason: finishReason,
      },
    };

    this.cfg.onFinished(result, finishReason);
  }

  private emit(patch: { phase: LosCollectorPhase; countdownText: string; statusKey: string | null }) {
    this.cfg.onPatch(patch);
  }
}
