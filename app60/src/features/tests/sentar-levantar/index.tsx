import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Alert, BackHandler, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as Speech from "expo-speech";

import { Screen, T } from "../../../components/Themed";
import { ThemedButton } from "../../../components/ThemedButton";
import { imuStart, imuStop, NativeImuStopResult } from "../../../services/sensors/nativeImu";
import type { Participant } from "../../../models/types";
import { Routes } from "../../../navigation/routes";
import {
  getNextSessionNumber,
  saveSl30sJsonToCache,
} from "../../../services/tests/uploadTestJson";

type Phase = "idle" | "countdown" | "running" | "finished";

const SAMPLE_HZ = 60;
const RECORD_MS = 34_000;

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

function fmtMs(ms: number) {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function SentarLevantar() {
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
  const finishTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runStartRef = useRef<number | null>(null);
  const recordingStartedRef = useRef(false);
  const finishingRef = useRef(false);

  useEffect(() => {
    recordingStartedRef.current = recordingStarted;
  }, [recordingStarted]);

  useEffect(() => {
    if (!participant) {
      nav.replace(Routes.ParticipantPick, {
        nextRoute: Routes.Test_SentarLevantar,
        testTitle: "Sentar e levantar",
        testKey: "sentar_levantar",
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
        stopSpeechSafely();

        if (!recordingStartedRef.current) {
          setPhase("idle");
          setStatusText("Falha ao finalizar: coleta não iniciou");
          setCountdownText("");
          return;
        }

        if (!participant) {
          throw new Error("Participante ausente no fim da coleta.");
        }

        const r = await imuStop();

        if (!r?.samples || r.samples.length === 0) {
          throw new Error("A coleta retornou sem amostras.");
        }

        const nextSession = await getNextSessionNumber(String(participant.id), "SL30S");
        const saved = await saveSl30sJsonToCache(r, participant, nextSession);

        setResult(r);
        setJsonUri(saved.uri);
        setJsonSessionNumber(nextSession);
        setPhase("finished");
        setRecordingStarted(false);
        recordingStartedRef.current = false;
        setCountdownText("");

        if (reason === "auto") {
          setStatusText("Teste concluído");
          await speak("Teste concluído");
        } else {
          setStatusText("Teste interrompido");
          await speak("Teste interrompido");
        }
      } catch (e: any) {
        setPhase("idle");
        setRecordingStarted(false);
        recordingStartedRef.current = false;
        setCountdownText("");
        stopRunTimer();
        setStatusText("Falha ao finalizar");
        Alert.alert("Erro", e?.message ?? "Falha ao finalizar o teste.");
      } finally {
        finishingRef.current = false;
      }
    },
    [participant]
  );

  const startTest = useCallback(async () => {
    try {
      cancelledRef.current = false;
      finishingRef.current = false;
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
      setStatusText("Preparando teste...");
      setCountdownText("Prepare-se");

      await speak("Prepare-se");
      if (cancelledRef.current) return;

      setCountdownText("3");
      await speak("3");
      if (cancelledRef.current) return;

      setCountdownText("2");
      const speechTwoPromise = speak("2");

      await imuStart(SAMPLE_HZ);
      setRecordingStarted(true);
      recordingStartedRef.current = true;
      setPhase("running");
      setStatusText("Coletando dados...");
      startRunTimer();

      finishTimeoutRef.current = setTimeout(() => {
        finalizeCapture("auto");
      }, RECORD_MS);

      await speechTwoPromise;
      if (cancelledRef.current) return;

      setCountdownText("1");
      await speak("1");
      if (cancelledRef.current) return;

      setCountdownText("Começa");
      await speak("Começa");
      if (cancelledRef.current) return;

      setCountdownText("");
    } catch (e: any) {
      clearFinishTimeout();
      stopRunTimer();
      setRecordingStarted(false);
      recordingStartedRef.current = false;
      setPhase("idle");
      setStatusText("Falha ao iniciar");
      setCountdownText("");
      Alert.alert("Erro", e?.message ?? "Falha ao iniciar o teste.");
    }
  }, [finalizeCapture]);

  const stopTest = useCallback(async () => {
    cancelledRef.current = true;
    clearFinishTimeout();

    if (recordingStartedRef.current) {
      await finalizeCapture("manual");
      return;
    }

    stopSpeechSafely();
    stopRunTimer();
    setPhase("idle");
    setStatusText("Teste cancelado");
    setCountdownText("");
  }, [finalizeCapture]);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      clearFinishTimeout();
      stopSpeechSafely();
      stopRunTimer();
    };
  }, []);

  const goToResults = () => {
    if (!result || !jsonUri || !participant) return;

    nav.navigate(Routes.Test_SentarLevantar_Result, {
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
      <View>
        <T style={{ fontSize: 22, fontWeight: "900", marginTop: 18 }}>Sentar e levantar</T>
        <T style={{ marginTop: 4, opacity: 0.7 }}>Participante: {participant?.name ?? "—"}</T>
      </View>

      <View style={{ alignItems: "center", justifyContent: "center", flex: 1 }}>
        {!!countdownText && (
          <T style={{ fontSize: 42, fontWeight: "900", marginBottom: 16 }}>{countdownText}</T>
        )}

        <T style={{ fontSize: 18, opacity: 0.8, marginBottom: 16 }}>{statusText}</T>

        {(phase === "running" || phase === "finished") && (
          <View style={{ width: "100%", marginBottom: 20 }}>
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
              {Math.round(progress * 100)}% concluído
            </T>
          </View>
        )}

        {!showFinishButton ? (
          <ThemedButton title="Iniciar teste" onPress={startTest} style={{ minWidth: 220 }} />
        ) : (
          <ThemedButton
            title="Finalizar teste"
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
            <T>% 58–62 Hz: {result.stats.pctIn58to62?.toFixed(1) ?? "—"}%</T>
            <T>Sessão: {jsonSessionNumber != null ? `S${jsonSessionNumber}` : "—"}</T>
          </View>
        )}

        {showGoToResults && <ThemedButton title="Ir para resultados" onPress={goToResults} />}
      </View>
    </Screen>
  );
}