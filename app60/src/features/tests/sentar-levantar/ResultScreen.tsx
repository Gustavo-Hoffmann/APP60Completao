import React, { useLayoutEffect, useMemo, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as Sharing from "expo-sharing";
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from "react-native-svg";

import { T } from "../../../components/Themed";
import { ThemedButton } from "../../../components/ThemedButton";
import type { Participant } from "../../../models/types";
import type { NativeImuStopResult } from "../../../services/sensors/nativeImu";
import { uploadSl30sJsonToSupabase } from "../../../services/tests/uploadTestJson";

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

type SexKey = "M" | "F";
type ClassificationLabel = "Abaixo da média" | "Na média" | "Acima da média" | "—" | string;

type NormStats = { mean: number; sd: number };

type NormDisplayRow = {
  label: string;
  meanText: string;
  rangeText: string;
  isMatch: boolean;
};

type AnalysisResult = {
  time: number[];
  signalDeg: number[];
  peakIndices: number[];
  valleyIndices: number[];
  startIndex: number;
  cycles: number;
  meanCycleDuration: number | null;
  cadence: number | null;
  ageBinLabel: string;
  classification: ClassificationLabel;
  normRows: NormDisplayRow[];
  referenceMeanText: string;
  referenceSdText: string;
  expectedRangeText: string;
};

const DEG = 180 / Math.PI;
const DT = 1 / 60;
const SAVGOL_WINDOW = 15;
const SAVGOL_POLY = 3;
const MIN_PERIOD_FALLBACK_SEC = 1.6;
const WINDOW_SEC = 30.5;

const NORM_30STS: Record<SexKey, Record<string, NormStats>> = {
  F: {
    "60-64": { mean: 15.4, sd: 4.3 },
    "65-69": { mean: 13.5, sd: 4.3 },
    "70-74": { mean: 12.9, sd: 3.7 },
    "75-79": { mean: 12.5, sd: 3.9 },
    "80-84": { mean: 10.3, sd: 4.0 },
    "85-89": { mean: 8.0, sd: 5.1 },
    "90-94": { mean: 6.0, sd: 4.0 },
  },
  M: {
    "60-64": { mean: 16.4, sd: 3.3 },
    "65-69": { mean: 15.2, sd: 4.5 },
    "70-74": { mean: 14.5, sd: 4.2 },
    "75-79": { mean: 14.0, sd: 4.3 },
    "80-84": { mean: 12.4, sd: 3.9 },
    "85-89": { mean: 10.3, sd: 4.0 },
    "90-94": { mean: 9.7, sd: 6.8 },
  },
};

export default function SentarLevantarResultScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { participant, result, jsonUri, sessionNumber } = route.params as Params;
  const [uploading, setUploading] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions?.({
      title: "Sentar e Levantar",
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

  const analysis = useMemo(() => analyzeSL30(result, age, sex), [result, age, sex]);

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
      const sent = await uploadSl30sJsonToSupabase(result, participant);

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
              subtitle="Mesmo padrão da marcha, agora sem o CSV jurássico."
            >
              <MetricTable
                rows={[
                  { label: "Repetições detectadas", value: String(analysis.cycles) },
                  {
                    label: "Tempo médio por repetição",
                    value:
                      analysis.meanCycleDuration != null
                        ? `${analysis.meanCycleDuration.toFixed(2)} s`
                        : "—",
                  },
                  {
                    label: "Cadência",
                    value: analysis.cadence != null ? `${analysis.cadence.toFixed(2)} rep/min` : "—",
                  },
                  { label: "Classificação", value: analysis.classification },
                  { label: "Sessão", value: sessionNumber != null ? `S${sessionNumber}` : "—" },
                ]}
              />
            </InfoCard>

            <View style={styles.chartSection}>
              <View style={styles.chartHeader}>
                <T style={styles.chartEyebrow}>Sinal analisado</T>
                <T style={styles.chartTitle}>30s STS – GX (°/s)</T>
              </View>

              <BluePeakChart
                time={analysis.time}
                values={analysis.signalDeg}
                peakIndices={analysis.peakIndices}
                valleyIndices={analysis.valleyIndices}
                startIndex={analysis.startIndex}
              />
            </View>

            <InfoCard
              title="Comparação com a literatura"
              subtitle="Referência normativa por faixa etária e sexo biológico, com destaque da faixa do participante."
            >
              <View style={styles.statGrid}>
                <HighlightStatBox label="Faixa etária" value={analysis.ageBinLabel} />
                <HighlightStatBox label="Repetições (30 s)" value={String(analysis.cycles)} />
              </View>

              {sex && analysis.normRows.length ? (
                <>
                  <View style={styles.badgeRow}>
                    <View style={styles.badge}>
                      <T style={styles.badgeText}>{analysis.classification}</T>
                    </View>
                    <T style={styles.badgeSubtext}>
                      Referência da faixa: média {analysis.referenceMeanText} · DP {analysis.referenceSdText}
                    </T>
                    <T style={styles.badgeSubtext}>
                      Faixa esperada (média ± DP): {analysis.expectedRangeText}
                    </T>
                  </View>

                  <LiteratureTable rows={analysis.normRows} />
                </>
              ) : (
                <T style={styles.emptyText}>
                  Classificação indisponível. Confira se idade e sexo biológico foram cadastrados e se a idade está dentro da faixa normativa.
                </T>
              )}
            </InfoCard>
          </>
        ) : (
          <InfoCard
            title="Resumo do teste"
            subtitle="Não deu para extrair um sinal confiável desse arquivo."
          >
            <T style={styles.emptyText}>
              Sinal insuficiente para calcular as métricas do sentar e levantar.
            </T>
          </InfoCard>
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

function HighlightStatBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <T style={styles.statBoxLabel}>{label}</T>
      <T style={styles.statBoxValue}>{value}</T>
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

function LiteratureTable({ rows }: { rows: NormDisplayRow[] }) {
  const [expanded, setExpanded] = useState(false);

  const matchIndex = rows.findIndex((row) => row.isMatch);
  const visibleRows = useMemo(() => {
    if (expanded || rows.length <= 3 || matchIndex < 0) return rows;
    const start = Math.max(matchIndex - 1, 0);
    const end = Math.min(matchIndex + 2, rows.length);
    return rows.slice(start, end);
  }, [expanded, matchIndex, rows]);

  return (
    <View style={styles.litTableBlock}>
      <View style={styles.litTable}>
        <View style={[styles.litTableRow, styles.litTableHead]}>
          <T style={[styles.litCellHead, { flex: 1.05 }]}>Faixa</T>
          <T style={[styles.litCellHead, { flex: 0.9, textAlign: "right" }]}>Média ± DP</T>
          <T style={[styles.litCellHead, { flex: 1.05, textAlign: "right" }]}>Faixa esperada</T>
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
            <T style={[styles.litCell, { flex: 1.05 }, row.isMatch && styles.litCellActive]}>
              {row.label}
            </T>
            <T
              style={[
                styles.litCell,
                { flex: 0.9, textAlign: "right" },
                row.isMatch && styles.litCellActive,
              ]}
            >
              {row.meanText}
            </T>
            <T
              style={[
                styles.litCell,
                { flex: 1.05, textAlign: "right" },
                row.isMatch && styles.litCellActive,
              ]}
            >
              {row.rangeText}
            </T>
          </View>
        ))}
      </View>

      {rows.length > visibleRows.length ? (
        <Pressable onPress={() => setExpanded(true)} style={styles.expandButton}>
          <T style={styles.expandButtonText}>Expandir tabela</T>
        </Pressable>
      ) : null}

      {expanded && rows.length > 3 ? (
        <Pressable onPress={() => setExpanded(false)} style={styles.expandButtonSecondary}>
          <T style={styles.expandButtonSecondaryText}>Mostrar menos</T>
        </Pressable>
      ) : null}
    </View>
  );
}

