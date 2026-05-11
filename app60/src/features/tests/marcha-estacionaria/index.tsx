import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Alert, BackHandler, View } from "react-native";
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
import { saveMarchaJsonToCache } from "../../../services/tests/uploadTestJson";

type Phase = "idle" | "countdown" | "running" | "finished";

const SAMPLE_HZ = 60;
const RECORD_MS = 124_000;

function fmtMs(ms: number) {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function MarchaEstacionaria() {
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
  const [elapsedMs, setElapsedMs] = useState(0);

  const cancelledRef = useRef(false);
  const finishTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runStartRef = useRef<number | null>(null);
  const recordingStartedRef = useRef(false);
  const finishingRef = useRef(false);
  const stoppingRef = useRef(false);
  const startingRef = useRef(false);

  useEffect(() => {
    if (!participant) {
      nav.replace(Routes.ParticipantPick, {
        nextRoute: Routes.Test_MarchaEstacionaria,
        testTitle: t("tests:marchaEstacionaria.title"),
        testKey: "marcha_estacionaria",
      });
    }
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

  const finalizeCapture = useCallback(
    async (reason: "auto" | "manual") => {
      if (finishingRef.current) return;
      finishingRef.current = true;

      try {
        clearFinishTimeout();
        stopRunTimer();

        if (!recordingStartedRef.current) {
          setPhase("idle");
          setStatusText(t("tests:common.cancelledBeforeStart"));
          setCountdownText("");
          return;
        }

        if (!participant) {
          throw new Error(t("errors:titles.error"));
        }

        const savedCapture = await finalizeImuCaptureToCache({
          participant,
          testType: "MARCHA",
          saveToCache: saveMarchaJsonToCache,
          emptySamplesMessage: t("tests:common.failedToFinish"),
        });

        setResult(savedCapture.result);
        setJsonUri(savedCapture.uri);
        setJsonSessionNumber(savedCapture.sessionNumber);
        setPhase("finished");
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
        recordingStartedRef.current = false;
        setCountdownText("");
        stopRunTimer();
        setStatusText(t("tests:common.failedToFinish"));
        Alert.alert(t("errors:titles.error"), e?.message ?? t("tests:common.failedToFinish"));
      } finally {
        finishingRef.current = false;
      }
    },
    [participant, t]
  );

  const startTest = useCallback(async () => {
    if (startingRef.current) return;
    if (phase === "countdown" || phase === "running") return;
    startingRef.current = true;

    try {
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
      recordingStartedRef.current = false;
      setPhase("idle");
      setStatusText(t("tests:common.failedToStart"));
      setCountdownText("");
      Alert.alert(t("errors:titles.error"), e?.message ?? t("tests:common.failedToStart"));
    } finally {
      startingRef.current = false;
    }
  }, [phase, t]);

  const stopTest = useCallback(async () => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;

    cancelledRef.current = true;
    stopSpeech();
    clearFinishTimeout();

    try {
      if (recordingStartedRef.current) {
        await finalizeCapture("manual");
        return;
      }

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
    testName: "marcha-estacionaria",
    navigation: nav,
    onAutoFinish: () => finalizeCapture("auto"),
    onBeforeExitBlocked: () => {
      console.log("[marcha-estacionaria] saída bloqueada durante o teste");
    },
  });

  const handleStopPress = useCallback(async () => {
    await protection.guardedStop(stopTest);
  }, [protection, stopTest]);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      stopSpeech();
      clearFinishTimeout();
      stopRunTimer();
    };
  }, []);

  const goToResults = () => {
    if (!result || !jsonUri || !participant) return;

    nav.navigate(Routes.Test_MarchaEstacionaria_Result, {
      participant,
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
      <TestCollectionHeader title={t("tests:marchaEstacionaria.title")} participant={participant} />

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

        <TestCollectionHeroImage testKey="marcha_estacionaria" style={{ marginBottom: 20 }} />

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
        />
      </View>

      <TestRunLockOverlay
        visible={phase === "running"}
        locked={protection.locked}
        tapCount={protection.tapCount}
        onLockTap={protection.handleLockTap}
        canStopManually={protection.canStopManually}
      />
    </Screen>
  );
}