import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Alert, BackHandler, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";

import { Screen, T } from "../../../components/Themed";
import { ThemedButton } from "../../../components/ThemedButton";
import {
  TestCollectionGoToResultsRow,
  TestCollectionHeader,
  TestCollectionHeroImage,
} from "../components/TestCollectionChrome";
import { imuStart, imuStop, NativeImuStopResult } from "../../../services/sensors/nativeImu";
import type { Participant } from "../../../models/types";
import { Routes } from "../../../navigation/routes";
import { speakText, speakTextMinDuration, stopSpeech } from "../../../services/speech";
import {
  getNextSessionNumber,
  saveMarchaJsonToCache,
} from "../../../services/tests/uploadTestJson";

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
      try {
        clearFinishTimeout();
        stopRunTimer();

        if (!recordingStartedRef.current) {
          setPhase("idle");
          setStatusText(t("tests:common.cancelledBeforeStart"));
          setCountdownText("");
          return;
        }

        const r = await imuStop();
        if (!participant) {
          throw new Error(t("errors:titles.error"));
        }

        const nextSession = await getNextSessionNumber(String(participant.id), "MARCHA");
        const saved = await saveMarchaJsonToCache(r, participant, nextSession);

        setResult(r);
        setJsonUri(saved.uri);
        setJsonSessionNumber(nextSession);
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
      }
    },
    [participant, t]
  );

  const startTest = useCallback(async () => {
    try {
      cancelledRef.current = false;
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

      await imuStart(SAMPLE_HZ);
      recordingStartedRef.current = true;
      setPhase("running");
      setStatusText(t("tests:common.collecting"));
      startRunTimer();

      finishTimeoutRef.current = setTimeout(() => {
        finalizeCapture("auto");
      }, RECORD_MS);

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
    }
  }, [finalizeCapture, t]);

  const stopTest = useCallback(async () => {
    cancelledRef.current = true;
    stopSpeech();
    clearFinishTimeout();

    if (recordingStartedRef.current) {
      await finalizeCapture("manual");
      return;
    }

    stopRunTimer();
    setPhase("idle");
    setStatusText(t("tests:common.cancelled"));
    setCountdownText("");
  }, [finalizeCapture, t]);

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
  const showGoToResults = phase === "finished" && !!result && !!jsonUri;

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

        {(phase === "running" || phase === "finished") && (
          <View style={{ width: "100%", marginBottom: 16 }}>
            <T style={{ textAlign: "center", fontSize: 28, fontWeight: "900", marginBottom: 10 }}>
              {fmtMs(remainingMs)}
            </T>

            <View
              style={{
                height: 14,
                borderRadius: 999,
                backgroundColor: "#D6DCEC",
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  width: `${progress * 100}%`,
                  height: "100%",
                  backgroundColor: "#0B5FFF",
                }}
              />
            </View>

            <T style={{ textAlign: "center", opacity: 0.7, marginTop: 8 }}>
              {t("tests:common.percentDone", { value: Math.round(progress * 100) })}
            </T>
          </View>
        )}

        <TestCollectionHeroImage testKey="marcha_estacionaria" style={{ marginBottom: 20 }} />

        {!showFinishButton ? (
          <ThemedButton title={t("tests:common.startTest")} onPress={startTest} style={{ minWidth: 220 }} />
        ) : (
          <ThemedButton
            title={t("tests:common.finishTest")}
            variant="danger"
            onPress={stopTest}
            style={{ minWidth: 220 }}
          />
        )}
      </View>

      <TestCollectionGoToResultsRow
        visible={showGoToResults}
        title={t("tests:common.goToResults")}
        onPress={goToResults}
      />
    </Screen>
  );
}