function getInitials(name?: string | null) {
  const base = String(name ?? "").trim();
  if (!base || base === "—") return "P";
  const parts = base.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return `${first}${last}`.toUpperCase();
}

function analyzeSL30(
  result: NativeImuStopResult,
  age: number | null,
  sex: SexKey | null
): AnalysisResult | null {
  const rows = result?.samples ?? [];
  if (!rows || rows.length < 10) return null;

  const rawTime = rows.map((r) => Number(r?.[0] ?? 0) / 1000);
  const gxRawDeg = rows.map((r) => Number(r?.[4] ?? 0) * DEG);

  const series = sanitizeSeries(rawTime, gxRawDeg.map((v) => -v));
  if (series.time.length < 10) return null;

  const regularTime = makeRegularGrid(series.time[0], last(series.time) ?? series.time[0], DT);
  if (regularTime.length < SAVGOL_WINDOW + 2) return null;

  const interpolated = evaluateNaturalCubicSpline(series.time, series.signal, regularTime);
  const filtered = savitzkyGolaySmooth(interpolated, SAVGOL_WINDOW, SAVGOL_POLY);

  const amplitude = Math.max(...filtered) - Math.min(...filtered);
  if (!Number.isFinite(amplitude) || amplitude <= 1) return null;

  const minDistance = Math.max(Math.round(0.45 / DT), 8);
  const prominenceThreshold = Math.max(amplitude * 0.1, 8);
  const positiveHeight = mean(filtered) + amplitude * 0.05;
  const negativeHeight = -mean(filtered) + amplitude * 0.05;

  const peakCandidates = detectPeaksAdvanced(
    filtered,
    minDistance,
    positiveHeight,
    prominenceThreshold,
    false
  );

  const valleyCandidates = detectPeaksAdvanced(
    filtered,
    minDistance,
    negativeHeight,
    prominenceThreshold,
    true
  );

  if (!peakCandidates.length || !valleyCandidates.length) return null;

  const firstPeakIdx = peakCandidates[0];
  const periodSamples =
    peakCandidates.length >= 2 ? mean(diff(peakCandidates)) : MIN_PERIOD_FALLBACK_SEC / DT;

  const searchWindow = Math.max(Math.round(periodSamples * 0.85), 1);
  const searchStart = Math.max(0, firstPeakIdx - searchWindow);
  const searchEnd = firstPeakIdx;

  let startIdx = valleyCandidates.find((v) => v >= searchStart && v < searchEnd);
  if (startIdx == null) {
    const segment = filtered.slice(searchStart, searchEnd);
    const localMinOffset = segment.length ? argMin(segment) : 0;
    startIdx = Math.min(searchStart + localMinOffset, filtered.length - 1);
  }

  const timeStart = regularTime[startIdx];
  const timeEnd = timeStart + WINDOW_SEC;

  const maskIndices = regularTime
    .map((t, i) => ({ t, i }))
    .filter((x) => x.t >= timeStart && x.t <= timeEnd)
    .map((x) => x.i);

  if (maskIndices.length < 10) return null;

  const timeCut = maskIndices.map((i) => regularTime[i] - timeStart);
  const signalCut = maskIndices.map((i) => filtered[i]);
  const absoluteToCut = new Map<number, number>(maskIndices.map((v, i) => [v, i]));

  const peakInWindow = peakCandidates
    .filter((idx) => idx >= startIdx && regularTime[idx] <= timeEnd)
    .map((idx) => absoluteToCut.get(idx))
    .filter((idx): idx is number => idx != null);

  const valleysRawInWindow = valleyCandidates
    .filter((idx) => idx >= startIdx && regularTime[idx] <= timeEnd)
    .map((idx) => absoluteToCut.get(idx))
    .filter((idx): idx is number => idx != null);

  const valleySet = new Set<number>(valleysRawInWindow);
  valleySet.add(0);
  const valleyIndices = Array.from(valleySet).sort((a, b) => a - b);

  const cleanedPeaks = enforceAlternatingExtrema(signalCut, peakInWindow, valleyIndices, "peak");
  const cleanedValleys = enforceAlternatingExtrema(
    signalCut,
    cleanedPeaks,
    valleyIndices,
    "valley"
  );

  const cycles = cleanedValleys.length >= 3 ? Math.floor((cleanedValleys.length - 1) / 2) : 0;
  const durations: number[] = [];

  for (let i = 0; i < cycles; i++) {
    const startValley = cleanedValleys[2 * i];
    const endValley = cleanedValleys[2 * i + 2];
    if (startValley != null && endValley != null) {
      durations.push(timeCut[endValley] - timeCut[startValley]);
    }
  }

  const meanCycleDuration = durations.length ? mean(durations) : null;
  const cadence = cycles > 0 ? (cycles * 60) / WINDOW_SEC : null;
  const ageBinLabel = age != null ? ageToBinLabel(age) : "—";
  const classification = age != null && sex ? classify30STS(sex, age, cycles) : "—";
  const normData = age != null && sex ? buildNormRows30STS(sex, age) : null;

  return {
    time: timeCut,
    signalDeg: signalCut,
    peakIndices: cleanedPeaks,
    valleyIndices: cleanedValleys,
    startIndex: 0,
    cycles,
    meanCycleDuration,
    cadence,
    ageBinLabel,
    classification,
    normRows: normData?.rows ?? [],
    referenceMeanText: normData?.meanText ?? "—",
    referenceSdText: normData?.sdText ?? "—",
    expectedRangeText: normData?.expectedRangeText ?? "—",
  };
}

