import React, { useLayoutEffect, useMemo, useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as Sharing from "expo-sharing";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";

import { T } from "../../../components/Themed";
import { ThemedButton } from "../../../components/ThemedButton";
import type { Participant } from "../../../models/types";
import type { NativeImuStopResult } from "../../../services/sensors/nativeImu";
import { uploadTugJsonToSupabase } from "../../../services/tests/uploadTestJson";

type Params = {
  participant: Participant & {
    biologicalSex?: string;
    sex?: string;
    gender?: string;
    sexo?: string;
    birthDate?: string;
    dob?: string;
  };
  result: NativeImuStopResult;
  jsonUri: string;
  sessionNumber?: number;
};

const DEG = 180 / Math.PI;
const FS = 60;

export default function TugResultScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { participant, result, jsonUri, sessionNumber } = route.params as Params;
  const [uploading, setUploading] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions?.({
      title: "TUG",
      headerStyle: {
        backgroundColor: "#0B63F6",
        borderBottomWidth: 0,
        elevation: 0,
        shadowOpacity: 0,
        shadowColor: "transparent",
        borderBottomColor: "transparent",
      },
      contentStyle: {
        backgroundColor: "#F3F5F8",
      },
      headerTintColor: "#FFFFFF",
      headerTitleStyle: {
        color: "#FFFFFF",
        fontWeight: "800",
      },
      headerShadowVisible: false,
      headerBackTitleVisible: false,
      headerBackTitle: "",
      headerBackButtonDisplayMode: "minimal",
      headerTitleAlign: "center",
    });
  }, [navigation]);

  const age = useMemo(() => calcAge(participant?.dob ?? participant?.birthDate), [participant]);
  const displaySex = useMemo(
    () =>
      formatSexLabel(
        participant?.biologicalSex ??
          participant?.sex ??
          participant?.gender ??
          participant?.sexo
      ),
    [participant]
  );

  const analysis = useMemo(() => analyzeTug(result), [result]);

  const shareJson = async () => {
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert("Compartilhar", "Compartilhamento não disponível neste aparelho.");
        return;
      }

      await Sharing.shareAsync(jsonUri, {
        mimeType: "application/json",
        dialogTitle: "Compartilhar JSON do teste",
        UTI: Platform.OS === "ios" ? "public.json" : undefined,
      });
    } catch (e: any) {
      Alert.alert("Erro", e?.message ?? "Falha ao compartilhar JSON.");
    }
  };

  const handleUploadCloud = async () => {
    try {
      if (uploading) return;

      setUploading(true);
      const sent = await uploadTugJsonToSupabase(result, participant);

      Alert.alert(
        "Upload concluído",
        `☁️ Dados enviados com sucesso.\nSessão: S${sent.sessionNumber}\nCaminho: ${sent.path}`
      );
    } catch (e: any) {
      Alert.alert("Erro no upload", e?.message ?? "Falha ao enviar dados para a nuvem.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { flexGrow: 1 }]}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
      >
        <ParticipantCard
          name={participant?.name ?? "—"}
          age={age != null ? `${age} anos` : "—"}
          sex={displaySex}
        />

        <InfoCard
          title="Resumo do teste"
          subtitle="Início detectado quando sai da posição inicial. Fim detectado no último pico antes da estabilização final."
        >
          <MetricTable
            rows={[
              {
                label: "Tempo TUG",
                value:
                  analysis.tugDurationSec != null
                    ? `${analysis.tugDurationSec.toFixed(3)} s`
                    : "Não detectado",
              },
              {
                label: "Início detectado",
                value: analysis.startSec != null ? `${analysis.startSec.toFixed(3)} s` : "—",
              },
              {
                label: "Fim detectado",
                value: analysis.endSec != null ? `${analysis.endSec.toFixed(3)} s` : "—",
              },
              {
                label: "Motivo da parada",
                value: humanStopReason(result?.tug?.stopReason),
              },
              {
                label: "Tempo total gravado",
                value:
                  analysis.totalRecordedSec != null
                    ? `${analysis.totalRecordedSec.toFixed(3)} s`
                    : "—",
              },
              {
                label: "Sessão",
                value: sessionNumber != null ? `S${sessionNumber}` : "—",
              },
            ]}
          />
        </InfoCard>

        {analysis.chart.time.length > 2 && (
          <View style={styles.chartSection}>
            <View style={styles.chartHeader}>
              <T style={styles.chartEyebrow}>Sinal analisado</T>
              <T style={styles.chartTitle}>TUG – Norma da velocidade angular filtrada (°/s)</T>
            </View>

            <BluePeakChart
              time={analysis.chart.time}
              values={analysis.chart.values}
              startSec={analysis.startSec}
              endSec={analysis.endSec}
              firstPeakIndex={analysis.firstPeakIndex}
              lastPeakIndex={analysis.lastPeakIndex}
            />
          </View>
        )}

        <View style={styles.buttonWrap}>
          <ThemedButton
            title={`Compartilhar JSON${sessionNumber ? ` • S${sessionNumber}` : ""}`}
            onPress={shareJson}
          />
        </View>

        <View style={styles.buttonWrap}>
          <ThemedButton
            title={uploading ? "☁️ Enviando..." : "☁️ Enviar para nuvem"}
            onPress={handleUploadCloud}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function analyzeTug(result: NativeImuStopResult) {
  const rows = result?.samples ?? [];

  if (rows.length < 2) {
    return {
      totalRecordedSec: null as number | null,
      tugDurationSec: null as number | null,
      startSec: null as number | null,
      endSec: null as number | null,
      firstPeakIndex: null as number | null,
      lastPeakIndex: null as number | null,
      chart: { time: [] as number[], values: [] as number[] },
    };
  }

  const t0 = Number(rows[0][0] ?? 0);

  const time = rows.map((r) => (Number(r[0] ?? 0) - t0) / 1000);

  const gyroNorm = rows.map((r) => {
    const gx = Number(r[4] ?? 0) * DEG;
    const gy = Number(r[5] ?? 0) * DEG;
    const gz = Number(r[6] ?? 0) * DEG;
    return Math.sqrt(gx * gx + gy * gy + gz * gz);
  });

  const filtered = lowPassZeroPhaseEMA(gyroNorm, FS, 3.5);

  const nativeStartSec =
    typeof result?.tug?.startDetectedMs === "number" ? result.tug.startDetectedMs / 1000 : null;

  const nativeEndSec =
    typeof result?.tug?.endDetectedMs === "number" ? result.tug.endDetectedMs / 1000 : null;

  const allPeaks = detectPeaks(filtered, 30, 18);

  const peaksAfterStart = allPeaks.filter((idx) => {
    const t = time[idx];
    if (nativeStartSec != null && t < nativeStartSec) return false;
    return true;
  });

  const firstPeakIndex = peaksAfterStart.length ? peaksAfterStart[0] : null;

  let lastPeakIndex: number | null = null;

  if (nativeEndSec != null) {
    const peaksBeforeNativeEnd = peaksAfterStart.filter((idx) => time[idx] <= nativeEndSec);
    lastPeakIndex = peaksBeforeNativeEnd.length
      ? peaksBeforeNativeEnd[peaksBeforeNativeEnd.length - 1]
      : null;
  } else {
    lastPeakIndex = peaksAfterStart.length ? peaksAfterStart[peaksAfterStart.length - 1] : null;
  }

  const startSec = nativeStartSec;
  const endSec = lastPeakIndex != null ? time[lastPeakIndex] : nativeEndSec;

  const tugDurationSec =
    startSec != null && endSec != null && endSec >= startSec ? endSec - startSec : null;

  const totalRecordedSec = time.length ? time[time.length - 1] : null;

  return {
    totalRecordedSec,
    tugDurationSec,
    startSec,
    endSec,
    firstPeakIndex,
    lastPeakIndex,
    chart: {
      time,
      values: filtered,
    },
  };
}

function lowPassZeroPhaseEMA(signal: number[], fs: number, cutoffHz: number) {
  if (signal.length === 0) return [];
  if (signal.length === 1) return [...signal];

  const dt = 1 / fs;
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const alpha = dt / (rc + dt);

  const forward = ema(signal, alpha);
  const reversed = [...forward].reverse();
  const backward = ema(reversed, alpha).reverse();

  return backward;
}

function ema(signal: number[], alpha: number) {
  const out = new Array(signal.length);
  out[0] = signal[0];

  for (let i = 1; i < signal.length; i++) {
    out[i] = alpha * signal[i] + (1 - alpha) * out[i - 1];
  }

  return out;
}

function detectPeaks(signal: number[], threshold: number, minDistance: number) {
  const peaks: number[] = [];
  if (signal.length < 3) return peaks;

  for (let i = 1; i < signal.length - 1; i++) {
    const y = signal[i];
    if (y < threshold) continue;

    const left = signal[i - 1];
    const right = signal[i + 1];
    const isLocalMax = y >= left && y >= right && (y > left || y > right);
    if (!isLocalMax) continue;

    const lastPeak = peaks.length ? peaks[peaks.length - 1] : null;
    if (lastPeak != null && i - lastPeak < minDistance) {
      if (y > signal[lastPeak]) peaks[peaks.length - 1] = i;
    } else {
      peaks.push(i);
    }
  }

  return peaks;
}

function humanStopReason(reason?: string) {
  switch (reason) {
    case "manual":
      return "Interrupção manual";
    case "auto_finish":
      return "Conclusão automática";
    default:
      return reason || "—";
  }
}

function calcAge(dobISO?: string) {
  if (!dobISO) return null;

  const raw = String(dobISO).trim();
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (br) {
    const [, dd, mm, yyyy] = br;
    return calcAgeFromDate(new Date(Number(yyyy), Number(mm) - 1, Number(dd)));
  }

  return calcAgeFromDate(new Date(raw));
}

function calcAgeFromDate(dob: Date) {
  if (Number.isNaN(dob.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();

  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }

  if (age < 0 || age > 120) return null;
  return age;
}

function normalizeSex(value?: string | null): "M" | "F" | null {
  if (!value) return null;
  const s = String(value).trim().toUpperCase();
  if (["M", "MASCULINO", "HOMEM", "MALE"].includes(s)) return "M";
  if (["F", "FEMININO", "MULHER", "FEMALE"].includes(s)) return "F";
  return null;
}

function formatSexLabel(value?: string | null) {
  const normalized = normalizeSex(value);
  if (normalized === "M") return "Masculino";
  if (normalized === "F") return "Feminino";
  return value?.trim() || "—";
}

function getInitials(name?: string | null) {
  const base = String(name ?? "").trim();
  if (!base || base === "—") return "P";
  const parts = base.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return `${first}${last}`.toUpperCase();
}

function ParticipantCard({
  name,
  age,
  sex,
}: {
  name: string;
  age: string;
  sex: string;
}) {
  return (
    <View style={[styles.card, styles.participantCard]}>
      <View style={styles.participantHeader}>
        <View style={styles.avatar}>
          <T style={styles.avatarText}>{getInitials(name)}</T>
        </View>

        <View style={styles.participantHeaderText}>
          <T style={styles.participantOverline}>Participante</T>
          <T style={styles.participantName}>{name}</T>
        </View>
      </View>

      <View style={styles.pillRow}>
        <StatPill label="Idade" value={age} />
        <StatPill label="Sexo" value={sex} />
      </View>
    </View>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.pill}>
      <T style={styles.pillLabel}>{label}</T>
      <T style={styles.pillValue}>{value}</T>
    </View>
  );
}

function InfoCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <T style={styles.cardTitle}>{title}</T>
        {subtitle ? <T style={styles.cardSubtitle}>{subtitle}</T> : null}
      </View>
      {children}
    </View>
  );
}

function MetricTable({ rows }: { rows: Array<{ label: string; value: string }> }) {
  return (
    <View style={styles.tableWrap}>
      {rows.map((row, idx) => (
        <View
          key={`${row.label}-${idx}`}
          style={[styles.tableRow, idx === rows.length - 1 && styles.tableRowLast]}
        >
          <T style={styles.tableLabel}>{row.label}</T>
          <T style={styles.tableValue}>{row.value}</T>
        </View>
      ))}
    </View>
  );
}

function BluePeakChart({
  time,
  values,
  startSec,
  endSec,
  firstPeakIndex,
  lastPeakIndex,
}: {
  time: number[];
  values: number[];
  startSec: number | null;
  endSec: number | null;
  firstPeakIndex: number | null;
  lastPeakIndex: number | null;
}) {
  const width = 340;
  const height = 278;
  const padL = 64;
  const padR = 16;
  const padT = 24;
  const padB = 50;

  const xMin = 0;
  const xMax = Math.max(time[time.length - 1] ?? 1, 1);

  const rawMinY = Math.min(...values);
  const rawMaxY = Math.max(...values);
  const padY = Math.max((rawMaxY - rawMinY) * 0.07, 14);

  const yMin = rawMinY - padY;
  const yMax = rawMaxY + padY;
  const yRange = Math.max(yMax - yMin, 1);

  const xToPx = (x: number) =>
    padL + ((x - xMin) / Math.max(xMax - xMin, 1e-6)) * (width - padL - padR);
  const yToPx = (y: number) =>
    height - padB - ((y - yMin) / yRange) * (height - padT - padB);

  const lineD = values
    .map((y, i) => `${i === 0 ? "M" : "L"} ${xToPx(time[i]).toFixed(2)} ${yToPx(y).toFixed(2)}`)
    .join(" ");

  const yTicks = [yMin, (yMin + yMax) / 2, yMax];
  const tickStep = xMax <= 5 ? 0.5 : xMax <= 15 ? 1 : 2;
  const xTicks: number[] = [];
  for (let x = 0; x <= xMax + 1e-9; x += tickStep) xTicks.push(Number(x.toFixed(1)));

  const yAxisTitleX = 18;
  const yAxisTitleY = height / 2;

  return (
    <View style={{ width, alignSelf: "center" }}>
      <Svg width={width} height={height}>
        <Line x1={padL} y1={padT} x2={padL} y2={height - padB} stroke="#7A869A" strokeWidth={1} />
        <Line
          x1={padL}
          y1={height - padB}
          x2={width - padR}
          y2={height - padB}
          stroke="#7A869A"
          strokeWidth={1}
        />

        {xTicks.map((tick) => (
          <React.Fragment key={`x-${tick}`}>
            <Line
              x1={xToPx(tick)}
              y1={height - padB}
              x2={xToPx(tick)}
              y2={height - padB + 5}
              stroke="#7A869A"
              strokeWidth={1}
            />
            <SvgText
              x={xToPx(tick)}
              y={height - 22}
              fontSize="10"
              fill="#8E98A8"
              textAnchor="middle"
            >
              {tick}
            </SvgText>
          </React.Fragment>
        ))}

        {yTicks.map((tick, idx) => (
          <React.Fragment key={`y-${idx}`}>
            <Line
              x1={padL - 5}
              y1={yToPx(tick)}
              x2={padL}
              y2={yToPx(tick)}
              stroke="#7A869A"
              strokeWidth={1}
            />
            <SvgText
              x={padL - 8}
              y={yToPx(tick) + 3}
              fontSize="10"
              fill="#8E98A8"
              textAnchor="end"
            >
              {tick.toFixed(0)}
            </SvgText>
          </React.Fragment>
        ))}

        <Path d={lineD} stroke="#2A7BFF" strokeWidth={2.8} fill="none" />

        {startSec != null && (
          <>
            <Line
              x1={xToPx(startSec)}
              y1={padT}
              x2={xToPx(startSec)}
              y2={height - padB}
              stroke="#22C55E"
              strokeWidth={2}
              strokeDasharray="8 6"
            />
            <SvgText
              x={xToPx(startSec)}
              y={16}
              fontSize="11"
              fill="#111827"
              textAnchor="middle"
              fontWeight="700"
            >
              Início
            </SvgText>
          </>
        )}

        {endSec != null && (
          <>
            <Line
              x1={xToPx(endSec)}
              y1={padT}
              x2={xToPx(endSec)}
              y2={height - padB}
              stroke="#EF4444"
              strokeWidth={2}
              strokeDasharray="8 6"
            />
            <SvgText
              x={xToPx(endSec)}
              y={16}
              fontSize="11"
              fill="#111827"
              textAnchor="middle"
              fontWeight="700"
            >
              Fim
            </SvgText>
          </>
        )}

        {firstPeakIndex != null && (
          <>
            <Circle cx={xToPx(time[firstPeakIndex])} cy={yToPx(values[firstPeakIndex])} r={5.8} fill="#000" />
            <Circle cx={xToPx(time[firstPeakIndex])} cy={yToPx(values[firstPeakIndex])} r={2.9} fill="#FFF" />
          </>
        )}

        {lastPeakIndex != null && lastPeakIndex !== firstPeakIndex && (
          <>
            <Circle cx={xToPx(time[lastPeakIndex])} cy={yToPx(values[lastPeakIndex])} r={5.8} fill="#000" />
            <Circle cx={xToPx(time[lastPeakIndex])} cy={yToPx(values[lastPeakIndex])} r={2.9} fill="#FFF" />
          </>
        )}

        <SvgText x={width / 2} y={height - 5} fontSize="11" fill="#8E98A8" textAnchor="middle">
          Tempo (s)
        </SvgText>

        <SvgText
          x={yAxisTitleX}
          y={yAxisTitleY}
          fontSize="11"
          fill="#8E98A8"
          textAnchor="middle"
          transform={`rotate(-90, ${yAxisTitleX}, ${yAxisTitleY})`}
        >
          |ω| (°/s)
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F3F5F8" },
  scroll: { flex: 1, backgroundColor: "#F3F5F8" },
  content: {
    paddingHorizontal: 8,
    paddingTop: 0,
    paddingBottom: 30,
    gap: 14,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "#E9EDF4",
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  participantCard: {
    paddingTop: 14,
    paddingBottom: 14,
  },
  participantHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  participantHeaderText: {
    flex: 1,
    gap: 2,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#EAF2FF",
    borderWidth: 1,
    borderColor: "#CFE0FF",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1456D9",
  },
  participantOverline: {
    fontSize: 12,
    fontWeight: "800",
    color: "#6E7A89",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  participantName: {
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 28,
  },
  pillRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  pill: {
    flex: 1,
    backgroundColor: "#F7F9FC",
    borderWidth: 1,
    borderColor: "#E9EEF5",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 2,
  },
  pillLabel: {
    fontSize: 12,
    color: "#708092",
  },
  pillValue: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
  },
  cardHeader: {
    marginBottom: 12,
    gap: 3,
  },
  cardTitle: {
    fontSize: 21,
    fontWeight: "900",
    lineHeight: 27,
  },
  cardSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: "#6D7887",
  },
  chartSection: {
    gap: 8,
  },
  chartHeader: {
    gap: 2,
    paddingHorizontal: 2,
  },
  chartEyebrow: {
    fontSize: 12,
    fontWeight: "800",
    color: "#6E7A89",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  chartTitle: {
    fontSize: 21,
    fontWeight: "900",
    lineHeight: 27,
  },
  tableWrap: {
    borderWidth: 1,
    borderColor: "#E9EDF4",
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#FBFCFE",
  },
  tableRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
    backgroundColor: "#FBFCFE",
    gap: 12,
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  tableLabel: {
    flex: 1.35,
    fontSize: 14,
    lineHeight: 19,
    color: "#3B4754",
  },
  tableValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 19,
    textAlign: "right",
    color: "#101828",
  },
  buttonWrap: {
    marginTop: 2,
  },
});