import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import { TestCollectionAttemptActions } from "../components/TestCollectionAttemptActions";
import { TestCollectionHeader, TestCollectionHeroImage } from "../components/TestCollectionChrome";
import { TestCollectionRunProgress } from "../components/TestCollectionRunProgress";
import { finalizeImuCaptureToCache } from "../helpers/finalizeImuCapture";
import { TestRunLockOverlay } from "../components/TestRunLockOverlay";
import { useProtectedTestRun } from "../hooks/useProtectedTestRun";
import { imuClear, imuStart, NativeImuStopResult } from "../../../services/sensors/nativeImu";
import type { Participant } from "../../../models/types";
import { Routes } from "../../../navigation/routes";
import { speakText, speakTextMinDuration, stopSpeech } from "../../../services/speech";
import { saveSl30sJsonToCache } from "../../../services/tests/uploadTestJson";

type Phase = "idle" | "countdown" | "running" | "finished";

type ParticipantWithAnthropometry = Participant & {
  bodyMassKg?: number | null;
  massKg?: number | null;
  weight?: number | null;
  heightCm?: number | null;
  estaturaCm?: number | null;
  height?: number | null;
  massa?: number | null;
  peso?: number | null;
  estatura?: number | null;
  altura?: number | null;
};

const SAMPLE_HZ = 60;
const RECORD_MS = 34_000;


function fmtMs(ms: number) {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function sanitizeDecimalInput(value: string) {
  return value.replace(",", ".").replace(/[^0-9.]/g, "");
}

function parseMassKg(value: string): number | null {
  const cleaned = sanitizeDecimalInput(value);
  if (!cleaned) return null;

  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0 || n > 400) return null;

  return Math.round(n * 1000) / 1000;
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

function formatDecimalInput(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function formatMassDisplay(value: number | null) {
  return value != null ? `${formatDecimalInput(value)} kg` : "—";
}

function formatHeightDisplay(value: number | null) {
  return value != null ? `${formatDecimalInput(value)} cm` : "—";
}

function readExistingMassKg(participant?: Participant): number | null {
  if (!participant) return null;

  const p = participant as ParticipantWithAnthropometry;
  const candidate = p.bodyMassKg ?? p.massKg ?? p.weight ?? p.massa ?? p.peso;
  if (candidate == null) return null;

  const n = Number(candidate);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 1000) / 1000 : null;
}

function readExistingHeightCm(participant?: Participant): number | null {
  if (!participant) return null;

  const p = participant as ParticipantWithAnthropometry;
  let candidate = p.heightCm ?? p.estaturaCm ?? p.height ?? p.estatura ?? p.altura;
  if (candidate == null) return null;

  let n = Number(candidate);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n <= 3) n *= 100;

  return Math.round(n * 10) / 10;
}

