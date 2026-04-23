import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Alert, BackHandler, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";

import { Screen, T } from "../../../components/Themed";
import { ThemedButton } from "../../../components/ThemedButton";
import { imuStart, imuStop, NativeImuStopResult } from "../../../services/sensors/nativeImu";
import type { Participant } from "../../../models/types";
import { Routes } from "../../../navigation/routes";
import { speakText, stopSpeech } from "../../../services/speech";
import {
  getNextSessionNumber,
  saveLosJsonToCache,
} from "../../../services/tests/uploadTestJson";

type Phase = "idle" | "countdown" | "running" | "finished";

const SAMPLE_HZ = 60;

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

export default function LimiteEstabilidade() {
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

  useEffect(() => {
    if (!participant) {
      nav.replace(Routes.ParticipantPick, {
        nextRoute: Routes.Test_LimiteEstabilidade,
        testTitle: t("tests:limiteEstabilidade.title"),
        testKey: "limite_estabilidade",
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

  const finalizeCapture = useCallback(
    async (reason: "auto" | "manual") => {
      try {
        stopRunTimer();

        if (!recordingStarted) {
          setPhase("idle");
          setStatusText(t("tests:common.cancelledBeforeStart"));
          setCountdownText("");
          return;
        }

        const r = await imuStop();
        if (!participant) {
          throw new Error(t("errors:titles.error"));
        }

        const nextSession = await getNextSessionNumber(String(participant.id), "LOS");
        const saved = await saveLosJsonToCache(r, participant, nextSession);

        setResult(r);
        setJsonUri(saved.uri);
        setJsonSessionNumber(nextSession);
        setPhase("finished");
        setRecordingStarted(false);
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
        setCountdownText("");
        stopRunTimer();
        setStatusText(t("tests:common.failedToFinish"));
        Alert.alert(t("errors:titles.error"), e?.message ?? t("tests:common.failedToFinish"));
      }
    },
    [participant, recordingStarted, t]
  );

  const startTest = useCallback(async () => {
    try {
      cancelledRef.current = false;
      clearTimerInterval();
      runStartRef.current = null;
      setElapsedMs(0);
      setResult(null);
      setJsonUri(null);
      setJsonSessionNumber(null);
      setPhase("countdown");
      setStatusText(t("tests:common.preparing"));
      setCountdownText(t("tests:common.speech.prepare"));

      await speakText(t("tests:common.speech.prepare"));
      if (cancelledRef.current) return;

      setCountdownText("5");
      const speechFivePromise = speakText(t("tests:common.speech.five"));

      await imuStart(SAMPLE_HZ);
      setRecordingStarted(true);
      setPhase("running");
      setStatusText(t("tests:common.collecting"));
      startRunTimer();

      await speechFivePromise;
      if (cancelledRef.current) return;

      setCountdownText("4");
      await speakText(t("tests:common.speech.four"));
      if (cancelledRef.current) return;

      setCountdownText("3");
      await speakText(t("tests:common.speech.three"));
      if (cancelledRef.current) return;

      setCountdownText("2");
      await speakText(t("tests:common.speech.two"));
      if (cancelledRef.current) return;

      setCountdownText("1");
      await speakText(t("tests:common.speech.one"));
      if (cancelledRef.current) return;

      setCountdownText(t("tests:common.speech.start"));
      await speakText(t("tests:common.speech.start"));
      if (cancelledRef.current) return;

      setCountdownText("");
    } catch (e: any) {
      stopRunTimer();
      setRecordingStarted(false);
      setPhase("idle");
      setStatusText(t("tests:common.failedToStart"));
      setCountdownText("");
      Alert.alert(t("errors:titles.error"), e?.message ?? t("tests:common.failedToStart"));
    }
  }, [t]);

  const stopTest = useCallback(async () => {
    cancelledRef.current = true;
    stopSpeech();

    if (recordingStarted) {
      await finalizeCapture("manual");
      return;
    }

    stopRunTimer();
    setPhase("idle");
    setStatusText(t("tests:common.cancelled"));
    setCountdownText("");
  }, [finalizeCapture, recordingStarted, t]);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      stopSpeech();
      stopRunTimer();
    };
  }, []);

  const goToResults = () => {
    if (!result || !jsonUri || !participant) return;

    nav.navigate(Routes.Test_LimiteEstabilidade_Result, {
      participant,
      result,
      jsonUri,
      sessionNumber: jsonSessionNumber,
    });
  };

  const showFinishButton = phase === "countdown" || phase === "running";
  const showGoToResults = phase === "finished" && !!result && !!jsonUri;

  return (
    <Screen style={{ justifyContent: "space-between" }}>
      <View>
        <T style={{ fontSize: 22, fontWeight: "900", marginTop: 18 }}>{t("tests:limiteEstabilidade.title")}</T>
        <T style={{ marginTop: 4, opacity: 0.7 }}>
          {t("tests:common.participant", { name: participant?.name ?? "—" })}
        </T>
      </View>

      <View style={{ alignItems: "center", justifyContent: "center", flex: 1 }}>
        {!!countdownText && (
          <T style={{ fontSize: 42, fontWeight: "900", marginBottom: 16 }}>{countdownText}</T>
        )}

        <T style={{ fontSize: 18, opacity: 0.8, marginBottom: 16 }}>{statusText}</T>

        {(phase === "running" || phase === "finished") && (
          <View style={{ width: "100%", marginBottom: 20 }}>
            <T style={{ textAlign: "center", fontSize: 28, fontWeight: "900", marginBottom: 10 }}>
              {fmtElapsedMs(elapsedMs)}
            </T>
          </View>
        )}

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

      <View>
        {phase === "finished" && !!result && (
          <View style={{ marginBottom: 16 }}>
            <T>{t("tests:common.samples")}: {result.stats.n}</T>
            <T>{t("tests:common.hzMean")}: {result.stats.hzMean?.toFixed(2) ?? "—"}</T>
            <T>{t("tests:common.hzInRange")}: {result.stats.pctIn58to62?.toFixed(1) ?? "—"}%</T>
          </View>
        )}

        {showGoToResults && (
          <ThemedButton title={t("tests:common.goToResults")} onPress={goToResults} />
        )}
      </View>
    </Screen>
  );
}