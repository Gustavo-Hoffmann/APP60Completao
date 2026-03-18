import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Alert, BackHandler, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as Speech from "expo-speech";

import { Screen, T } from "../../../components/Themed";
import { ThemedButton } from "../../../components/ThemedButton";
import {
  imuAddAutoStopListener,
  imuStart,
  imuStop,
  NativeImuStopResult,
} from "../../../services/sensors/nativeImu";
import type { Participant } from "../../../models/types";
import { Routes } from "../../../navigation/routes";
import {
  getNextSessionNumber,
  saveTugJsonToCache,
} from "../../../services/tests/uploadTestJson";

type Phase = "idle" | "countdown" | "running" | "finished";

const SAMPLE_HZ = 60;

async function speak(text: string) {
  try {
    const SpeechModule: any = Speech as any;

    if (!SpeechModule || typeof SpeechModule.speak !== "function") {
      return;
    }

    await new Promise<void>((resolve) => {
      Speech.speak(text, {
        language: "pt-BR",
        rate: 0.92,
        pitch: 1.0,
        onDone: () => resolve(),
        onStopped: () => resolve(),
        onError: () => resolve(),
      });
    });
  } catch {}
}

function stopSpeechSafely() {
  try {
    const SpeechModule: any = Speech as any;
    if (SpeechModule && typeof SpeechModule.stop === "function") {
      Speech.stop();
    }
  } catch {}
}

function fmtElapsed(ms: number) {
  const totalSec = Math.max(0, ms / 1000);
  return totalSec.toFixed(2).replace(".", ",") + " s";
}