function buildNormRows30STS(sex: SexKey, age: number) {
  const table = NORM_30STS[sex];
  const participantBin = ageToBinLabel(age);

  const rows: NormDisplayRow[] = Object.entries(table).map(([label, stats]) => ({
    label,
    meanText: `${formatOneDecimal(stats.mean)} ± ${formatOneDecimal(stats.sd)}`,
    rangeText: formatExpectedRange(stats.mean, stats.sd),
    isMatch: label === participantBin,
  }));

  const stats = table[participantBin];
  if (!stats) {
    return {
      rows,
      meanText: "—",
      sdText: "—",
      expectedRangeText: "—",
    };
  }

  return {
    rows,
    meanText: formatOneDecimal(stats.mean),
    sdText: formatOneDecimal(stats.sd),
    expectedRangeText: formatExpectedRange(stats.mean, stats.sd),
  };
}

function enforceAlternatingExtrema(
  signal: number[],
  peaks: number[],
  valleys: number[],
  mode: "peak" | "valley"
) {
  const all = [
    ...peaks.map((i) => ({ i, type: "peak" as const })),
    ...valleys.map((i) => ({ i, type: "valley" as const })),
  ].sort((a, b) => a.i - b.i);

  if (!all.length) return [];

  const cleaned: { i: number; type: "peak" | "valley" }[] = [];

  for (const curr of all) {
    const prev = cleaned[cleaned.length - 1];

    if (!prev) {
      cleaned.push(curr);
      continue;
    }

    if (prev.type !== curr.type) {
      cleaned.push(curr);
      continue;
    }

    if (curr.type === "peak") {
      if (signal[curr.i] > signal[prev.i]) {
        cleaned[cleaned.length - 1] = curr;
      }
    } else {
      if (signal[curr.i] < signal[prev.i]) {
        cleaned[cleaned.length - 1] = curr;
      }
    }
  }

  return cleaned.filter((x) => x.type === mode).map((x) => x.i);
}

