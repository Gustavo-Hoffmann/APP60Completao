import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Alert, BackHandler, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";

import { Screen, T } from "../../../components/Themed";
import { TestCollectionAttemptActions } from "../components/TestCollectionAttemptActions";
import { TestCollectionHeader, TestCollectionHeroImage } from "../components/TestCollectionChrome";
import { TestCollectionRunProgress } from "../components/TestCollectionRunProgress";
import { saveImuResultToCache } from "../helpers/finalizeImuCapture";
import { TestRunLockOverlay } from "../components/TestRunLockOverlay";
import { useProtectedTestRun } from "../hooks/useProtectedTestRun";
import {
  imuAddAutoStopListener,
  imuClear,
  imuStart,
  imuStop,
  NativeImuStopResult,
} from "../../../services/sensors/nativeImu";
import type { Participant } from "../../../models/types";
import { Routes } from "../../../navigation/routes";
import { speakText, speakTextMinDuration, stopSpeech } from "../../../services/speech";
import { saveTugJsonToCache } from "../../../services/tests/uploadTestJson";

type Phase = "idle" | "countdown" | "running" | "finished";

const SAMPLE_HZ = 60;

function fmtElapsed(ms: number) {
  const totalSec = Math.max(0, ms / 1000);
  return totalSec.toFixed(2).replace(".", ",") + " s";
}

export default function TugTestScreen() {
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

  const cancelledRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runStartRef = useRef<number | null>(null);
  const autoStopHandledRef = useRef(false);
  const finalizingRef = useRef(false);
  const stoppingRef = useRef(false);
  const startingRef = useRef(false);

  useEffect(() => {
    if (!participant) {
      nav.replace(Routes.ParticipantPick, {
        nextRoute: Routes.Test_TUG,
        testTitle: t("tests:tug.title"),
        testKey: "tug",
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

  const finalizeWithResult = useCallback(
    async (
      nativeResult: NativeImuStopResult,
      reasonLabel: string,
      speechText?: string
    ) => {
      if (finalizingRef.current) return;
      finalizingRef.current = true;

      try {
        stopRunTimer();

        if (!participant) {
          throw new Error(t("errors:titles.error"));
        }

        const savedCapture = await saveImuResultToCache({
          participant,
          testType: "TUG",
          result: nativeResult,
          saveToCache: saveTugJsonToCache,
          emptySamplesMessage: t("tests:common.failedToFinish"),
        });

        setResult(savedCapture.result);
        setJsonUri(savedCapture.uri);
        setJsonSessionNumber(savedCapture.sessionNumber);
        setPhase("finished");
        setRecordingStarted(false);
        setCountdownText("");
        setStatusText(reasonLabel);

        if (speechText) {
          await speakText(speechText);
        }
      } catch (e: any) {
        setPhase("idle");
        setRecordingStarted(false);
        setCountdownText("");
        setStatusText(t("tests:common.failedToFinish"));
        Alert.alert(t("errors:titles.error"), e?.message ?? t("tests:common.failedToFinish"));
      } finally {
        finalizingRef.current = false;
      }
    },
    [participant, t]
  );

  useEffect(() => {
    const sub = imuAddAutoStopListener(async (nativeResult) => {
      if (autoStopHandledRef.current) return;
      autoStopHandledRef.current = true;

      await finalizeWithResult(
        nativeResult,
        t("tests:common.finished"),
        t("tests:common.speech.finished")
      );
    });

    return () => {
      sub.remove();
    };
  }, [finalizeWithResult, t]);

  const finalizeManualCapture = useCallback(async () => {
    try {
      stopRunTimer();

      if (!recordingStarted) {
        setPhase("idle");
        setStatusText(t("tests:common.cancelledBeforeStart"));
        setCountdownText("");
        return;
      }

      const r = await imuStop();
      await finalizeWithResult(r, t("tests:common.stopped"), t("tests:common.speech.stopped"));
    } catch (e: any) {
      setPhase("idle");
      setRecordingStarted(false);
      setCountdownText("");
      stopRunTimer();
      setStatusText(t("tests:common.failedToFinish"));
      Alert.alert(t("errors:titles.error"), e?.message ?? t("tests:common.failedToFinish"));
    }
  }, [finalizeWithResult, recordingStarted, t]);

  const startTest = useCallback(async () => {
    if (startingRef.current) return;
    if (phase === "countdown" || phase === "running") return;
    startingRef.current = true;

    try {
      cancelledRef.current = false;
      autoStopHandledRef.current = false;
      finalizingRef.current = false;
      stoppingRef.current = false;

      clearTimerInterval();
      runStartRef.current = null;
      setElapsedMs(0);
      setResult(null);
      setJsonUri(null);
      setJsonSessionNumber(null);

      setPhase("countdown");
      setStatusText(t("tests:tug.baselineWait"));
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
      const twoSpeechPromise = speakTextMinDuration(t("tests:common.speech.two"), 1000);

      try {
        imuClear();
      } catch {
        /* native clear not available */
      }
      await imuStart({ hz: SAMPLE_HZ, mode: "tug" });
      setRecordingStarted(true);
      setPhase("running");
      setStatusText(t("tests:tug.baselineWait"));
      startRunTimer();

      await twoSpeechPromise;
      if (cancelledRef.current) return;

      setCountdownText("1");
      await speakTextMinDuration(t("tests:common.speech.one"), 1000);
      if (cancelledRef.current) return;

      setCountdownText(t("tests:common.speech.start"));
      await speakText(t("tests:common.speech.start"));
      if (cancelledRef.current) return;

      setCountdownText("");
      setStatusText(t("tests:common.running"));
    } catch (e: any) {
      stopRunTimer();
      setRecordingStarted(false);
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

    try {
      if (recordingStarted) {
        await finalizeManualCapture();
        return;
      }

      stopRunTimer();
      setPhase("idle");
      setStatusText(t("tests:common.cancelled"));
      setCountdownText("");
    } finally {
      stoppingRef.current = false;
    }
  }, [finalizeManualCapture, recordingStarted, t]);

  const protection = useProtectedTestRun({
    isRunning: phase === "running",
    testName: "tug",
    navigation: nav,
    onBeforeExitBlocked: () => {
      console.log("[tug] saída bloqueada durante o teste");
    },
  });

  const handleStopPress = useCallback(async () => {
    await protection.guardedStop(stopTest);
  }, [protection, stopTest]);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      stopSpeech();
      stopRunTimer();
    };
  }, []);

  const goToResults = () => {
    if (!result || !jsonUri || !participant) return;

    nav.navigate(Routes.Test_TUG_Result, {
      participant,
      result,
      jsonUri,
      sessionNumber: jsonSessionNumber,
    });
  };

  const showStopButton = phase === "countdown" || phase === "running";
  const hasLocalAttempt = phase === "finished" && !!result && !!jsonUri;
  const interrupted = statusText === t("tests:common.stopped");

  return (
    <Screen style={{ justifyContent: "space-between" }}>
      <TestCollectionHeader title={t("tests:tug.title")} participant={participant} />

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
          timerText={fmtElapsed(elapsedMs)}
          progress={phase === "finished" ? 1 : 0.35}
          showProgressBar={phase === "running"}
          captionText={
            phase === "running"
              ? t("tests:tug.detectedTimeHintRunning")
              : t("tests:tug.detectedTimeHintFinished")
          }
        />

        <TestCollectionHeroImage testKey="tug" style={{ marginBottom: 20 }} />

        <TestCollectionAttemptActions
          hasLocalAttempt={hasLocalAttempt}
          showActiveControl={showStopButton}
          activeControlTitle={t("tests:common.stopTest")}
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