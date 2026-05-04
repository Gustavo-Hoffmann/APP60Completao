import React, { useLayoutEffect, useMemo, useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as Sharing from "expo-sharing";
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import { useTranslation } from "react-i18next";

import { T } from "../../../components/Themed";
import { ThemedButton } from "../../../components/ThemedButton";
import { useAuth } from "../../../contexts/AuthContext";
import type { Participant } from "../../../models/types";
import type { NativeImuStopResult } from "../../../services/sensors/nativeImu";
import { uploadUttJsonToCollection } from "../../../services/tests/uploadTestJson";
import { analyzeUttFromSamples } from "./analyzeUtt";
import { chartInnerPlotWidth } from "../resultChartLayout";

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

export default function ElevacoesCalcanharesResultScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { participant, result, jsonUri, sessionNumber } = route.params as Params;
  const [uploading, setUploading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const { isGuest } = useAuth();
  const { t } = useTranslation(["tests", "errors"]);

  useLayoutEffect(() => {
    navigation.setOptions?.({
      title: t("tests:elevacaoCalcanhares.resultTitle"),
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
  }, [navigation, t]);

  const age = useMemo(() => calcAge(participant?.dob ?? participant?.birthDate), [participant]);
  const displaySex = useMemo(
    () =>
      formatSexLabel(
        participant?.biologicalSex ??
          participant?.sex ??
          participant?.gender ??
          participant?.sexo,
        t
      ),
    [participant, t]
  );

  const analysis = useMemo(() => analyzeUttFromSamples(result), [result]);

  const shareCsv = async () => {
    if (sharing) return;
    try {
      setSharing(true);
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert(t("tests:common.share.title"), t("tests:common.share.unavailable"));
        return;
      }

      await Sharing.shareAsync(jsonUri, {
        mimeType: "text/csv",
        dialogTitle: t("tests:common.share.csvDialog"),
        UTI: Platform.OS === "ios" ? "public.comma-separated-values-text" : undefined,
      });
    } catch (e: any) {
      Alert.alert(t("errors:titles.error"), e?.message ?? t("tests:common.share.error"));
    } finally {
      setSharing(false);
    }
  };

  const handleUploadCloud = async () => {
    try {
      if (uploading) return;

      setUploading(true);
      const sent = await uploadUttJsonToCollection(result, participant);

      Alert.alert(
        t("tests:common.upload.doneTitle"),
        t("tests:common.upload.doneBody", { session: sent.sessionNumber, path: sent.path })
      );
    } catch (e: any) {
      Alert.alert(t("tests:common.upload.errorTitle"), e?.message ?? t("tests:common.upload.errorBody"));
    } finally {
      setUploading(false);
    }
  };

  const hasPlot = analysis && analysis.time.length >= 10;

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
          age={age != null ? `${age} ${t("tests:common.yearsSuffix")}` : "—"}
          sex={displaySex}
        />

        {hasPlot && analysis ? (
          <>
            <InfoCard title={t("tests:common.resultsTitle")} subtitle={t("tests:elevacaoCalcanhares.resultSubtitle")}>
              <MetricTable
                rows={[
                  { label: t("tests:elevacaoCalcanhares.cyclesCount"), value: String(analysis.cycles) },
                  {
                    label: t("tests:elevacaoCalcanhares.meanCycleSec"),
                    value: analysis.cycles > 0 ? formatSec4(analysis.meanCycleSec) : "—",
                  },
                  {
                    label: t("tests:elevacaoCalcanhares.meanAscentSec"),
                    value: analysis.cycles > 0 ? formatSec4(analysis.meanRiseSec) : "—",
                  },
                  {
                    label: t("tests:elevacaoCalcanhares.meanDescentSec"),
                    value: analysis.cycles > 0 ? formatSec4(analysis.meanFallSec) : "—",
                  },
                  {
                    label: t("tests:elevacaoCalcanhares.meanTransitionSec"),
                    value: formatSec4(analysis.meanTransitionSec),
                  },
                ]}
              />
            </InfoCard>

            <View style={styles.chartSection}>
              <View style={styles.chartHeader}>
                <T style={styles.chartEyebrow}>{t("tests:common.analyzedSignal")}</T>
                <T style={styles.chartTitle}>{t("tests:elevacaoCalcanhares.chartTitle")}</T>
              </View>

              <UttPeakChart
                time={analysis.time}
                values={analysis.signal}
                peakIndices={analysis.peakIndices}
                xAxisLabel={t("tests:elevacaoCalcanhares.axisTime")}
                yAxisLabel={t("tests:elevacaoCalcanhares.axisAy")}
              />
            </View>

            <InfoCard title={t("tests:elevacaoCalcanhares.recordingCardTitle")}>
              <MetricTable
                rows={[
                  { label: t("tests:common.samples"), value: String(result?.stats?.n ?? "—") },
                  {
                    label: t("tests:common.hzMean"),
                    value: result?.stats?.hzMean != null ? result.stats.hzMean.toFixed(2) : "—",
                  },
                  {
                    label: t("tests:common.hzInRange"),
                    value:
                      result?.stats?.pctIn58to62 != null ? `${result.stats.pctIn58to62.toFixed(1)}%` : "—",
                  },
                  { label: t("tests:common.sessionLocal"), value: sessionNumber ? `S${sessionNumber}` : "—" },
                ]}
              />
            </InfoCard>
          </>
        ) : (
          <InfoCard title={t("tests:common.resultsTitle")}>
            <T style={styles.emptyText}>{t("tests:common.insufficientSignal")}</T>
          </InfoCard>
        )}

        <View style={styles.buttonWrap}>
          <ThemedButton
            title={`${t("tests:common.share.csvButton")}${sessionNumber ? ` • S${sessionNumber}` : ""}`}
            onPress={shareCsv}
            disabled={sharing}
          />
        </View>

        {!isGuest && (
          <View style={styles.buttonWrap}>
            <ThemedButton
              title={uploading ? t("tests:common.upload.sending") : t("tests:common.upload.button")}
              onPress={handleUploadCloud}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function formatSec4(s: number) {
  if (!Number.isFinite(s)) return "—";
  return `${s.toFixed(4)} s`;
}

function calcAge(dateStr?: string | null) {
  if (!dateStr) return null;
  const raw = String(dateStr).trim();
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  let d: Date;
  if (br) {
    const [, dd, mm, yyyy] = br;
    d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  } else {
    d = new Date(raw);
  }
  if (Number.isNaN(d.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age -= 1;
  return age >= 0 && age <= 120 ? age : null;
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

function formatSexLabel(value: string | null | undefined, t: (key: string) => string) {
  const s = normalizeSex(value);
  if (s === "M") return t("tests:common.sexMale");
  if (s === "F") return t("tests:common.sexFemale");
  return "—";
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

function ParticipantCard({ name, age, sex }: { name: string; age: string; sex: string }) {
  const { t } = useTranslation("tests");
  const initials = getInitials(name);

  return (
    <View style={[styles.card, styles.participantCard]}>
      <View style={styles.participantHeader}>
        <View style={styles.avatar}>
          <T style={styles.avatarText}>{initials}</T>
        </View>

        <View style={styles.participantHeaderText}>
          <T style={styles.participantOverline}>{t("tests:common.participantLabel")}</T>
          <T style={styles.participantName}>{name}</T>
        </View>
      </View>

      <View style={styles.pillRow}>
        <View style={styles.pill}>
          <T style={styles.pillLabel}>{t("tests:common.ageLabel")}</T>
          <T style={styles.pillValue}>{age}</T>
        </View>

        <View style={styles.pill}>
          <T style={styles.pillLabel}>{t("tests:common.sexLabel")}</T>
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

const Y_AXIS_NORM_MIN = -1;
const Y_AXIS_NORM_MAX = 1;
/** Maior |pico| ou |vale| do sinal encaixa em ±0,8; eixo Y fixo em ±1. */
const Y_PEAK_NORM = 0.8;

/** Mesmo estilo do gráfico da marcha (faixas iniciais/finais, linha azul, picos em círculo preto/branco). */
function UttPeakChart({
  time,
  values,
  peakIndices,
  xAxisLabel,
  yAxisLabel,
}: {
  time: number[];
  values: number[];
  peakIndices: number[];
  xAxisLabel: string;
  yAxisLabel: string;
}) {
  const { width: winW } = useWindowDimensions();
  const height = 278;
  const padL = 64;
  const padR = 16;
  const padT = 16;
  const padB = 50;

  const xMin = 0;
  const xMax = Math.max(last(time) ?? 1, 1);

  const rawMinY = values.length ? Math.min(...values) : 0;
  const rawMaxY = values.length ? Math.max(...values) : 0;
  const mag = Math.max(Math.abs(rawMinY), Math.abs(rawMaxY), 1e-12);
  const normValues = values.map((v) => (v / mag) * Y_PEAK_NORM);

  const yMin = Y_AXIS_NORM_MIN;
  const yMax = Y_AXIS_NORM_MAX;
  const yRange = yMax - yMin;

  const viewportW = Math.max(300, Math.min(400, winW - 24));
  const plotInnerW = Math.max(40, viewportW - padL - padR);
  const plotW = chartInnerPlotWidth(xMax - xMin, plotInnerW);
  const chartWidth = padL + padR + plotW;

  const xToPx = (x: number) =>
    padL + ((x - xMin) / Math.max(xMax - xMin, 1e-6)) * (chartWidth - padL - padR);
  const yToPx = (y: number) =>
    height - padB - ((y - yMin) / yRange) * (height - padT - padB);

  const lineD = normValues
    .map((y, i) => `${i === 0 ? "M" : "L"} ${xToPx(time[i]).toFixed(2)} ${yToPx(y).toFixed(2)}`)
    .join(" ");

  const y0Visible = true;
  const firstWindowEnd = Math.min(20, xMax);
  const lastWindowStart = Math.max(xMax - 20, 0);

  const yTicks = [yMin, 0, yMax];
  const tickStep = xMax <= 20 ? 5 : xMax <= 60 ? 10 : 20;
  const xTicks: number[] = [];
  for (let x = 0; x <= xMax + 1e-9; x += tickStep) xTicks.push(Number(x.toFixed(0)));

  const yAxisTitleX = 18;
  const yAxisTitleY = height / 2;

  return (
    <View style={{ alignSelf: "stretch", maxWidth: "100%" }}>
      <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator>
        <Svg width={chartWidth} height={height}>
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
          x2={chartWidth - padR}
          y2={height - padB}
          stroke="#7A869A"
          strokeWidth={1}
        />

        {y0Visible ? (
          <Line
            x1={padL}
            x2={chartWidth - padR}
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
              {tick === 0 ? "0" : tick.toFixed(0)}
            </SvgText>
          </React.Fragment>
        ))}

        <Path d={lineD} stroke="#2A7BFF" strokeWidth={2.8} fill="none" />

        {peakIndices.map((idx) => (
          <React.Fragment key={`pk-${idx}`}>
            <Circle cx={xToPx(time[idx])} cy={yToPx(normValues[idx] ?? 0)} r={5.8} fill="#000" />
            <Circle cx={xToPx(time[idx])} cy={yToPx(normValues[idx] ?? 0)} r={2.9} fill="#FFF" />
          </React.Fragment>
        ))}

        <SvgText x={chartWidth / 2} y={height - 5} fontSize="11" fill="#8E98A8" textAnchor="middle">
          {xAxisLabel}
        </SvgText>

        <SvgText
          x={yAxisTitleX}
          y={yAxisTitleY}
          fontSize="11"
          fill="#8E98A8"
          textAnchor="middle"
          transform={`rotate(-90, ${yAxisTitleX}, ${yAxisTitleY})`}
        >
          {yAxisLabel}
        </SvgText>
      </Svg>
      </ScrollView>
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
  emptyText: {
    opacity: 0.76,
    lineHeight: 20,
    color: "#4C5866",
  },
  buttonWrap: {
    marginTop: 2,
  },
});
