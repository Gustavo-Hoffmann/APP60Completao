import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";

import { Screen, T } from "../../../components/Themed";
import { Accelerometer, DeviceMotion } from "expo-sensors";

import { ThemedButton } from "../../../components/ThemedButton";
import { TestCollectionAttemptActions } from "../components/TestCollectionAttemptActions";
import { TestCollectionHeader, TestCollectionHeroImage } from "../components/TestCollectionChrome";
import { TestCollectionRunProgress } from "../components/TestCollectionRunProgress";
import { saveImuResultToCache } from "../helpers/finalizeImuCapture";
import { TestRunLockOverlay } from "../components/TestRunLockOverlay";
import { useProtectedTestRun } from "../hooks/useProtectedTestRun";
import type { NativeImuStopResult } from "../../../services/sensors/nativeImu";
import type { Participant } from "../../../models/types";
import { Routes } from "../../../navigation/routes";
import { speakText, stopSpeech } from "../../../services/speech";
import { saveLosJsonToCache } from "../../../services/tests/uploadTestJson";

import { losMotionIsAvailable, startLosMotionStream } from "./losExpoMotion";
import { LosTestEngine, type LosCollectorPhase, type LosFinishReason, type LosSpeakKey } from "./losTestEngine";

const SAMPLE_HZ = 60;

type ParticipantWithLosParams = Participant & {
  heightCm?: number | null;
  estaturaCm?: number | null;
  height?: number | null;
  estatura?: number | null;
  altura?: number | null;
  phoneHeightCm?: number | null;
  alturaCelularCm?: number | null;
  baseAPCm?: number | null;
  baseMLCm?: number | null;
  baseApCm?: number | null;
  baseMlCm?: number | null;
};