export default function TugTestScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const participant = route.params?.participant as Participant | undefined;

  const [phase, setPhase] = useState<Phase>("idle");
  const [statusText, setStatusText] = useState("Pronto para iniciar");
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

  useEffect(() => {
    if (!participant) {
      nav.replace(Routes.ParticipantPick, {
        nextRoute: Routes.Test_TUG,
        testTitle: "TUG",
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
          throw new Error("Participante ausente no fim da coleta.");
        }

        const nextSession = await getNextSessionNumber(String(participant.id), "TUG");
        const saved = await saveTugJsonToCache(nativeResult, participant, nextSession);

        setResult(nativeResult);
        setJsonUri(saved.uri);
        setJsonSessionNumber(nextSession);
        setPhase("finished");
        setRecordingStarted(false);
        setCountdownText("");
        setStatusText(reasonLabel);

        if (speechText) {
          await speak(speechText);
        }
      } catch (e: any) {
        setPhase("idle");
        setRecordingStarted(false);
        setCountdownText("");
        setStatusText("Falha ao finalizar");
        Alert.alert("Erro", e?.message ?? "Falha ao finalizar o teste.");
      } finally {
        finalizingRef.current = false;
      }
    },
    [participant]
  );

  useEffect(() => {
    const sub = imuAddAutoStopListener(async (nativeResult) => {
      if (autoStopHandledRef.current) return;
      autoStopHandledRef.current = true;

      await finalizeWithResult(nativeResult, "Teste finalizado", "Teste finalizado");
    });

    return () => {
      sub.remove();
    };
  }, [finalizeWithResult]);

  const finalizeManualCapture = useCallback(async () => {
    try {
      stopRunTimer();

      if (!recordingStarted) {
        setPhase("idle");
        setStatusText("Teste cancelado antes da coleta");
        setCountdownText("");
        return;
      }

      const r = await imuStop();
      await finalizeWithResult(r, "Teste interrompido", "Teste interrompido");
    } catch (e: any) {
      setPhase("idle");
      setRecordingStarted(false);
      setCountdownText("");
      stopRunTimer();
      setStatusText("Falha ao finalizar");
      Alert.alert("Erro", e?.message ?? "Falha ao finalizar o teste.");
    }
  }, [finalizeWithResult, recordingStarted]);

  const startTest = useCallback(async () => {
    try {
      cancelledRef.current = false;
      autoStopHandledRef.current = false;
      finalizingRef.current = false;

      clearTimerInterval();
      runStartRef.current = null;
      setElapsedMs(0);
      setResult(null);
      setJsonUri(null);
      setJsonSessionNumber(null);

      setPhase("countdown");
      setStatusText("Prepare-se e permaneça parado até começar");
      setCountdownText("Prepare-se");

      await speak("Prepare-se");
      if (cancelledRef.current) return;

      setCountdownText("3");
      await speak("3");
      if (cancelledRef.current) return;

      setCountdownText("2");
      const twoSpeechPromise = speak("2");

      await imuStart({ hz: SAMPLE_HZ, mode: "tug" });
      setRecordingStarted(true);
      setPhase("running");
      setStatusText("Coletando baseline e aguardando início real do teste...");
      startRunTimer();

      await twoSpeechPromise;
      if (cancelledRef.current) return;

      setCountdownText("1");
      await speak("1");
      if (cancelledRef.current) return;

      setCountdownText("Começa");
      await speak("Começa");
      if (cancelledRef.current) return;

      setCountdownText("");
      setStatusText("Teste em andamento...");
    } catch (e: any) {
      stopRunTimer();
      setRecordingStarted(false);
      setPhase("idle");
      setStatusText("Falha ao iniciar");
      setCountdownText("");
      Alert.alert("Erro", e?.message ?? "Falha ao iniciar o teste.");
    }
  }, []);

  const stopTest = useCallback(async () => {
    cancelledRef.current = true;
    stopSpeechSafely();

    if (recordingStarted) {
      await finalizeManualCapture();
      return;
    }

    stopRunTimer();
    setPhase("idle");
    setStatusText("Teste cancelado");
    setCountdownText("");
  }, [finalizeManualCapture, recordingStarted]);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      stopSpeechSafely();
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
  const showGoToResults = phase === "finished" && !!result && !!jsonUri;

  return (
    <Screen style={{ justifyContent: "space-between" }}>
      <View>
        <T style={{ fontSize: 22, fontWeight: "900", marginTop: 18 }}>TUG</T>
        <T style={{ marginTop: 4, opacity: 0.7 }}>
          Participante: {participant?.name ?? "—"}
        </T>
      </View>

      <View style={{ alignItems: "center", justifyContent: "center", flex: 1 }}>
        {!!countdownText && (
          <T style={{ fontSize: 42, fontWeight: "900", marginBottom: 16 }}>{countdownText}</T>
        )}

        <T style={{ fontSize: 18, opacity: 0.8, marginBottom: 16, textAlign: "center" }}>
          {statusText}
        </T>

        {(phase === "running" || phase === "finished") && (
          <View style={{ width: "100%", marginBottom: 20 }}>
            <T style={{ textAlign: "center", fontSize: 28, fontWeight: "900", marginBottom: 10 }}>
              {fmtElapsed(elapsedMs)}
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
                  width: phase === "finished" ? "100%" : "35%",
                  height: "100%",
                  backgroundColor: "#0B5FFF",
                }}
              />
            </View>

            <T style={{ textAlign: "center", opacity: 0.7, marginTop: 8 }}>
              {phase === "running"
                ? "O tempo válido do teste será o detectado automaticamente"
                : "Teste encerrado"}
            </T>
          </View>
        )}

        {!showStopButton ? (
          <ThemedButton title="Iniciar teste" onPress={startTest} style={{ minWidth: 220 }} />
        ) : (
          <ThemedButton
            title="Interromper teste"
            variant="danger"
            onPress={stopTest}
            style={{ minWidth: 220 }}
          />
        )}
      </View>

      <View>
        {phase === "finished" && !!result && (
          <View style={{ marginBottom: 16 }}>
            <T>Amostras: {result.stats.n}</T>
            <T>Hz médio: {result.stats.hzMean?.toFixed(2) ?? "—"}</T>
            <T>
              Tempo TUG detectado:{" "}
              {result.tug?.detected && result.tug.durationMs != null
                ? `${(result.tug.durationMs / 1000).toFixed(3)} s`
                : "—"}
            </T>
            <T>Sessão: {jsonSessionNumber != null ? `S${jsonSessionNumber}` : "—"}</T>
          </View>
        )}

        {showGoToResults && <ThemedButton title="Ir para resultados" onPress={goToResults} />}
      </View>
    </Screen>
  );
}