export default function SentarLevantar() {
  const { t } = useTranslation(["tests", "errors"]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const participant = route.params?.participant as Participant | undefined;

  const [phase, setPhase] = useState<Phase>("idle");
  const [statusText, setStatusText] = useState(t("tests:common.ready"));
  const [countdownText, setCountdownText] = useState("");
  const [result, setResult] = useState<NativeImuStopResult | null>(null);
  const [jsonUri, setJsonUri] = useState<string | null>(null);
  const [jsonSessionNumber, setJsonSessionNumber] = useState<number | null>(null);
  const [recordingStarted, setRecordingStarted] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  const [bodyMassInput, setBodyMassInput] = useState("");
  const [heightInput, setHeightInput] = useState("");
  const [anthropometryModalVisible, setAnthropometryModalVisible] = useState(false);
  const [anthropometryConfirmed, setAnthropometryConfirmed] = useState(false);

  const cancelledRef = useRef(false);
  const finishTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runStartRef = useRef<number | null>(null);
  const recordingStartedRef = useRef(false);
  const finishingRef = useRef(false);
  const stoppingRef = useRef(false);
  const startingRef = useRef(false);
  const participantKeyRef = useRef<string>("");

  const parsedBodyMassKg = useMemo(() => parseMassKg(bodyMassInput), [bodyMassInput]);
  const parsedHeightCm = useMemo(() => parseHeightCm(heightInput), [heightInput]);

  const participantForTest = useMemo<ParticipantWithAnthropometry | undefined>(() => {
    if (!participant) return undefined;

    return {
      ...participant,
      bodyMassKg: parsedBodyMassKg,
      massKg: parsedBodyMassKg,
      weight: parsedBodyMassKg,
      heightCm: parsedHeightCm,
      estaturaCm: parsedHeightCm,
      height: parsedHeightCm,
      massa: parsedBodyMassKg,
      peso: parsedBodyMassKg,
      estatura: parsedHeightCm,
      altura: parsedHeightCm,
    };
  }, [participant, parsedBodyMassKg, parsedHeightCm]);

  useEffect(() => {
    recordingStartedRef.current = recordingStarted;
  }, [recordingStarted]);

  useEffect(() => {
    if (!participant) {
      nav.replace(Routes.ParticipantPick, {
        nextRoute: Routes.Test_SentarLevantar,
        testTitle: t("tests:sentarLevantar.title"),
        testKey: "sentar_levantar",
      });
      return;
    }

    const participantKey = String(participant.id ?? participant.name ?? "");
    if (participantKeyRef.current === participantKey) return;
    participantKeyRef.current = participantKey;

    const initialMass = readExistingMassKg(participant);
    const initialHeight = readExistingHeightCm(participant);

    setBodyMassInput(initialMass != null ? formatDecimalInput(initialMass) : "");
    setHeightInput(initialHeight != null ? formatDecimalInput(initialHeight) : "");
    setAnthropometryConfirmed(false);
    setAnthropometryModalVisible(true);
  }, [participant, nav]);

  useLayoutEffect(() => {
    const shouldBlockBack = phase === "countdown" || phase === "running";

    nav.setOptions({
      gestureEnabled: !shouldBlockBack,
      headerBackVisible: !shouldBlockBack,
    });
  }, [nav, phase]);

  useEffect(() => {
    const shouldBlockBack = phase === "countdown" || phase === "running";

    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (shouldBlockBack) return true;
      return false;
    });

    return () => sub.remove();
  }, [phase]);

  useEffect(() => {
    const beforeRemove = nav.addListener("beforeRemove", (e: any) => {
      if (phase === "countdown" || phase === "running") {
        e.preventDefault();
      }
    });

    return beforeRemove;
  }, [nav, phase]);

  const clearFinishTimeout = () => {
    if (finishTimeoutRef.current) {
      clearTimeout(finishTimeoutRef.current);
      finishTimeoutRef.current = null;
    }
  };

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

  const confirmAnthropometry = useCallback(() => {
    if (parsedBodyMassKg == null || parsedBodyMassKg <= 0) {
      Alert.alert(t("errors:titles.error"), t("tests:common.failedToStart"));
      return;
    }

    if (parsedHeightCm == null || parsedHeightCm <= 0) {
      Alert.alert(t("errors:titles.error"), t("tests:common.failedToStart"));
      return;
    }

    setBodyMassInput(formatDecimalInput(parsedBodyMassKg));
    setHeightInput(formatDecimalInput(parsedHeightCm));
    setAnthropometryConfirmed(true);
    setAnthropometryModalVisible(false);
  }, [parsedBodyMassKg, parsedHeightCm]);

  const ensureAnthropometryReady = useCallback(() => {
    if (!participant) {
      Alert.alert(t("errors:titles.error"), t("tests:common.failedToStart"));
      return false;
    }

    if (parsedBodyMassKg == null || parsedBodyMassKg <= 0) {
      Alert.alert(t("errors:titles.error"), t("tests:common.failedToStart"));
      setAnthropometryModalVisible(true);
      return false;
    }

    if (parsedHeightCm == null || parsedHeightCm <= 0) {
      Alert.alert(t("errors:titles.error"), t("tests:common.failedToStart"));
      setAnthropometryModalVisible(true);
      return false;
    }

    if (!anthropometryConfirmed) {
      Alert.alert(t("errors:titles.error"), t("tests:common.failedToStart"));
      setAnthropometryModalVisible(true);
      return false;
    }

    return true;
  }, [anthropometryConfirmed, parsedBodyMassKg, parsedHeightCm, participant]);

  const finalizeCapture = useCallback(
    async (reason: "auto" | "manual") => {
      if (finishingRef.current) return;
      finishingRef.current = true;

      try {
        clearFinishTimeout();
        stopRunTimer();
        stopSpeech();

        if (!recordingStartedRef.current) {
          setPhase("idle");
          setStatusText(t("tests:common.failedToFinish"));
          setCountdownText("");
          return;
        }

        if (!participantForTest) {
          throw new Error(t("errors:titles.error"));
        }

        const savedCapture = await finalizeImuCaptureToCache({
          participant: participantForTest,
          testType: "SL30S",
          saveToCache: saveSl30sJsonToCache,
          emptySamplesMessage: t("tests:common.failedToFinish"),
        });

        setResult(savedCapture.result);
        setJsonUri(savedCapture.uri);
        setJsonSessionNumber(savedCapture.sessionNumber);
        setPhase("finished");
        setRecordingStarted(false);
        recordingStartedRef.current = false;
        setCountdownText("");

        if (reason === "auto") {
          setStatusText(t("tests:common.finished"));
          await speakText(t("tests:common.speech.finished"));
        } else {
          setStatusText(t("tests:common.stopped"));
          await speakText(t("tests:common.speech.stopped"));
        }
      } catch (e: any) {
        setPhase("idle");
        setRecordingStarted(false);
        recordingStartedRef.current = false;
        setCountdownText("");
        stopRunTimer();
        setStatusText(t("tests:common.failedToFinish"));
        Alert.alert(t("errors:titles.error"), e?.message ?? t("tests:common.failedToFinish"));
      } finally {
        finishingRef.current = false;
      }
    },
    [participantForTest, t]
  );

  const startTest = useCallback(async () => {
    if (startingRef.current) return;
    if (phase === "countdown" || phase === "running") return;
    startingRef.current = true;

    try {
      if (!ensureAnthropometryReady() || !participantForTest) {
        startingRef.current = false;
        return;
      }

      cancelledRef.current = false;
      finishingRef.current = false;
      stoppingRef.current = false;
      clearFinishTimeout();
      clearTimerInterval();
      runStartRef.current = null;
      setElapsedMs(0);
      setResult(null);
      setJsonUri(null);
      setJsonSessionNumber(null);
      setRecordingStarted(false);
      recordingStartedRef.current = false;

      setPhase("countdown");
      setStatusText(t("tests:common.preparing"));
      setCountdownText(t("tests:common.speech.prepare"));

      await speakText(t("tests:common.speech.prepare"));
      if (cancelledRef.current) return;

      setCountdownText("5");
      await speakTextMinDuration(t("tests:common.speech.five"), 1000);
      if (cancelledRef.current) return;

      setCountdownText("4");
      await speakTextMinDuration(t("tests:common.speech.four"), 1000);
      if (cancelledRef.current) return;

      setCountdownText("3");
      await speakTextMinDuration(t("tests:common.speech.three"), 1000);
      if (cancelledRef.current) return;

      setCountdownText("2");
      const speechTwoPromise = speakTextMinDuration(t("tests:common.speech.two"), 1000);

      try {
        imuClear();
      } catch {
        /* native clear not available */
      }
      await imuStart(SAMPLE_HZ);
      setRecordingStarted(true);
      recordingStartedRef.current = true;
      setPhase("running");
      setStatusText(t("tests:common.collecting"));
      startRunTimer();

      await speechTwoPromise;
      if (cancelledRef.current) return;

      setCountdownText("1");
      await speakTextMinDuration(t("tests:common.speech.one"), 1000);
      if (cancelledRef.current) return;

      setCountdownText(t("tests:common.speech.start"));
      await speakText(t("tests:common.speech.start"));
      if (cancelledRef.current) return;

      setCountdownText("");
    } catch (e: any) {
      clearFinishTimeout();
      stopRunTimer();
      setRecordingStarted(false);
      recordingStartedRef.current = false;
      setPhase("idle");
      setStatusText(t("tests:common.failedToStart"));
      setCountdownText("");
      Alert.alert(t("errors:titles.error"), e?.message ?? t("tests:common.failedToStart"));
    } finally {
      startingRef.current = false;
    }
  }, [ensureAnthropometryReady, participantForTest, phase, t]);

  const stopTest = useCallback(async () => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;

    cancelledRef.current = true;
    clearFinishTimeout();

    try {
      if (recordingStartedRef.current) {
        await finalizeCapture("manual");
        return;
      }

      stopSpeech();
      stopRunTimer();
      setPhase("idle");
      setStatusText(t("tests:common.cancelled"));
      setCountdownText("");
    } finally {
      stoppingRef.current = false;
    }
  }, [finalizeCapture, t]);

  const protection = useProtectedTestRun({
    isRunning: phase === "running",
    durationMs: RECORD_MS,
    testName: "sentar-levantar",
    navigation: nav,
    onAutoFinish: () => finalizeCapture("auto"),
    onBeforeExitBlocked: () => {
      console.log("[sentar-levantar] saída bloqueada durante o teste");
    },
  });

  const handleStopPress = useCallback(async () => {
    await protection.guardedStop(stopTest);
  }, [protection, stopTest]);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      clearFinishTimeout();
      stopSpeech();
      stopRunTimer();
    };
  }, []);

  const goToResults = () => {
    if (!result || !jsonUri || !participantForTest) return;

    nav.navigate(Routes.Test_SentarLevantar_Result, {
      participant: participantForTest,
      result,
      jsonUri,
      sessionNumber: jsonSessionNumber,
    });
  };

  const showFinishButton = phase === "countdown" || phase === "running";
  const hasLocalAttempt = phase === "finished" && !!result && !!jsonUri;
  const interrupted = statusText === t("tests:common.stopped");

  const progress = Math.min(elapsedMs / RECORD_MS, 1);
  const remainingMs = Math.max(RECORD_MS - elapsedMs, 0);

  return (
    <Screen style={{ justifyContent: "space-between" }}>
      <TestCollectionHeader title={t("tests:sentarLevantar.title")} participant={participant} />

      <View style={{ alignItems: "center", justifyContent: "center", flex: 1 }}>
        {!!countdownText && (
          <T style={{ fontSize: 42, fontWeight: "900", marginBottom: 12, textAlign: "center" }}>{countdownText}</T>
        )}

        <T style={{ fontSize: 18, opacity: 0.8, marginBottom: 12, textAlign: "center" }}>{statusText}</T>

        <TestCollectionRunProgress
          visible={phase === "running" || phase === "finished"}
          finished={phase === "finished"}
          interrupted={interrupted}
          interruptedTitle={t("tests:common.stopped")}
          timerText={fmtMs(remainingMs)}
          progress={progress}
          percentLabel={t("tests:common.percentDone", { value: Math.round(progress * 100) })}
        />

        <TestCollectionHeroImage testKey="sentar_levantar" style={{ marginBottom: 20 }} />

        <TestCollectionAttemptActions
          hasLocalAttempt={hasLocalAttempt}
          showActiveControl={showFinishButton}
          activeControlTitle={t("tests:common.finishTest")}
          onActiveControlPress={handleStopPress}
          activeControlDisabled={!protection.canStopManually && phase === "running"}
          onStart={startTest}
          onRestart={startTest}
          onGoToResults={goToResults}
          goToResultsLabel={t("tests:common.goToResults")}
          showGoToResults={hasLocalAttempt}
          extraIdleContent={
            <Pressable style={styles.secondaryButton} onPress={() => setAnthropometryModalVisible(true)}>
              <T style={styles.secondaryButtonText}>
                {anthropometryConfirmed
                  ? t("tests:sentarLevantar.anthropometry.editForm")
                  : t("tests:sentarLevantar.anthropometry.openForm")}
              </T>
            </Pressable>
          }
        />
      </View>

      <TestRunLockOverlay
        visible={phase === "running"}
        locked={protection.locked}
        tapCount={protection.tapCount}
        onLockTap={protection.handleLockTap}
        canStopManually={protection.canStopManually}
      />

      <Modal
        visible={anthropometryModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (phase === "idle" || phase === "finished") {
            setAnthropometryModalVisible(false);
          }
        }}
      >
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.modalKeyboardWrap}
          >
            <View style={styles.modalCard}>
              <T style={styles.modalTitle}>{t("tests:sentarLevantar.anthropometry.modalTitle")}</T>
              <T style={styles.modalSubtitle}>
                {t("tests:sentarLevantar.anthropometry.modalSubtitle")}
              </T>

              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={styles.inputBlock}>
                  <T style={styles.inputLabel}>{t("tests:common.participantLabel")}</T>
                  <View style={styles.readOnlyField}>
                    <T style={styles.readOnlyFieldText}>{participant?.name ?? "—"}</T>
                  </View>
                </View>

                <View style={styles.inputBlock}>
                  <T style={styles.inputLabel}>{t("tests:sentarLevantar.anthropometry.massInputLabel")}</T>
                  <TextInput
                    value={bodyMassInput}
                    onChangeText={setBodyMassInput}
                    keyboardType="decimal-pad"
                    placeholder={t("tests:sentarLevantar.anthropometry.massPlaceholder")}
                    placeholderTextColor="#94A3B8"
                    style={styles.input}
                    editable={phase === "idle" || phase === "finished"}
                  />
                </View>

                <View style={styles.inputBlock}>
                  <T style={styles.inputLabel}>{t("tests:sentarLevantar.anthropometry.heightInputLabel")}</T>
                  <TextInput
                    value={heightInput}
                    onChangeText={setHeightInput}
                    keyboardType="decimal-pad"
                    placeholder={t("tests:sentarLevantar.anthropometry.heightPlaceholder")}
                    placeholderTextColor="#94A3B8"
                    style={styles.input}
                    editable={phase === "idle" || phase === "finished"}
                  />
                </View>

                <View style={styles.modalActions}>
                  {(phase === "idle" || phase === "finished") && (
                    <Pressable
                      style={styles.modalSecondaryButton}
                      onPress={() => setAnthropometryModalVisible(false)}
                    >
                      <T style={styles.modalSecondaryButtonText}>
                        {t("tests:sentarLevantar.anthropometry.closeButton")}
                      </T>
                    </Pressable>
                  )}

                  <Pressable style={styles.modalPrimaryButton} onPress={confirmAnthropometry}>
                    <T style={styles.modalPrimaryButtonText}>
                      {t("tests:sentarLevantar.anthropometry.saveButton")}
                    </T>
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