function classify30STS(sex: SexKey, age: number, repetitions: number): ClassificationLabel {
  const ageBin = ageToBinLabel(age);
  const stats = NORM_30STS[sex][ageBin];
  if (!stats) return "Idade fora da faixa da tabela";

  const lower = stats.mean - stats.sd;
  const upper = stats.mean + stats.sd;

  if (repetitions < lower) return "Abaixo da média";
  if (repetitions > upper) return "Acima da média";
  return "Na média";
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

function normalizeSex(value?: string | null): SexKey | null {
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

function ageToBinLabel(age: number): string {
  if (age < 60) return "< 60";
  if (age <= 64) return "60-64";
  if (age <= 69) return "65-69";
  if (age <= 74) return "70-74";
  if (age <= 79) return "75-79";
  if (age <= 84) return "80-84";
  if (age <= 89) return "85-89";
  if (age <= 94) return "90-94";
  return ">= 95";
}

function formatOneDecimal(value: number) {
  return value.toFixed(1);
}

function formatExpectedRange(meanValue: number, sd: number) {
  const low = Math.max(0, meanValue - sd);
  const high = meanValue + sd;
  return `${formatOneDecimal(low)} – ${formatOneDecimal(high)}`;
}

function sanitizeSeries(time: number[], signal: number[]) {
  const pairs = time
    .map((t, i) => ({ t: Number(t), y: Number(signal[i]) }))
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.y))
    .sort((a, b) => a.t - b.t);

  const outT: number[] = [];
  const outY: number[] = [];

  for (let i = 0; i < pairs.length; i++) {
    if (!outT.length) {
      outT.push(pairs[i].t);
      outY.push(pairs[i].y);
      continue;
    }

    const prevT = outT[outT.length - 1];
    if (pairs[i].t > prevT) {
      outT.push(pairs[i].t);
      outY.push(pairs[i].y);
    }
  }

  return { time: outT, signal: outY };
}

