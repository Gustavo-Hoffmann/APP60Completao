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
        testTitle: "Sentar e levantar",
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
      Alert.alert("Massa inválida", "Digite a massa em kg.");
      return;
    }

    if (parsedHeightCm == null || parsedHeightCm <= 0) {
      Alert.alert("Estatura inválida", "Digite a estatura em cm.");
      return;
    }

    setBodyMassInput(formatDecimalInput(parsedBodyMassKg));
    setHeightInput(formatDecimalInput(parsedHeightCm));
    setAnthropometryConfirmed(true);
    setAnthropometryModalVisible(false);
  }, [parsedBodyMassKg, parsedHeightCm]);

  const ensureAnthropometryReady = useCallback(() => {
    if (!participant) {
      Alert.alert("Erro", "Participante ausente.");
      return false;
    }

    if (parsedBodyMassKg == null || parsedBodyMassKg <= 0) {
      Alert.alert("Massa obrigatória", "Informe uma massa válida em kg antes de iniciar.");
      setAnthropometryModalVisible(true);
      return false;
    }

    if (parsedHeightCm == null || parsedHeightCm <= 0) {
      Alert.alert("Estatura obrigatória", "Informe uma estatura válida em cm antes de iniciar.");
      setAnthropometryModalVisible(true);
      return false;
    }

    if (!anthropometryConfirmed) {
      Alert.alert("Confirme os dados", "Confirme massa e estatura antes de iniciar.");
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
        stopSpeechSafely();

        if (!recordingStartedRef.current) {
          setPhase("idle");
          setStatusText("Falha ao finalizar: coleta não iniciou");
          setCountdownText("");
          return;
        }

        if (!participantForTest) {
          throw new Error("Participante ausente no fim da coleta.");
        }

        const r = await imuStop();

        if (!r?.samples || r.samples.length === 0) {
          throw new Error("A coleta retornou sem amostras.");
        }

        const nextSession = await getNextSessionNumber(String(participantForTest.id), "SL30S");
        const saved = await saveSl30sJsonToCache(r, participantForTest, nextSession);

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
    [participantForTest]
  );

  const startTest = useCallback(async () => {
    try {
      if (!ensureAnthropometryReady() || !participantForTest) return;

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
  }, [ensureAnthropometryReady, finalizeCapture, participantForTest]);

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
    if (!result || !jsonUri || !participantForTest) return;

    nav.navigate(Routes.Test_SentarLevantar_Result, {
      participant: participantForTest,
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
        <T style={{ marginTop: 4, opacity: 0.7 }}>
          Massa: {formatMassDisplay(parsedBodyMassKg)} · Estatura: {formatHeightDisplay(parsedHeightCm)}
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
          <View style={{ alignItems: "center", gap: 12 }}>
            <ThemedButton title="Iniciar teste" onPress={startTest} style={{ minWidth: 220 }} />
            <Pressable style={styles.secondaryButton} onPress={() => setAnthropometryModalVisible(true)}>
              <T style={styles.secondaryButtonText}>
                {anthropometryConfirmed ? "Editar massa e estatura" : "Informar massa e estatura"}
              </T>
            </Pressable>
          </View>
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
            <T>Massa: {formatMassDisplay(parsedBodyMassKg)}</T>
            <T>Estatura: {formatHeightDisplay(parsedHeightCm)}</T>
            <T>Sessão: {jsonSessionNumber != null ? `S${jsonSessionNumber}` : "—"}</T>
          </View>
        )}

        {showGoToResults && <ThemedButton title="Ir para resultados" onPress={goToResults} />}
      </View>

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
              <T style={styles.modalTitle}>Dados antropométricos</T>
              <T style={styles.modalSubtitle}>
                Informe massa e estatura do participante antes da coleta.
              </T>

              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={styles.inputBlock}>
                  <T style={styles.inputLabel}>Participante</T>
                  <View style={styles.readOnlyField}>
                    <T style={styles.readOnlyFieldText}>{participant?.name ?? "—"}</T>
                  </View>
                </View>

                <View style={styles.inputBlock}>
                  <T style={styles.inputLabel}>Massa (kg)</T>
                  <TextInput
                    value={bodyMassInput}
                    onChangeText={setBodyMassInput}
                    keyboardType="decimal-pad"
                    placeholder="Ex.: 72.4"
                    placeholderTextColor="#94A3B8"
                    style={styles.input}
                    editable={phase === "idle" || phase === "finished"}
                  />
                </View>

                <View style={styles.inputBlock}>
                  <T style={styles.inputLabel}>Estatura (cm)</T>
                  <TextInput
                    value={heightInput}
                    onChangeText={setHeightInput}
                    keyboardType="decimal-pad"
                    placeholder="Ex.: 175"
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
                      <T style={styles.modalSecondaryButtonText}>Fechar</T>
                    </Pressable>
                  )}

                  <Pressable style={styles.modalPrimaryButton} onPress={confirmAnthropometry}>
                    <T style={styles.modalPrimaryButtonText}>Salvar</T>
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