function fmtElapsedMs(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  if (h > 0) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(
      2,
      "0"
    )}`;
  }

  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function sanitizeDecimalInput(value: string) {
  return value.replace(",", ".").replace(/[^0-9.]/g, "");
}

function parseHeightCm(value: string): number | null {
  const cleaned = sanitizeDecimalInput(value);
  if (!cleaned) return null;

  let n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n <= 3) n *= 100;
  if (n < 50 || n > 260) return null;
  return Math.round(n * 10) / 10;
}

function parsePhoneHeightCm(value: string): number | null {
  const cleaned = sanitizeDecimalInput(value);
  if (!cleaned) return null;

  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n < 40 || n > 220) return null;
  return Math.round(n * 10) / 10;
}

function estimatePhoneHeightCm(heightCm: number | null) {
  if (heightCm == null || !(heightCm > 0)) return null;
  const estimated = heightCm * 0.77;
  return Math.round(estimated * 10) / 10;
}

function parseBaseCm(value: string): number | null {
  const cleaned = sanitizeDecimalInput(value);
  if (!cleaned) return null;

  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n < 5 || n > 80) return null;
  return Math.round(n * 10) / 10;
}

function formatDecimalInput(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function readExistingHeightCm(participant?: Participant): number | null {
  if (!participant) return null;
  const p = participant as ParticipantWithLosParams;
  let candidate = p.heightCm ?? p.estaturaCm ?? p.height ?? p.estatura ?? p.altura;
  if (candidate == null) return null;
  let n = Number(candidate);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n <= 3) n *= 100;
  if (n < 50 || n > 260) return null;
  return Math.round(n * 10) / 10;
}

function readExistingPhoneHeightCm(participant?: Participant): number | null {
  if (!participant) return null;
  const p = participant as ParticipantWithLosParams;
  const candidate = p.phoneHeightCm ?? p.alturaCelularCm;
  if (candidate == null) return null;
  const n = Number(candidate);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n < 40 || n > 220) return null;
  return Math.round(n * 10) / 10;
}

function readExistingBaseAPCm(participant?: Participant): number | null {
  if (!participant) return null;
  const p = participant as ParticipantWithLosParams;
  const candidate = p.baseAPCm ?? p.baseApCm;
  if (candidate == null) return null;
  const n = Number(candidate);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n < 5 || n > 80) return null;
  return Math.round(n * 10) / 10;
}

function readExistingBaseMLCm(participant?: Participant): number | null {
  if (!participant) return null;
  const p = participant as ParticipantWithLosParams;
  const candidate = p.baseMLCm ?? p.baseMlCm;
  if (candidate == null) return null;
  const n = Number(candidate);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n < 5 || n > 80) return null;
  return Math.round(n * 10) / 10;
}

export default function LimiteEstabilidade() {
  const { t } = useTranslation(["tests", "errors"]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const participant = route.params?.participant as Participant | undefined;

  const [phase, setPhase] = useState<LosCollectorPhase>("idle");
  const [statusText, setStatusText] = useState(t("tests:common.ready"));
  const [countdownText, setCountdownText] = useState("");
  const [result, setResult] = useState<NativeImuStopResult | null>(null);
  const [jsonUri, setJsonUri] = useState<string | null>(null);
  const [jsonSessionNumber, setJsonSessionNumber] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const [heightInput, setHeightInput] = useState("");
  const [phoneHeightInput, setPhoneHeightInput] = useState("");
  const [baseApInput, setBaseApInput] = useState("");
  const [baseMlInput, setBaseMlInput] = useState("");
  const [losParamsModalVisible, setLosParamsModalVisible] = useState(false);
  const [losParamsConfirmed, setLosParamsConfirmed] = useState(false);

  const cancelledRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runStartRef = useRef<number | null>(null);
  const participantKeyRef = useRef<string>("");
  const engineRef = useRef<LosTestEngine | null>(null);
  const motionStopRef = useRef<(() => void) | null>(null);
  const sessionRunStartedRef = useRef(false);
  const startingRef = useRef(false);
  const stoppingRef = useRef(false);

  const parsedHeightCm = parseHeightCm(heightInput);
  const parsedPhoneHeightCm = parsePhoneHeightCm(phoneHeightInput);
  const parsedBaseApCm = parseBaseCm(baseApInput);
  const parsedBaseMlCm = parseBaseCm(baseMlInput);
  const estimatedPhoneHeightCm = estimatePhoneHeightCm(parsedHeightCm);
  const effectivePhoneHeightCm = parsedPhoneHeightCm ?? estimatedPhoneHeightCm;

  const participantForTest = useCallback((): ParticipantWithLosParams | undefined => {
    if (!participant) return undefined;

    return {
      ...participant,
      heightCm: parsedHeightCm,
      estaturaCm: parsedHeightCm,
      height: parsedHeightCm,
      estatura: parsedHeightCm,
      altura: parsedHeightCm,
      phoneHeightCm: effectivePhoneHeightCm,
      alturaCelularCm: effectivePhoneHeightCm,
      baseAPCm: parsedBaseApCm,
      baseApCm: parsedBaseApCm,
      baseMLCm: parsedBaseMlCm,
      baseMlCm: parsedBaseMlCm,
    };
  }, [participant, effectivePhoneHeightCm, parsedBaseApCm, parsedBaseMlCm, parsedHeightCm]);

  useEffect(() => {
    if (!participant) {
      nav.replace(Routes.ParticipantPick, {
        nextRoute: Routes.Test_LimiteEstabilidade,
        testTitle: t("tests:limiteEstabilidade.title"),
        testKey: "limite_estabilidade",
      });
      return;
    }

    const participantKey = String(participant.id ?? participant.name ?? "");
    if (participantKeyRef.current === participantKey) return;
    participantKeyRef.current = participantKey;

    const initialHeight = readExistingHeightCm(participant);
    const initialPhoneHeight = readExistingPhoneHeightCm(participant);
    const initialBaseAp = readExistingBaseAPCm(participant);
    const initialBaseMl = readExistingBaseMLCm(participant);

    setHeightInput(initialHeight != null ? formatDecimalInput(initialHeight) : "");
    setPhoneHeightInput(initialPhoneHeight != null ? formatDecimalInput(initialPhoneHeight) : "");
    setBaseApInput(initialBaseAp != null ? formatDecimalInput(initialBaseAp) : "");
    setBaseMlInput(initialBaseMl != null ? formatDecimalInput(initialBaseMl) : "");

    setLosParamsConfirmed(false);
    setLosParamsModalVisible(true);
  }, [participant, nav]);

  const sessionBlocksNav =
    phase === "waitingStillness" ||
    phase === "ready" ||
    phase === "countdown" ||
    phase === "recording";

  useLayoutEffect(() => {
    nav.setOptions({
      gestureEnabled: !sessionBlocksNav,
      headerBackVisible: !sessionBlocksNav,
    });
  }, [nav, sessionBlocksNav]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (sessionBlocksNav) return true;
      return false;
    });

    return () => sub.remove();
  }, [sessionBlocksNav]);

  useEffect(() => {
    const beforeRemove = nav.addListener("beforeRemove", (e: any) => {
      if (sessionBlocksNav) {
        e.preventDefault();
      }
    });

    return beforeRemove;
  }, [nav, sessionBlocksNav]);

  const clearTimerInterval = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const startRunTimer = () => {
    clearTimerInterval();
    runStartRef.current = Date.now();
    setElapsedMs(0);

    intervalRef.current = setInterval(() => {
      if (!runStartRef.current) return;
      setElapsedMs(Date.now() - runStartRef.current);
    }, 200);
  };

  const stopRunTimer = () => {
    clearTimerInterval();
    if (runStartRef.current) {
      setElapsedMs(Date.now() - runStartRef.current);
    }
    runStartRef.current = null;
  };

  const confirmLosParams = useCallback(() => {
    if (parsedHeightCm == null || parsedHeightCm <= 0) {
      Alert.alert(t("errors:titles.error"), t("tests:limiteEstabilidade.params.errors.heightRequired"));
      return;
    }
    if (parsedBaseApCm == null || parsedBaseApCm <= 0) {
      Alert.alert(t("errors:titles.error"), t("tests:limiteEstabilidade.params.errors.baseApRequired"));
      return;
    }
    if (parsedBaseMlCm == null || parsedBaseMlCm <= 0) {
      Alert.alert(t("errors:titles.error"), t("tests:limiteEstabilidade.params.errors.baseMlRequired"));
      return;
    }

    setHeightInput(formatDecimalInput(parsedHeightCm));
    if (parsedPhoneHeightCm != null) {
      setPhoneHeightInput(formatDecimalInput(parsedPhoneHeightCm));
    } else {
      setPhoneHeightInput("");
    }
    setBaseApInput(formatDecimalInput(parsedBaseApCm));
    setBaseMlInput(formatDecimalInput(parsedBaseMlCm));

    setLosParamsConfirmed(true);
    setLosParamsModalVisible(false);
  }, [parsedBaseApCm, parsedBaseMlCm, parsedHeightCm, parsedPhoneHeightCm, t]);

  const ensureLosParamsReady = useCallback(() => {
    if (!participant) {
      Alert.alert(t("errors:titles.error"), t("tests:common.failedToStart"));
      return false;
    }

    if (parsedHeightCm == null || parsedHeightCm <= 0) {
      Alert.alert(t("errors:titles.error"), t("tests:limiteEstabilidade.params.errors.heightRequired"));
      setLosParamsModalVisible(true);
      return false;
    }
    if (parsedBaseApCm == null || parsedBaseApCm <= 0) {
      Alert.alert(t("errors:titles.error"), t("tests:limiteEstabilidade.params.errors.baseApRequired"));
      setLosParamsModalVisible(true);
      return false;
    }
    if (parsedBaseMlCm == null || parsedBaseMlCm <= 0) {
      Alert.alert(t("errors:titles.error"), t("tests:limiteEstabilidade.params.errors.baseMlRequired"));
      setLosParamsModalVisible(true);
      return false;
    }

    if (!losParamsConfirmed) {
      Alert.alert(t("errors:titles.error"), t("tests:limiteEstabilidade.params.errors.mustConfirm"));
      setLosParamsModalVisible(true);
      return false;
    }

    return true;
  }, [losParamsConfirmed, parsedBaseApCm, parsedBaseMlCm, parsedHeightCm, parsedPhoneHeightCm, participant, t]);

  const speakLosKey = useCallback(
    async (key: LosSpeakKey) => {
      switch (key) {
        case "placePhone":
          await speakText(t("tests:limiteEstabilidade.speech.placePhone"));
          return;
        case "readyToStart":
          await speakText(t("tests:limiteEstabilidade.speech.readyToStart"));
          return;
        case "count3":
          await speakText(t("tests:common.speech.three"));
          return;
        case "count2":
          await speakText(t("tests:common.speech.two"));
          return;
        case "count1":
          await speakText(t("tests:common.speech.one"));
          return;
        case "go":
          await speakText(t("tests:limiteEstabilidade.speech.go"));
          return;
        default:
          return;
      }
    },
    [t]
  );

  const persistLosResult = useCallback(
    async (r: NativeImuStopResult, reason: LosFinishReason) => {
      const pForTest = participantForTest();
      if (!pForTest) {
        throw new Error(t("errors:titles.error"));
      }

      const savedCapture = await saveImuResultToCache({
        participant: pForTest,
        testType: "LOS",
        result: r,
        saveToCache: saveLosJsonToCache,
        emptySamplesMessage: t("tests:common.failedToFinish"),
      });

      setResult(savedCapture.result);
      setJsonUri(savedCapture.uri);
      setJsonSessionNumber(savedCapture.sessionNumber);
      setPhase("finished");
      setCountdownText("");

      if (reason === "timeout") {
        setStatusText(t("tests:common.finished"));
        await speakText(t("tests:common.speech.finished"));
      } else if (reason === "stability") {
        setStatusText(t("tests:common.finished"));
        await speakText(t("tests:common.speech.finished"));
      } else {
        setStatusText(t("tests:common.stopped"));
        await speakText(t("tests:common.speech.stopped"));
      }
    },
    [participantForTest, t]
  );

  const startTest = useCallback(async () => {
    if (phase !== "idle" && phase !== "finished") return;
    if (startingRef.current) return;
    startingRef.current = true;

    try {
      if (!ensureLosParamsReady()) {
        startingRef.current = false;
        return;
      }

      const motionOk = await losMotionIsAvailable();
      if (!motionOk) {
        Alert.alert(t("errors:titles.error"), t("tests:common.failedToStart"));
        return;
      }

      try {
        await Accelerometer.requestPermissionsAsync();
      } catch {
        /* ignore */
      }
      try {
        await DeviceMotion.requestPermissionsAsync();
      } catch {
        /* ignore */
      }

      cancelledRef.current = false;
      sessionRunStartedRef.current = false;
      clearTimerInterval();
      runStartRef.current = null;
      setElapsedMs(0);
      setResult(null);
      setJsonUri(null);
      setJsonSessionNumber(null);
      setCountdownText("");
      setStatusText(t("tests:common.ready"));

      const engine = new LosTestEngine({
        sampleHz: SAMPLE_HZ,
        speak: speakLosKey,
        onPatch: (patch) => {
          setPhase(patch.phase);
          setCountdownText(patch.countdownText);
          if (patch.statusKey) {
            setStatusText(t(`tests:limiteEstabilidade.engine.${patch.statusKey}`));
          }
          if (patch.phase === "recording" && !sessionRunStartedRef.current) {
            sessionRunStartedRef.current = true;
            startRunTimer();
          }
        },
        onFinished: async (r, reason) => {
          motionStopRef.current?.();
          motionStopRef.current = null;
          engineRef.current = null;
          stopRunTimer();

          try {
            await persistLosResult(r, reason);
          } catch (e: any) {
            setPhase("idle");
            setCountdownText("");
            setStatusText(t("tests:common.failedToFinish"));
            Alert.alert(t("errors:titles.error"), e?.message ?? t("tests:common.failedToFinish"));
          }
        },
      });

      engineRef.current = engine;

      const { stop } = startLosMotionStream(SAMPLE_HZ, (s) => {
        engine.handle(s);
      });
      motionStopRef.current = stop;

      engine.resetForNewSession();
      engine.speakPlacementHint();
    } catch (e: any) {
      motionStopRef.current?.();
      motionStopRef.current = null;
      engineRef.current?.abort();
      engineRef.current = null;
      stopRunTimer();
      setPhase("idle");
      setStatusText(t("tests:common.failedToStart"));
      setCountdownText("");
      Alert.alert(t("errors:titles.error"), e?.message ?? t("tests:common.failedToStart"));
    } finally {
      startingRef.current = false;
    }
  }, [ensureLosParamsReady, persistLosResult, phase, speakLosKey, t]);

  const stopTest = useCallback(async () => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;

    cancelledRef.current = true;
    stopSpeech();

    try {
      if (phase === "waitingStillness" || phase === "ready") {
        engineRef.current?.abort();
        engineRef.current = null;
        motionStopRef.current?.();
        motionStopRef.current = null;
        stopRunTimer();
        sessionRunStartedRef.current = false;
        setPhase("idle");
        setCountdownText("");
        setStatusText(t("tests:common.cancelled"));
        return;
      }

      if (phase === "countdown" || phase === "recording") {
        const ok = engineRef.current?.finishManual() ?? false;
        if (!ok) {
          if (phase === "countdown") {
            engineRef.current?.abort();
            engineRef.current = null;
            motionStopRef.current?.();
            motionStopRef.current = null;
            stopRunTimer();
            sessionRunStartedRef.current = false;
            setPhase("idle");
            setCountdownText("");
            setStatusText(t("tests:common.cancelled"));
            return;
          }
          Alert.alert(t("errors:titles.error"), t("tests:limiteEstabilidade.engine.manualTooFew"));
        }
        return;
      }
    } finally {
      stoppingRef.current = false;
    }
  }, [phase, t]);

  const protection = useProtectedTestRun({
    isRunning: phase === "recording",
    testName: "limite-estabilidade",
    navigation: nav,
    onBeforeExitBlocked: () => {
      console.log("[limite-estabilidade] saída bloqueada durante o teste");
    },
  });

  const handleStopPress = useCallback(async () => {
    if (phase === "recording") {
      await protection.guardedStop(stopTest);
      return;
    }
    await stopTest();
  }, [phase, protection, stopTest]);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      stopSpeech();
      stopRunTimer();
      engineRef.current?.abort();
      engineRef.current = null;
      motionStopRef.current?.();
      motionStopRef.current = null;
    };
  }, []);

  const goToResults = () => {
    const pForTest = participantForTest();
    if (!result || !jsonUri || !pForTest) return;

    nav.navigate(Routes.Test_LimiteEstabilidade_Result, {
      participant: pForTest,
      result,
      jsonUri,
      sessionNumber: jsonSessionNumber,
    });
  };

  const showSessionCancel = phase === "waitingStillness" || phase === "ready";
  const showFinishButton = phase === "countdown" || phase === "recording";
  const hasLocalAttempt = phase === "finished" && !!result && !!jsonUri;
  const showIdleOrFinishedActions = phase === "idle" || phase === "finished";
  const interrupted = statusText === t("tests:common.stopped");

  return (
    <Screen style={{ justifyContent: "space-between" }}>
      <TestCollectionHeader title={t("tests:limiteEstabilidade.title")} participant={participant} />

      <View style={{ alignItems: "center", justifyContent: "center", flex: 1 }}>
        {!!countdownText && (
          <T style={{ fontSize: 42, fontWeight: "900", marginBottom: 12, textAlign: "center" }}>{countdownText}</T>
        )}

        <T style={{ fontSize: 18, opacity: 0.8, marginBottom: 12, textAlign: "center" }}>{statusText}</T>

        <TestCollectionRunProgress
          visible={phase === "recording" || phase === "finished"}
          finished={phase === "finished"}
          interrupted={interrupted}
          interruptedTitle={t("tests:common.stopped")}
          timerText={fmtElapsedMs(elapsedMs)}
          showProgressBar={false}
        />

        <TestCollectionHeroImage testKey="limite_estabilidade" style={{ marginBottom: 20 }} />

        {showSessionCancel ? (
          <ThemedButton
            title={t("tests:common.stopTest")}
            variant="danger"
            onPress={handleStopPress}
            style={{ minWidth: 220 }}
          />
        ) : null}

        {showIdleOrFinishedActions ? (
          <TestCollectionAttemptActions
            hasLocalAttempt={hasLocalAttempt}
            showActiveControl={false}
            activeControlTitle={t("tests:common.finishTest")}
            onActiveControlPress={handleStopPress}
            onStart={startTest}
            onRestart={startTest}
            onGoToResults={goToResults}
            goToResultsLabel={t("tests:common.goToResults")}
            showGoToResults={hasLocalAttempt}
            extraIdleContent={
              <Pressable style={styles.secondaryButton} onPress={() => setLosParamsModalVisible(true)}>
                <T style={styles.secondaryButtonText}>
                  {losParamsConfirmed
                    ? t("tests:limiteEstabilidade.params.editForm")
                    : t("tests:limiteEstabilidade.params.openForm")}
                </T>
              </Pressable>
            }
          />
        ) : null}

        {showFinishButton ? (
          <TestCollectionAttemptActions
            hasLocalAttempt={false}
            showActiveControl
            activeControlTitle={t("tests:common.finishTest")}
            onActiveControlPress={handleStopPress}
            activeControlDisabled={phase === "recording" && !protection.canStopManually}
            onStart={startTest}
            onRestart={startTest}
            onGoToResults={goToResults}
            goToResultsLabel={t("tests:common.goToResults")}
            showGoToResults={false}
          />
        ) : null}
      </View>

      <TestRunLockOverlay
        visible={phase === "recording"}
        locked={protection.locked}
        tapCount={protection.tapCount}
        onLockTap={protection.handleLockTap}
        canStopManually={protection.canStopManually}
      />

      <Modal
        visible={losParamsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (phase === "idle" || phase === "finished") {
            setLosParamsModalVisible(false);
          }
        }}
      >
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalKeyboardWrap}>
            <View style={styles.modalCard}>
              <T style={styles.modalTitle}>{t("tests:limiteEstabilidade.params.modalTitle")}</T>
              <T style={styles.modalSubtitle}>{t("tests:limiteEstabilidade.params.modalSubtitle")}</T>

              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={styles.inputBlock}>
                  <T style={styles.inputLabel}>{t("tests:common.participantLabel")}</T>
                  <View style={styles.readOnlyField}>
                    <T style={styles.readOnlyFieldText}>{participant?.name ?? "—"}</T>
                  </View>
                </View>

                <View style={styles.inputBlock}>
                  <T style={styles.inputLabel}>{t("tests:limiteEstabilidade.params.heightLabel")}</T>
                  <TextInput
                    value={heightInput}
                    onChangeText={setHeightInput}
                    keyboardType="decimal-pad"
                    placeholder={t("tests:limiteEstabilidade.params.heightPlaceholder")}
                    placeholderTextColor="#94A3B8"
                    style={styles.input}
                    editable={phase === "idle" || phase === "finished"}
                  />
                </View>

                <View style={styles.inputBlock}>
                  <T style={styles.inputLabel}>{t("tests:limiteEstabilidade.params.phoneHeightLabel")}</T>
                  <TextInput
                    value={phoneHeightInput}
                    onChangeText={setPhoneHeightInput}
                    keyboardType="decimal-pad"
                    placeholder={t("tests:limiteEstabilidade.params.phoneHeightPlaceholder")}
                    placeholderTextColor="#94A3B8"
                    style={styles.input}
                    editable={phase === "idle" || phase === "finished"}
                  />
                  <T style={{ marginTop: 6, opacity: 0.72 }}>
                    {t("tests:limiteEstabilidade.params.phoneHeightHelper")}
                  </T>
                </View>

                <View style={styles.inputBlock}>
                  <T style={styles.inputLabel}>{t("tests:limiteEstabilidade.params.baseApLabel")}</T>
                  <TextInput
                    value={baseApInput}
                    onChangeText={setBaseApInput}
                    keyboardType="decimal-pad"
                    placeholder={t("tests:limiteEstabilidade.params.baseApPlaceholder")}
                    placeholderTextColor="#94A3B8"
                    style={styles.input}
                    editable={phase === "idle" || phase === "finished"}
                  />
                </View>

                <View style={styles.inputBlock}>
                  <T style={styles.inputLabel}>{t("tests:limiteEstabilidade.params.baseMlLabel")}</T>
                  <TextInput
                    value={baseMlInput}
                    onChangeText={setBaseMlInput}
                    keyboardType="decimal-pad"
                    placeholder={t("tests:limiteEstabilidade.params.baseMlPlaceholder")}
                    placeholderTextColor="#94A3B8"
                    style={styles.input}
                    editable={phase === "idle" || phase === "finished"}
                  />
                </View>

                <View style={styles.modalActions}>
                  {(phase === "idle" || phase === "finished") && (
                    <Pressable style={styles.modalSecondaryButton} onPress={() => setLosParamsModalVisible(false)}>
                      <T style={styles.modalSecondaryButtonText}>{t("tests:limiteEstabilidade.params.closeButton")}</T>
                    </Pressable>
                  )}

                  <Pressable style={styles.modalPrimaryButton} onPress={confirmLosParams}>
                    <T style={styles.modalPrimaryButtonText}>{t("tests:limiteEstabilidade.params.saveButton")}</T>
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  secondaryButton: {
    minWidth: 220,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    fontWeight: "800",
    color: "#1D4ED8",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    paddingHorizontal: 18,
    justifyContent: "center",
  },
  modalKeyboardWrap: {
    width: "100%",
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    maxHeight: "82%",
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 6,
  },
  modalSubtitle: {
    opacity: 0.72,
    marginBottom: 16,
    lineHeight: 20,
  },
  inputBlock: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 8,
    color: "#334155",
  },
  readOnlyField: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  readOnlyFieldText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  input: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    fontSize: 16,
    color: "#0F172A",
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  modalSecondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  modalSecondaryButtonText: {
    fontWeight: "800",
    color: "#475569",
  },
  modalPrimaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: "#0B5FFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  modalPrimaryButtonText: {
    fontWeight: "900",
    color: "#FFFFFF",
  },
});