import React, { useLayoutEffect, useMemo, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as Sharing from "expo-sharing";
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from "react-native-svg";

import { T } from "../../../components/Themed";
import { ThemedButton } from "../../../components/ThemedButton";
import type { Participant } from "../../../models/types";
import type { NativeImuStopResult } from "../../../services/sensors/nativeImu";
import { uploadMarchaJsonToSupabase } from "../../../services/tests/uploadTestJson";

type Params = {
  participant: Participant & {
    biologicalSex?: string;
    sex?: string;
    gender?: string;
    sexo?: string;
    birthDate?: string;
  };
  result: NativeImuStopResult;
  jsonUri: string;
  sessionNumber?: number;
};

type TrendLabel = "Descendente" | "Ascendente" | "Constante" | "—";

type NormDisplayRow = {
  label: string;
  valueText: string;
  isMatch: boolean;
};

type AnalysisResult = {
  time: number[];
  signalDeg: number[];
  peakPosIndices: number[];
  peakNegIndices: number[];
  cycles: number;
  cadence: number;
  startSec: number;
  endSec: number;
  delta: number | null;
  deltaLabel: string;
  strategy: TrendLabel;
  meanFirst20: number | null;
  meanLast20: number | null;
  percentileLabel: string;
  percentileApprox: number | null;
  ageBinLabel: string;
  adjusted120Steps: number | null;
  normRows: NormDisplayRow[];
};

const DEG = 180 / Math.PI;
const DT = 1 / 60;
const REC_WIN = 124.0;
const TREND_THRESH = 11.46;
const SAVGOL_WINDOW = 131;
const SAVGOL_POLY = 5;
const PEAK_HEIGHT_POS = 70.0;
const PEAK_HEIGHT_NEG = 70.0;
const PEAK_DISTANCE = 10;

type NormRow = Record<number, number>;
type SexKey = "M" | "F";

const AGE_BINS = ["60-64", "65-69", "70-74", "75-79", "80-84", "85-89", "90+"];

const NORM_2MST: Record<SexKey, Record<string, NormRow>> = {
  F: {
    "60-64": { 10: 60, 25: 75, 50: 91, 75: 107, 90: 122 },
    "65-69": { 10: 57, 25: 73, 50: 90, 75: 107, 90: 123 },
    "70-74": {
      95: 106,
      90: 101,
      85: 97,
      80: 94,
      75: 91,
      70: 88,
      65: 84,
      60: 81,
      55: 77,
      50: 73,
      45: 70,
      40: 67,
      35: 64,
      30: 62,
      25: 61,
      20: 60,
      15: 59,
      10: 58,
      5: 55,
    },
    "75-79": {
      95: 103,
      90: 99,
      85: 96,
      80: 92,
      75: 89,
      70: 86,
      65: 82,
      60: 79,
      55: 74,
      50: 71,
      45: 68,
      40: 65,
      35: 62,
      30: 61,
      25: 60,
      20: 59,
      15: 58,
      10: 56,
      5: 51,
    },
    "80-84": {
      95: 95,
      90: 89,
      85: 84,
      80: 80,
      75: 76,
      70: 72,
      65: 68,
      60: 65,
      55: 63,
      50: 61,
      45: 60,
      40: 59,
      35: 57,
      30: 56,
      25: 54,
      20: 52,
      15: 50,
      10: 46,
      5: 43,
    },
    "85-89": {
      95: 67,
      90: 63,
      85: 61,
      80: 60,
      75: 58,
      70: 56,
      65: 55,
      60: 54,
      55: 51,
      50: 50,
      45: 48,
      40: 47,
      35: 45,
      30: 44,
      25: 43,
      20: 41,
      15: 40,
      10: 38,
      5: 37,
    },
    "90+": {
      95: 58,
      90: 56,
      85: 54,
      80: 52,
      75: 49,
      70: 47,
      65: 46,
      60: 44,
      55: 43,
      50: 42,
      45: 40,
      40: 39,
      35: 38,
      30: 35,
      25: 34,
      20: 33,
      15: 32,
      10: 31,
      5: 31,
    },
  },
  M: {
    "60-64": { 10: 74, 25: 87, 50: 104, 75: 115, 90: 128 },
    "65-69": { 10: 72, 25: 86, 50: 104, 75: 116, 90: 130 },
    "70-74": {
      95: 124,
      90: 121,
      85: 119,
      80: 116,
      75: 111,
      70: 106,
      65: 101,
      60: 97,
      55: 94,
      50: 91,
      45: 87,
      40: 84,
      35: 80,
      30: 77,
      25: 73,
      20: 70,
      15: 68,
      10: 65,
      5: 59,
    },
    "75-79": {
      95: 112,
      90: 107,
      85: 102,
      80: 98,
      75: 94,
      70: 91,
      65: 88,
      60: 84,
      55: 81,
      50: 78,
      45: 73,
      40: 70,
      35: 68,
      30: 65,
      25: 63,
      20: 62,
      15: 60,
      10: 60,
      5: 56,
    },
    "80-84": {
      95: 100,
      90: 96,
      85: 92,
      80: 88,
      75: 85,
      70: 82,
      65: 79,
      60: 74,
      55: 70,
      50: 67,
      45: 64,
      40: 62,
      35: 61,
      30: 60,
      25: 58,
      20: 56,
      15: 55,
      10: 53,
      5: 47,
    },
    "85-89": {
      95: 86,
      90: 84,
      85: 80,
      80: 78,
      75: 74,
      70: 70,
      65: 66,
      60: 64,
      55: 61,
      50: 60,
      45: 58,
      40: 56,
      35: 55,
      30: 53,
      25: 51,
      20: 50,
      15: 48,
      10: 46,
      5: 44,
    },
    "90+": {
      95: 76,
      90: 71,
      85: 67,
      80: 66,
      75: 64,
      70: 61,
      65: 60,
      60: 59,
      55: 56,
      50: 54,
      45: 52,
      40: 50,
      35: 48,
      30: 46,
      25: 45,
      20: 43,
      15: 42,
      10: 41,
      5: 39,
    },
  },
};

export default function MarchaEstacionariaResultScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { participant, result, jsonUri, sessionNumber } = route.params as Params;

  useLayoutEffect(() => {
    navigation.setOptions?.({
      title: "Marcha Estacionária",
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
  const sex = useMemo(
    () =>
      normalizeSex(
        participant?.biologicalSex ??
          participant?.sex ??
          participant?.gender ??
          participant?.sexo
      ),
    [participant]
  );

  const displaySex = useMemo(
    () =>
      formatSexLabel(
        participant?.biologicalSex ?? participant?.sex ?? participant?.gender ?? participant?.sexo
      ),
    [participant]
  );

  const analysis = useMemo(() => analyze2MST(result, age, sex), [result, age, sex]);
  const [uploading, setUploading] = useState(false);

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
      const sent = await uploadMarchaJsonToSupabase(result, participant);

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

        {analysis ? (
          <>
            <InfoCard
              title="Resumo do teste"
              subtitle="As métricas principais ficaram mais organizadas e com menos cara de formulário."
            >
              <MetricTable
                rows={[
                  { label: "Ciclos realizados", value: String(analysis.cycles) },
                  { label: "Cadência", value: `${analysis.cadence.toFixed(2)} ciclos/min` },
                  { label: "Δ (20s finais - 20s iniciais)", value: analysis.deltaLabel },
                  { label: "Estratégia", value: analysis.strategy },
                ]}
              />
            </InfoCard>

            <View style={styles.chartSection}>
              <View style={styles.chartHeader}>
                <T style={styles.chartEyebrow}>Sinal analisado</T>
                <T style={styles.chartTitle}>2MST – GX (°/s)</T>
              </View>

              <BluePeakChart
                time={analysis.time}
                values={analysis.signalDeg}
                peakIndices={analysis.peakPosIndices}
              />
            </View>

            <InfoCard
              title="Comparação com a literatura"
              subtitle="Referência por faixa etária e sexo biológico, com destaque exato da faixa do participante."
            >
              <View style={styles.statGrid}>
                <HighlightStatBox label="Faixa etária" value={analysis.ageBinLabel} />
                <HighlightStatBox
                  label="Passos ajustados"
                  value={analysis.adjusted120Steps != null ? String(analysis.adjusted120Steps) : "—"}
                />
              </View>

              {sex && analysis.normRows.length ? (
                <>
                  <View style={styles.badgeRow}>
                    <View style={styles.badge}>
                      <T style={styles.badgeText}>{analysis.percentileLabel}</T>
                    </View>
                    {analysis.percentileApprox != null ? (
                      <T style={styles.badgeSubtext}>
                        Estimativa aproximada: p{analysis.percentileApprox.toFixed(0)}
                      </T>
                    ) : null}
                  </View>

                  <LiteratureTable rows={analysis.normRows} />
                </>
              ) : (
                <T style={styles.emptyText}>
                  Percentil indisponível. Confira se idade e sexo biológico foram cadastrados.
                </T>
              )}
            </InfoCard>
          </>
        ) : (
          <InfoCard title="Resumo do teste">
            <T style={styles.emptyText}>
              Sinal insuficiente para calcular as métricas da marcha estacionária.
            </T>
          </InfoCard>
        )}

        <View style={styles.buttonWrap}>
          <ThemedButton
            title={`Compartilhar CSV${sessionNumber ? ` • S${sessionNumber}` : ""}`}
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

function calcAge(dateStr?: string | null) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();

  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

function normalizeSex(value?: string | null): SexKey | null {
  const s = String(value ?? "")
    .trim()
    .toLowerCase();

  if (!s) return null;
  if (["m", "masculino", "male", "homem"].includes(s)) return "M";
  if (["f", "feminino", "female", "mulher"].includes(s)) return "F";
  return null;
}

function formatSexLabel(value?: string | null) {
  const s = normalizeSex(value);
  if (s === "M") return "Masculino";
  if (s === "F") return "Feminino";
  return "—";
}

function analyze2MST(
  result: NativeImuStopResult,
  age: number | null,
  sex: SexKey | null
): AnalysisResult | null {
  const rows = result?.samples ?? [];
  if (!rows.length) return null;

  const n = rows.length;
  const time = Array.from({ length: n }, (_, i) => i * DT);
  const gxDeg = rows.map((r) => Number(r[7] ?? 0) * DEG);

  const maxSec = Math.min(last(time) ?? REC_WIN, REC_WIN);
  const validEndIdx = time.findIndex((t) => t > maxSec);
  const cutIdx = validEndIdx === -1 ? n : validEndIdx;

  const timeCut = time.slice(0, cutIdx);
  const signalCut = gxDeg.slice(0, cutIdx);

  if (timeCut.length < 10) return null;

  const smooth = savgol(signalCut, SAVGOL_WINDOW, SAVGOL_POLY);
  const peakPos = findPeaksSimple(smooth, PEAK_HEIGHT_POS, PEAK_DISTANCE);
  const peakNeg = findPeaksSimple(smooth.map((v) => -v), PEAK_HEIGHT_NEG, PEAK_DISTANCE);

  const cycles = peakPos.length;
  const cadence = cycles > 0 ? (cycles / (last(timeCut) || 1)) * 60 : 0;

  const firstIdx = peakPos.filter((idx) => timeCut[idx] <= 20);
  const lastIdx20 = peakPos.filter((idx) => timeCut[idx] >= Math.max((last(timeCut) ?? 0) - 20, 0));

  const meanFirst20 =
    firstIdx.length > 0 ? firstIdx.reduce((acc, idx) => acc + smooth[idx], 0) / firstIdx.length : null;
  const meanLast20 =
    lastIdx20.length > 0
      ? lastIdx20.reduce((acc, idx) => acc + smooth[idx], 0) / lastIdx20.length
      : null;

  const delta =
    meanFirst20 != null && meanLast20 != null ? Number((meanLast20 - meanFirst20).toFixed(2)) : null;

  let strategy: TrendLabel = "—";
  if (delta != null) {
    if (delta <= -TREND_THRESH) strategy = "Descendente";
    else if (delta >= TREND_THRESH) strategy = "Ascendente";
    else strategy = "Constante";
  }

  const adjusted120Steps = cycles;
  const ageBinLabel = resolveAgeBin(age);
  const normRows = buildNormRows(sex, ageBinLabel);
  const { percentileLabel, percentileApprox } = estimatePercentile(sex, ageBinLabel, adjusted120Steps);

  return {
    time: timeCut,
    signalDeg: smooth,
    peakPosIndices: peakPos,
    peakNegIndices: peakNeg,
    cycles,
    cadence,
    startSec: 0,
    endSec: Number((last(timeCut) ?? 0).toFixed(2)),
    delta,
    deltaLabel: delta != null ? `${delta > 0 ? "+" : ""}${delta.toFixed(2)} °/s` : "—",
    strategy,
    meanFirst20,
    meanLast20,
    percentileLabel,
    percentileApprox,
    ageBinLabel,
    adjusted120Steps,
    normRows,
  };
}
function resolveAgeBin(age: number | null) {
  if (age == null) return "—";
  if (age < 60) return "60-64";
  if (age <= 64) return "60-64";
  if (age <= 69) return "65-69";
  if (age <= 74) return "70-74";
  if (age <= 79) return "75-79";
  if (age <= 84) return "80-84";
  if (age <= 89) return "85-89";
  return "90+";
}

function buildNormRows(sex: SexKey | null, ageBin: string): NormDisplayRow[] {
  if (!sex) return [];

  const rows = NORM_2MST[sex]?.[ageBin];
  if (!rows) return [];

  const percentiles = Object.keys(rows)
    .map(Number)
    .sort((a, b) => b - a);

  return percentiles.map((p) => ({
    label: `p${p}`,
    valueText: String(rows[p]),
    isMatch: false,
  }));
}

function estimatePercentile(sex: SexKey | null, ageBin: string, steps: number | null) {
  if (!sex || steps == null) {
    return {
      percentileLabel: "Percentil indisponível",
      percentileApprox: null as number | null,
    };
  }

  const rows = NORM_2MST[sex]?.[ageBin];
  if (!rows) {
    return {
      percentileLabel: "Percentil indisponível",
      percentileApprox: null as number | null,
    };
  }

  const percentiles = Object.keys(rows)
    .map(Number)
    .sort((a, b) => a - b);

  if (!percentiles.length) {
    return {
      percentileLabel: "Percentil indisponível",
      percentileApprox: null as number | null,
    };
  }

  const pairs = percentiles.map((p) => ({ p, value: rows[p] })).sort((a, b) => a.value - b.value);

  if (steps <= pairs[0].value) {
    return {
      percentileLabel: `Abaixo de p${pairs[0].p}`,
      percentileApprox: pairs[0].p,
    };
  }

  const lastPair = pairs[pairs.length - 1];
  if (steps >= lastPair.value) {
    return {
      percentileLabel: `Acima de p${lastPair.p}`,
      percentileApprox: lastPair.p,
    };
  }

  for (let i = 0; i < pairs.length - 1; i += 1) {
    const a = pairs[i];
    const b = pairs[i + 1];
    if (steps >= a.value && steps <= b.value) {
      const frac = (steps - a.value) / Math.max(b.value - a.value, 1e-9);
      const pApprox = a.p + frac * (b.p - a.p);

      return {
        percentileLabel: `Entre p${a.p} e p${b.p}`,
        percentileApprox: pApprox,
      };
    }
  }

  return {
    percentileLabel: "Percentil indisponível",
    percentileApprox: null as number | null,
  };
}

function savgol(values: number[], window: number, poly: number) {
  if (values.length < 5) return values.slice();
  const w = Math.max(5, window % 2 === 1 ? window : window + 1);
  const half = Math.floor(w / 2);

  if (poly !== 5 || w !== 31) {
    return movingAverage(values, Math.min(w, 9));
  }

  const coeffs = [
    -36, 9, 44, 69, 84, 89, 84, 69, 44, 9, -36, -81, -116, -141, -156, -161, -156, -141,
    -116, -81, -36, 9, 44, 69, 84, 89, 84, 69, 44, 9, -36,
  ];

  const denom = 429;
  const out: number[] = new Array(values.length);

  for (let i = 0; i < values.length; i += 1) {
    if (i < half || i >= values.length - half) {
      out[i] = values[i];
      continue;
    }

    let acc = 0;
    for (let k = -half; k <= half; k += 1) {
      acc += coeffs[k + half] * values[i + k];
    }
    out[i] = acc / denom;
  }

  return out;
}

function movingAverage(values: number[], window: number) {
  const w = Math.max(1, Math.floor(window));
  if (w <= 1) return values.slice();

  const out = new Array(values.length).fill(0);
  const half = Math.floor(w / 2);

  for (let i = 0; i < values.length; i += 1) {
    let sum = 0;
    let count = 0;
    for (let j = i - half; j <= i + half; j += 1) {
      if (j >= 0 && j < values.length) {
        sum += values[j];
        count += 1;
      }
    }
    out[i] = count ? sum / count : values[i];
  }

  return out;
}

function findPeaksSimple(values: number[], minHeight: number, minDistance: number) {
  const peaks: number[] = [];
  let lastAccepted = -Infinity;

  for (let i = 1; i < values.length - 1; i += 1) {
    const v = values[i];
    if (v < minHeight) continue;
    if (!(v > values[i - 1] && v >= values[i + 1])) continue;

    if (i - lastAccepted < minDistance) {
      if (peaks.length && values[i] > values[peaks[peaks.length - 1]]) {
        peaks[peaks.length - 1] = i;
        lastAccepted = i;
      }
      continue;
    }

    peaks.push(i);
    lastAccepted = i;
  }

  return peaks;
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
  const initials = getInitials(name);

  return (
    <View style={[styles.card, styles.participantCard]}>
      <View style={styles.participantHeader}>
        <View style={styles.avatar}>
          <T style={styles.avatarText}>{initials}</T>
        </View>

        <View style={styles.participantHeaderText}>
          <T style={styles.participantOverline}>Participante</T>
          <T style={styles.participantName}>{name}</T>
        </View>
      </View>

      <View style={styles.pillRow}>
        <View style={styles.pill}>
          <T style={styles.pillLabel}>Idade</T>
          <T style={styles.pillValue}>{age}</T>
        </View>

        <View style={styles.pill}>
          <T style={styles.pillLabel}>Sexo biológico</T>
          <T style={styles.pillValue}>{sex}</T>
        </View>
      </View>
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

function MetricTable({
  rows,
}: {
  rows: Array<{ label: string; value: string }>;
}) {
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

function HighlightStatBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.statBox}>
      <T style={styles.statBoxLabel}>{label}</T>
      <T style={styles.statBoxValue}>{value}</T>
    </View>
  );
}

function LiteratureTable({
  rows,
}: {
  rows: NormDisplayRow[];
}) {
  const [expanded, setExpanded] = useState(false);
  const visibleRows = expanded ? rows : rows.slice(0, 5);

  return (
    <View style={styles.litTableBlock}>
      <View style={styles.litTable}>
        <View style={[styles.litTableRow, styles.litTableHead]}>
          <T style={[styles.litCellHead, { flex: 1 }]}>Percentil</T>
          <T style={[styles.litCellHead, { flex: 1, textAlign: "right" }]}>Passos</T>
        </View>

        {visibleRows.map((row, idx) => (
          <View
            key={`${row.label}-${idx}`}
            style={[
              styles.litTableRow,
              idx === visibleRows.length - 1 && styles.litTableRowLast,
              row.isMatch && styles.litTableRowActive,
            ]}
          >
            <T style={[styles.litCell, { flex: 1 }, row.isMatch && styles.litCellActive]}>
              {row.label}
            </T>
            <T
              style={[
                styles.litCell,
                { flex: 1, textAlign: "right" },
                row.isMatch && styles.litCellActive,
              ]}
            >
              {row.valueText}
            </T>
          </View>
        ))}
      </View>

      {rows.length > 5 ? (
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          style={expanded ? styles.expandButtonSecondary : styles.expandButton}
        >
          <T style={expanded ? styles.expandButtonSecondaryText : styles.expandButtonText}>
            {expanded ? "Mostrar menos" : "Mostrar tabela completa"}
          </T>
        </Pressable>
      ) : null}
    </View>
  );
}

function getInitials(name?: string | null) {
  const raw = String(name ?? "").trim();
  if (!raw) return "—";

  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function last<T>(arr: T[]) {
  return arr.length ? arr[arr.length - 1] : null;
}

function BluePeakChart({
  time,
  values,
  peakIndices,
}: {
  time: number[];
  values: number[];
  peakIndices: number[];
}) {
  const width = 340;
  const height = 278;
  const padL = 64;
  const padR = 16;
  const padT = 16;
  const padB = 50;

  const xMin = 0;
  const xMax = Math.max(last(time) ?? 1, 1);

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

  const y0Visible = yMin <= 0 && yMax >= 0;
  const firstWindowEnd = Math.min(20, xMax);
  const lastWindowStart = Math.max(xMax - 20, 0);

  const yTicks = [yMin, (yMin + yMax) / 2, yMax];
  const tickStep = xMax <= 20 ? 5 : xMax <= 60 ? 10 : 20;
  const xTicks: number[] = [];
  for (let x = 0; x <= xMax + 1e-9; x += tickStep) xTicks.push(Number(x.toFixed(0)));

  const yAxisTitleX = 18;
  const yAxisTitleY = height / 2;

  return (
    <View style={{ width, alignSelf: "center" }}>
      <Svg width={width} height={height}>
        <Rect
          x={xToPx(0)}
          y={padT}
          width={Math.max(xToPx(firstWindowEnd) - xToPx(0), 0)}
          height={height - padT - padB}
          fill="rgba(0,90,255,0.08)"
        />
        <Rect
          x={xToPx(lastWindowStart)}
          y={padT}
          width={Math.max(xToPx(xMax) - xToPx(lastWindowStart), 0)}
          height={height - padT - padB}
          fill="rgba(0,90,255,0.08)"
        />

        <Line x1={padL} y1={padT} x2={padL} y2={height - padB} stroke="#7A869A" strokeWidth={1} />
        <Line
          x1={padL}
          y1={height - padB}
          x2={width - padR}
          y2={height - padB}
          stroke="#7A869A"
          strokeWidth={1}
        />

        {y0Visible ? (
          <Line
            x1={padL}
            x2={width - padR}
            y1={yToPx(0)}
            y2={yToPx(0)}
            stroke="rgba(0,0,0,0.45)"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        ) : null}

        <Line
          x1={xToPx(0)}
          x2={xToPx(0)}
          y1={padT}
          y2={height - padB}
          stroke="#000"
          strokeWidth={1.5}
          strokeDasharray="5 4"
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

        {peakIndices.map((idx) => (
          <React.Fragment key={`pk-${idx}`}>
            <Circle cx={xToPx(time[idx])} cy={yToPx(values[idx])} r={5.8} fill="#000" />
            <Circle cx={xToPx(time[idx])} cy={yToPx(values[idx])} r={2.9} fill="#FFF" />
          </React.Fragment>
        ))}

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
          GX (°/s)
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F3F5F8",
  },
  scroll: {
    flex: 1,
    backgroundColor: "#F3F5F8",
  },
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
  statGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: "#F7F9FC",
    borderWidth: 1,
    borderColor: "#E9EEF5",
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 4,
  },
  statBoxLabel: {
    fontSize: 12,
    color: "#708092",
    lineHeight: 16,
  },
  statBoxValue: {
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 23,
    color: "#0F172A",
  },

  badgeRow: {
    marginBottom: 12,
    gap: 6,
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: "#EAF2FF",
    borderWidth: 1,
    borderColor: "#BFD4FF",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#1456D9",
  },
  badgeSubtext: {
    fontSize: 12,
    color: "#657180",
  },
  litTableBlock: {
    gap: 10,
  },
  litTable: {
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E9EDF4",
    backgroundColor: "#FFFFFF",
  },
  litTableHead: {
    backgroundColor: "#F4F7FB",
  },
  litTableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
  },
  litTableRowLast: {
    borderBottomWidth: 0,
  },
  litTableRowActive: {
    backgroundColor: "#DDEBFF",
  },
  litCellHead: {
    fontSize: 13,
    fontWeight: "900",
    color: "#4A5562",
  },
  litCell: {
    fontSize: 13,
    lineHeight: 18,
    color: "#42505E",
  },
  litCellActive: {
    fontWeight: "900",
    color: "#0E4FC7",
  },
  expandButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#EEF4FF",
    borderWidth: 1,
    borderColor: "#CFE0FF",
  },
  expandButtonText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#1456D9",
  },
  expandButtonSecondary: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D9E2EF",
  },
  expandButtonSecondaryText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#5F6D7C",
  },

  emptyText: {
    opacity: 0.76,
    lineHeight: 20,
    color: "#4C5866",
  },
  buttonWrap: {
    marginTop: 2,
  },
});