function makeRegularGrid(t0: number, t1: number, dt: number) {
  const out: number[] = [];
  if (!(t1 > t0) || dt <= 0) return out;
  for (let t = t0; t <= t1; t += dt) out.push(Number(t.toFixed(6)));
  return out;
}

function evaluateNaturalCubicSpline(x: number[], y: number[], xs: number[]) {
  const n = x.length;
  if (n < 2) return xs.map(() => y[0] ?? 0);
  if (n === 2) return xs.map((v) => linearInterpolate(x[0], y[0], x[1], y[1], v));

  const y2 = new Array(n).fill(0);
  const u = new Array(n - 1).fill(0);

  y2[0] = 0;
  u[0] = 0;

  for (let i = 1; i < n - 1; i++) {
    const sig = (x[i] - x[i - 1]) / (x[i + 1] - x[i - 1]);
    const p = sig * y2[i - 1] + 2;
    y2[i] = (sig - 1) / p;
    const ddydx =
      (6 * ((y[i + 1] - y[i]) / (x[i + 1] - x[i]) - (y[i] - y[i - 1]) / (x[i] - x[i - 1]))) /
      (x[i + 1] - x[i - 1]);
    u[i] = (ddydx - sig * u[i - 1]) / p;
  }

  y2[n - 1] = 0;
  for (let k = n - 2; k >= 0; k--) {
    y2[k] = y2[k] * y2[k + 1] + u[k];
  }

  const out = new Array(xs.length).fill(0);
  let klo = 0;
  let khi = 1;

  for (let j = 0; j < xs.length; j++) {
    const xx = xs[j];

    if (xx <= x[0]) {
      out[j] = y[0];
      continue;
    }
    if (xx >= x[n - 1]) {
      out[j] = y[n - 1];
      continue;
    }

    while (!(xx >= x[klo] && xx <= x[khi])) {
      if (xx > x[khi]) {
        klo = khi;
        khi = Math.min(khi + 1, n - 1);
      } else {
        klo = Math.max(0, klo - 1);
        khi = klo + 1;
      }
    }

    const h = x[khi] - x[klo];
    const a = (x[khi] - xx) / h;
    const b = (xx - x[klo]) / h;
    out[j] =
      a * y[klo] +
      b * y[khi] +
      (((a * a * a - a) * y2[klo] + (b * b * b - b) * y2[khi]) * h * h) / 6;
  }

  return out;
}

function linearInterpolate(x0: number, y0: number, x1: number, y1: number, x: number) {
  if (x1 === x0) return y0;
  const w = (x - x0) / (x1 - x0);
  return y0 + w * (y1 - y0);
}

function savitzkyGolaySmooth(signal: number[], windowSize: number, polyOrder: number) {
  const half = Math.floor(windowSize / 2);
  const coeffs = savgolCoefficients(windowSize, polyOrder);
  const out = new Array(signal.length).fill(0);

  for (let i = 0; i < signal.length; i++) {
    let sum = 0;
    for (let k = -half; k <= half; k++) {
      const idx = reflectIndex(i + k, signal.length);
      sum += coeffs[k + half] * signal[idx];
    }
    out[i] = sum;
  }

  return out;
}

function savgolCoefficients(windowSize: number, polyOrder: number) {
  const half = Math.floor(windowSize / 2);
  const rows: number[][] = [];

  for (let k = -half; k <= half; k++) {
    const row: number[] = [];
    for (let j = 0; j <= polyOrder; j++) row.push(Math.pow(k, j));
    rows.push(row);
  }

  const ata = multiplyMatrices(transpose(rows), rows);
  const ataInv = invertMatrix(ata);
  const pinv = multiplyMatrices(ataInv, transpose(rows));
  return pinv[0];
}

function reflectIndex(i: number, n: number) {
  if (n <= 1) return 0;
  let idx = i;
  while (idx < 0 || idx >= n) {
    if (idx < 0) idx = -idx - 1;
    if (idx >= n) idx = 2 * n - idx - 1;
  }
  return idx;
}

function transpose(m: number[][]) {
  return m[0].map((_, col) => m.map((row) => row[col]));
}

function multiplyMatrices(a: number[][], b: number[][]) {
  const out = Array.from({ length: a.length }, () => new Array(b[0].length).fill(0));
  for (let i = 0; i < a.length; i++) {
    for (let k = 0; k < b.length; k++) {
      for (let j = 0; j < b[0].length; j++) {
        out[i][j] += a[i][k] * b[k][j];
      }
    }
  }
  return out;
}

function invertMatrix(m: number[][]) {
  const n = m.length;
  const a = m.map((row, i) => [
    ...row.map((v) => Number(v)),
    ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  ]);

  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let r = i + 1; r < n; r++) {
      if (Math.abs(a[r][i]) > Math.abs(a[maxRow][i])) maxRow = r;
    }
    if (Math.abs(a[maxRow][i]) < 1e-12) throw new Error("Matriz singular no Savitzky-Golay");
    if (maxRow !== i) {
      const tmp = a[i];
      a[i] = a[maxRow];
      a[maxRow] = tmp;
    }

    const pivot = a[i][i];
    for (let j = 0; j < 2 * n; j++) a[i][j] /= pivot;

    for (let r = 0; r < n; r++) {
      if (r === i) continue;
      const factor = a[r][i];
      for (let j = 0; j < 2 * n; j++) a[r][j] -= factor * a[i][j];
    }
  }

  return a.map((row) => row.slice(n));
}

function detectPeaksAdvanced(
  signal: number[],
  minDistance: number,
  minHeight: number,
  minProminence: number,
  invert = false
) {
  const peaks: number[] = [];
  if (signal.length < 3) return peaks;

  for (let i = 1; i < signal.length - 1; i++) {
    const y = invert ? -signal[i] : signal[i];
    const left = invert ? -signal[i - 1] : signal[i - 1];
    const right = invert ? -signal[i + 1] : signal[i + 1];

    const isLocalMax = y >= left && y >= right && (y > left || y > right);
    if (!isLocalMax || y < minHeight) continue;

    const leftMin = localSideMin(signal, i, minDistance, invert, "left");
    const rightMin = localSideMin(signal, i, minDistance, invert, "right");
    const prominence = y - Math.max(leftMin, rightMin);
    if (prominence < minProminence) continue;

    const lastPeak = peaks.length ? peaks[peaks.length - 1] : null;
    if (lastPeak != null && i - lastPeak < minDistance) {
      const lastVal = invert ? -signal[lastPeak] : signal[lastPeak];
      if (y > lastVal) peaks[peaks.length - 1] = i;
    } else {
      peaks.push(i);
    }
  }

  return peaks;
}

function localSideMin(
  signal: number[],
  center: number,
  span: number,
  invert: boolean,
  side: "left" | "right"
) {
  let minVal = Number.POSITIVE_INFINITY;
  if (side === "left") {
    for (let i = Math.max(0, center - span); i <= center; i++) {
      const v = invert ? -signal[i] : signal[i];
      if (v < minVal) minVal = v;
    }
  } else {
    for (let i = center; i <= Math.min(signal.length - 1, center + span); i++) {
      const v = invert ? -signal[i] : signal[i];
      if (v < minVal) minVal = v;
    }
  }
  return minVal;
}

function mean(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

function diff(values: number[]) {
  const out: number[] = [];
  for (let i = 1; i < values.length; i++) out.push(values[i] - values[i - 1]);
  return out;
}

function argMin(values: number[]) {
  let idx = 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i] < values[idx]) idx = i;
  }
  return idx;
}

function last<T>(arr: T[]) {
  return arr.length ? arr[arr.length - 1] : null;
}

function BluePeakChart({
  time,
  values,
  peakIndices,
  valleyIndices,
  startIndex,
}: {
  time: number[];
  values: number[];
  peakIndices: number[];
  valleyIndices: number[];
  startIndex: number;
}) {
  const width = 352;
  const height = 286;
  const padL = 62;
  const padR = 18;
  const padT = 18;
  const padB = 58;

  const xMin = 0;
  const xMax = Math.max(last(time) ?? 1, 1);
  const rawMinY = Math.min(...values);
  const rawMaxY = Math.max(...values);
  const padY = Math.max((rawMaxY - rawMinY) * 0.08, 14);
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
  const tickStep = xMax <= 10 ? 2 : xMax <= 20 ? 5 : 10;
  const xTicks: number[] = [];
  for (let x = 0; x <= xMax + 1e-9; x += tickStep) xTicks.push(Number(x.toFixed(0)));

  return (
    <View style={styles.chartWrap}>
      <Svg width={width} height={height}>
        <Rect
          x={xToPx(0)}
          y={padT}
          width={Math.max(xToPx(xMax) - xToPx(0), 0)}
          height={height - padT - padB}
          fill="rgba(11,99,246,0.08)"
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

        {xTicks.map((tick) => (
          <React.Fragment key={`x-${tick}`}>
            <Line
              x1={xToPx(tick)}
              y1={height - padB}
              x2={xToPx(tick)}
              y2={height - padB + 6}
              stroke="#7A869A"
              strokeWidth={1}
            />
            <SvgText
              x={xToPx(tick)}
              y={height - padB + 24}
              fontSize="10"
              fill="#8A95A5"
              textAnchor="middle"
            >
              {tick}
            </SvgText>
          </React.Fragment>
        ))}

        {yTicks.map((tick, idx) => (
          <React.Fragment key={`y-${idx}`}>
            <Line
              x1={padL - 6}
              y1={yToPx(tick)}
              x2={padL}
              y2={yToPx(tick)}
              stroke="#7A869A"
              strokeWidth={1}
            />
            <SvgText
              x={padL - 10}
              y={yToPx(tick) + 3}
              fontSize="10"
              fill="#8A95A5"
              textAnchor="end"
            >
              {tick.toFixed(0)}
            </SvgText>
          </React.Fragment>
        ))}

        <Path d={lineD} stroke="#2A7BFF" strokeWidth={3} fill="none" />

        {peakIndices.map((idx) => (
          <React.Fragment key={`pk-${idx}`}>
            <Circle cx={xToPx(time[idx])} cy={yToPx(values[idx])} r={5.6} fill="#111111" />
            <Circle cx={xToPx(time[idx])} cy={yToPx(values[idx])} r={2.8} fill="#FFFFFF" />
          </React.Fragment>
        ))}

        {valleyIndices.map((idx) => (
          <React.Fragment key={`vl-${idx}`}>
            <Circle cx={xToPx(time[idx])} cy={yToPx(values[idx])} r={5.6} fill="#111111" />
            <Circle cx={xToPx(time[idx])} cy={yToPx(values[idx])} r={2.8} fill="#FFFFFF" />
          </React.Fragment>
        ))}

        <Line
          x1={xToPx(time[startIndex] ?? 0)}
          x2={xToPx(time[startIndex] ?? 0)}
          y1={padT}
          y2={height - padB}
          stroke="#000000"
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />

        <SvgText
          x={22}
          y={height / 2}
          fontSize="11"
          fill="#8A95A5"
          textAnchor="middle"
          transform={`rotate(-90, 22, ${height / 2})`}
        >
          GX (°/s)
        </SvgText>

        <SvgText
          x={width / 2}
          y={height - 10}
          fontSize="11"
          fill="#8A95A5"
          textAnchor="middle"
        >
          Tempo (s)
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
  chartWrap: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
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
    gap: 10,
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