import React, { useLayoutEffect, useMemo, useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as Sharing from "expo-sharing";
import { useTranslation } from "react-i18next";
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from "react-native-svg";

import { T } from "../../../components/Themed";
import { ThemedButton } from "../../../components/ThemedButton";
import { ParticipantInfoCard } from "../components/ParticipantInfoCard";
import { useAuth } from "../../../contexts/AuthContext";
import { showCloudUploadFailure } from "../../../services/tests/uploadSyncErrors";
import type { Participant } from "../../../models/types";
import type { NativeImuStopResult } from "../../../services/sensors/nativeImu";
import { uploadLosJsonToCollection } from "../../../services/tests/uploadTestJson";
import {
  analyzeLosFromSamples,
  losDirectionSortKey,
  type LosAnalysis,
  type LosDirectionResult,
} from "./analyzeLos";

type LoSDir = LosDirectionResult["direction"];

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

type FinishKind = "stability" | "timeout" | "manual";

function normalizeFinishReason(raw?: string): FinishKind | null {
  if (raw === "stability" || raw === "auto_finish") return "stability";
  if (raw === "timeout") return "timeout";
  if (raw === "manual") return "manual";
  return null;
}

function dirColor(d: LoSDir) {
  switch (d) {
    case "F":
      return "#2563EB";
    case "R":
      return "#16A34A";
    case "B":
      return "#EA580C";
    case "L":
      return "#9333EA";
    default:
      return "#64748B";
  }
}

function angleForDir(d: LoSDir): number {
  switch (d) {
    case "R":
      return 0;
    case "F":
      return -Math.PI / 2;
    case "L":
      return Math.PI;
    case "B":
      return Math.PI / 2;
    default:
      return 0;
  }
}

function downsample<T>(arr: T[], maxPts: number): T[] {
  if (arr.length <= maxPts) return arr;
  const step = Math.ceil(arr.length / maxPts);
  const out: T[] = [];
  for (let i = 0; i < arr.length; i += step) out.push(arr[i]);
  if (out[out.length - 1] !== arr[arr.length - 1]) out.push(arr[arr.length - 1]);
  return out;
}

function hexWithAlpha(hex: string, a: number) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

const DIRECTION_ORDER: LoSDir[] = ["F", "R", "B", "L"];

/** Distâncias totais (cm) por direção — substitui a tabela detalhada. */
function LosDistancesCard({
  sorted,
  tr,
}: {
  sorted: LosDirectionResult[];
  tr: (k: string, o?: Record<string, unknown>) => string;
}) {
  const byDir = useMemo(() => {
    const m = new Map<LoSDir, LosDirectionResult>();
    for (const r of sorted) {
      m.set(r.direction, r);
    }
    return m;
  }, [sorted]);

  const labelKey: Record<LoSDir, string> = {
    F: "tests:limiteEstabilidade.results.distFront",
    R: "tests:limiteEstabilidade.results.distRight",
    B: "tests:limiteEstabilidade.results.distBack",
    L: "tests:limiteEstabilidade.results.distLeft",
  };

  return (
    <View style={styles.distancesCard}>
      <T style={styles.distancesSubtitle}>{tr("tests:limiteEstabilidade.results.simpleDistancesSubtitle")}</T>
      <View style={styles.distGrid}>
        {DIRECTION_ORDER.map((dir) => {
          const r = byDir.get(dir);
          const cm = r != null && Number.isFinite(r.totalCM) ? r.totalCM.toFixed(1) : "—";
          return (
            <View key={dir} style={[styles.distCell, { borderLeftColor: dirColor(dir) }]}>
              <T style={styles.distLabel}>{tr(labelKey[dir])}</T>
              <T style={[styles.distValue, { color: dirColor(dir) }]}>{cm}</T>
              <T style={styles.distUnit}>{tr("tests:limiteEstabilidade.results.chartYcm")}</T>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function WarningsBox({ warnings, tr }: { warnings: string[]; tr: (k: string) => string }) {
  return (
    <View style={styles.warnBox}>
      <T style={styles.warnTitle}>{tr("tests:limiteEstabilidade.results.warningsTitle")}</T>
      {warnings.map((w) => (
        <T key={w} style={styles.warnItem}>
          • {w}
        </T>
      ))}
    </View>
  );
}

function PolarLosChart({ results, tr }: { results: LosDirectionResult[]; tr: (k: string) => string }) {
  const { width: winW } = useWindowDimensions();
  const size = Math.max(280, Math.min(360, winW - 48));
  const cx = size / 2;
  const cy = size / 2;
  const radius = Math.min(size, size) * 0.34;
  const maxValue = Math.max(1, ...results.map((r) => Math.max(r.totalCM, r.limitCM ?? 0)));

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartCardHeader}>
        <View style={{ flex: 1 }}>
          <T style={styles.chartTitle}>{tr("tests:limiteEstabilidade.results.polarTitle")}</T>
          <T style={styles.chartSub}>{tr("tests:limiteEstabilidade.results.polarSubtitle")}</T>
        </View>
        <T style={styles.chartYLabel}>{tr("tests:limiteEstabilidade.results.chartYcm")}</T>
      </View>
      <Svg width={size} height={size}>
        {[1, 2, 3, 4].map((ring) => {
          const r = (radius * ring) / 4;
          return <Circle key={ring} cx={cx} cy={cy} r={r} stroke="rgba(100,116,139,0.2)" strokeWidth={1} fill="none" />;
        })}
        {results.map((result) => {
          const ang = angleForDir(result.direction);
          const base = dirColor(result.direction);
          const ux = Math.cos(ang);
          const uy = Math.sin(ang);
          const preR = radius * (result.preCompensationCM / maxValue);
          const totalR = radius * (result.totalCM / maxValue);
          const limitR = result.limitCM != null ? radius * (result.limitCM / maxValue) : 0;

          const x1 = cx + ux * preR;
          const y1 = cy + uy * preR;
          const x2 = cx + ux * totalR;
          const y2 = cy + uy * totalR;
          const xL = cx + ux * limitR;
          const yL = cy + uy * limitR;

          return (
            <React.Fragment key={result.direction}>
              {result.limitCM != null && limitR > 0 ? (
                <Line
                  x1={cx}
                  y1={cy}
                  x2={xL}
                  y2={yL}
                  stroke={hexWithAlpha(base, 0.45)}
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                />
              ) : null}
              {result.compensated && totalR > preR ? (
                <Line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={hexWithAlpha(base, 0.35)}
                  strokeWidth={14}
                  strokeLinecap="round"
                />
              ) : null}
              <Line x1={cx} y1={cy} x2={x1} y2={y1} stroke={hexWithAlpha(base, 0.88)} strokeWidth={12} strokeLinecap="round" />
              <Circle cx={x2} cy={y2} r={4} fill="#FFFFFF" stroke="rgba(0,0,0,0.55)" strokeWidth={1} />
              <SvgText
                x={cx + ux * (radius + 22)}
                y={cy + uy * (radius + 22)}
                fontSize={11}
                fontWeight="700"
                fill={base}
                textAnchor="middle"
              >
                {result.direction}
              </SvgText>
              <SvgText
                x={cx + ux * (totalR + 18)}
                y={cy + uy * (totalR + 18)}
                fontSize={9}
                fill="#0F172A"
                textAnchor="middle"
              >
                {result.totalCM.toFixed(1)}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

function TimeSeriesBlock({
  title,
  subtitle,
  yLabel,
  analysis,
  yKey,
}: {
  title: string;
  subtitle: string;
  yLabel: string;
  analysis: LosAnalysis;
  yKey: "ap" | "ml" | "omega";
}) {
  const { width: winW } = useWindowDimensions();
  const chartW = Math.max(280, Math.min(400, winW - 48));
  const chartH = 220;
  const padL = 44;
  const padR = 12;
  const padT = 8;
  const padB = 28;

  const { tSec } = analysis.processed;
  const ys =
    yKey === "ap"
      ? analysis.processed.phoneAPCM
      : yKey === "ml"
        ? analysis.processed.phoneMLCM
        : analysis.processed.omega;

  const idx = downsample(
    tSec.map((_, i) => i),
    900
  );
  const tS = idx.map((i) => tSec[i] ?? 0);
  const yS = idx.map((i) => ys[i] ?? 0);

  if (tS.length < 2) {
    return (
      <View style={styles.chartCard}>
        <View style={styles.chartCardHeader}>
          <View style={{ flex: 1 }}>
            <T style={styles.chartTitle}>{title}</T>
            <T style={styles.chartSub}>{subtitle}</T>
          </View>
          <T style={styles.chartYLabel}>{yLabel}</T>
        </View>
        <T style={styles.captionMuted}>—</T>
      </View>
    );
  }

  const tMin = tS[0] ?? 0;
  const tMax = tS[tS.length - 1] ?? tMin + 1e-6;
  const yLo = Math.min(...yS);
  const yHi = Math.max(...yS);
  const yMin = yKey === "omega" ? Math.min(0, yLo) : yLo;
  const yMax =
    yKey === "omega" ? Math.max(yHi, analysis.omegaThreshold * 1.08, yMin + 1e-6) : Math.max(yHi, yMin + 1e-6);
  const yPad = (yMax - yMin) * 0.08;

  const sx = (t: number) => padL + ((t - tMin) / (tMax - tMin)) * (chartW - padL - padR);
  const sy = (y: number) => padT + (1 - (y - (yMin - yPad)) / (yMax - yMin + 2 * yPad)) * (chartH - padT - padB);

  const lineD = tS.map((ti, i) => `${i === 0 ? "M" : "L"} ${sx(ti).toFixed(2)} ${sy(yS[i]).toFixed(2)}`).join(" ");

  const stroke = yKey === "ap" ? "#2563EB" : yKey === "ml" ? "#EA580C" : "#92400E";

  const rules = analysis.directionResults
    .slice()
    .sort((a, b) => losDirectionSortKey(a.direction) - losDirectionSortKey(b.direction));

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartCardHeader}>
        <View style={{ flex: 1 }}>
          <T style={styles.chartTitle}>{title}</T>
          <T style={styles.chartSub}>{subtitle}</T>
        </View>
        <T style={styles.chartYLabel}>{yLabel}</T>
      </View>
      <Svg width={chartW} height={chartH}>
        <Rect x={0} y={0} width={chartW} height={chartH} fill="#FAFAFA" rx={8} />
        <Path d={lineD} stroke={stroke} strokeWidth={1.8} fill="none" />
        {yKey === "omega" ? (
          <Line
            x1={padL}
            y1={sy(analysis.omegaThreshold)}
            x2={chartW - padR}
            y2={sy(analysis.omegaThreshold)}
            stroke="rgba(220,38,38,0.75)"
            strokeWidth={1.2}
            strokeDasharray="6 4"
          />
        ) : null}
        {rules.map((r) => (
          <React.Fragment key={`${r.direction}-rules`}>
            <Line
              x1={sx(r.tStartSec)}
              y1={padT}
              x2={sx(r.tStartSec)}
              y2={chartH - padB}
              stroke={hexWithAlpha(dirColor(r.direction), 0.35)}
              strokeWidth={0.8}
              strokeDasharray="2 4"
            />
            <Line
              x1={sx(r.tPeakSec)}
              y1={padT}
              x2={sx(r.tPeakSec)}
              y2={chartH - padB}
              stroke={dirColor(r.direction)}
              strokeWidth={1.4}
              strokeDasharray="5 4"
            />
            <Line
              x1={sx(r.tEndSec)}
              y1={padT}
              x2={sx(r.tEndSec)}
              y2={chartH - padB}
              stroke={hexWithAlpha(dirColor(r.direction), 0.35)}
              strokeWidth={0.8}
              strokeDasharray="2 4"
            />
            {r.compensated && r.tOnsetCompensationSec != null ? (
              <Line
                x1={sx(r.tOnsetCompensationSec)}
                y1={padT}
                x2={sx(r.tOnsetCompensationSec)}
                y2={chartH - padB}
                stroke={hexWithAlpha(dirColor(r.direction), 0.85)}
                strokeWidth={1.2}
                strokeDasharray="1 4"
              />
            ) : null}
          </React.Fragment>
        ))}
      </Svg>
    </View>
  );
}

function Trajectory2DChart({ analysis, tr }: { analysis: LosAnalysis; tr: (k: string) => string }) {
  const { width: winW } = useWindowDimensions();
  const chartW = Math.max(280, Math.min(400, winW - 48));
  const chartH = 260;
  const pad = 36;

  const { phoneAPCM, phoneMLCM, losPhase, isPostCompensationRegion } = analysis.processed;
  const idx = downsample(
    phoneAPCM.map((_, i) => i),
    700
  );

  const maxAbs = Math.max(
    1e-6,
    ...idx.map((i) => Math.max(Math.abs(phoneMLCM[i] ?? 0), Math.abs(phoneAPCM[i] ?? 0)))
  );
  const sx = (ml: number) => pad + ((ml + maxAbs) / (2 * maxAbs)) * (chartW - 2 * pad);
  const sy = (ap: number) => pad + (1 - (ap + maxAbs) / (2 * maxAbs)) * (chartH - 2 * pad);

  const order: LoSDir[] = ["F", "R", "B", "L"];
  type Seg = { x1: number; y1: number; x2: number; y2: number; stroke: string; dashed: boolean; key: string };
  const segs: Seg[] = [];

  for (const dir of order) {
    const c = dirColor(dir);
    let prev: { x: number; y: number; post: boolean } | null = null;
    let pi = 0;
    for (const i of idx) {
      if ((losPhase[i] as string) !== dir) {
        prev = null;
        continue;
      }
      const x = sx(phoneMLCM[i] ?? 0);
      const y = sy(phoneAPCM[i] ?? 0);
      const post = !!isPostCompensationRegion[i];
      if (prev) {
        const dashed = post || prev.post;
        segs.push({
          x1: prev.x,
          y1: prev.y,
          x2: x,
          y2: y,
          stroke: dashed ? hexWithAlpha(c, 0.38) : hexWithAlpha(c, 0.88),
          dashed,
          key: `${dir}-${pi++}`,
        });
      }
      prev = { x, y, post };
    }
  }

  let dBg = "";
  let first = true;
  for (const i of idx) {
    const x = sx(phoneMLCM[i] ?? 0);
    const y = sy(phoneAPCM[i] ?? 0);
    dBg += `${first ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)} `;
    first = false;
  }

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartCardHeader}>
        <View style={{ flex: 1 }}>
          <T style={styles.chartTitle}>{tr("tests:limiteEstabilidade.results.trajTitle")}</T>
          <T style={styles.chartSub}>{tr("tests:limiteEstabilidade.results.trajSubtitle")}</T>
        </View>
        <T style={styles.chartYLabel}>{tr("tests:limiteEstabilidade.results.trajY")}</T>
      </View>
      <Svg width={chartW} height={chartH}>
        <Rect x={0} y={0} width={chartW} height={chartH} fill="#FAFAFA" rx={8} />
        <Path d={dBg.trim()} stroke="rgba(100,116,139,0.22)" strokeWidth={1.2} fill="none" />
        {segs.map((s) => (
          <Line
            key={s.key}
            x1={s.x1}
            y1={s.y1}
            x2={s.x2}
            y2={s.y2}
            stroke={s.stroke}
            strokeWidth={2.4}
            strokeDasharray={s.dashed ? "5 4" : undefined}
          />
        ))}
      </Svg>
    </View>
  );
}

function FinishReasonBox({ kind, tr }: { kind: FinishKind; tr: (k: string, o?: Record<string, unknown>) => string }) {
  const map: Record<FinishKind, { title: string; sub: string; dot: string }> = {
    stability: {
      title: tr("tests:limiteEstabilidade.results.finishStabilityTitle"),
      sub: tr("tests:limiteEstabilidade.results.finishStabilitySub"),
      dot: "#22C55E",
    },
    timeout: {
      title: tr("tests:limiteEstabilidade.results.finishTimeoutTitle"),
      sub: tr("tests:limiteEstabilidade.results.finishTimeoutSub"),
      dot: "#F97316",
    },
    manual: {
      title: tr("tests:limiteEstabilidade.results.finishManualTitle"),
      sub: tr("tests:limiteEstabilidade.results.finishManualSub"),
      dot: "#3B82F6",
    },
  };
  const m = map[kind];

  return (
    <View style={styles.finishBox}>
      <T style={styles.finishCaption}>{tr("tests:limiteEstabilidade.results.finishTitle")}</T>
      <View style={styles.finishRow}>
        <View style={[styles.finishDot, { backgroundColor: m.dot }]} />
        <T style={styles.finishTitle}>{m.title}</T>
      </View>
      <T style={styles.finishSub}>{m.sub}</T>
    </View>
  );
}

export default function LimiteEstabilidadeResultScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { participant, result, jsonUri, sessionNumber } = route.params as Params;
  const [uploading, setUploading] = useState(false);
  const { isGuest } = useAuth();
  const { t } = useTranslation(["tests", "errors"]);

  useLayoutEffect(() => {
    navigation.setOptions?.({
      title: t("tests:limiteEstabilidade.title"),
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
          participant?.sexo
      ),
    [participant]
  );

  const analysis = useMemo(() => analyzeLosFromSamples(result, participant), [result, participant]);

  const finishReason = useMemo(() => normalizeFinishReason(result?.tug?.stopReason), [result]);

  const sorted = useMemo(() => {
    if (!analysis) return [];
    return analysis.directionResults
      .slice()
      .sort((a, b) => losDirectionSortKey(a.direction) - losDirectionSortKey(b.direction));
  }, [analysis]);

  const heightPct =
    analysis && analysis.heightCM != null && analysis.heightCM > 0
      ? Math.round((analysis.phoneHeightCM / analysis.heightCM) * 100)
      : 0;

  const shareJson = async () => {
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert(t("tests:common.share.title"), t("tests:common.share.unavailable"));
        return;
      }

      await Sharing.shareAsync(jsonUri, {
        mimeType: "application/json",
        dialogTitle: t("tests:common.share.jsonDialog"),
        UTI: Platform.OS === "ios" ? "public.json" : undefined,
      });
    } catch (e: any) {
      Alert.alert(t("errors:titles.error"), e?.message ?? t("tests:common.share.error"));
    }
  };

  const handleUploadCloud = async () => {
    try {
      if (uploading) return;

      setUploading(true);
      const sent = await uploadLosJsonToCollection(result, participant);

      Alert.alert(
        t("tests:common.upload.doneTitle"),
        t("tests:common.upload.doneBody", { session: sent.sessionNumber, path: sent.path })
      );
    } catch (e: unknown) {
      showCloudUploadFailure(t, e);
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
      >
        <ParticipantInfoCard participant={participant} anthropometry="heightOnly" />

        {analysis ? (
          <View style={styles.losCard}>
            <View style={styles.losHeader}>
              <T style={styles.losTitle}>{t("tests:limiteEstabilidade.results.title")}</T>
              <T style={styles.losSub}>
                {t("tests:limiteEstabilidade.results.directionsCount", {
                  count: analysis.directionResults.length,
                  version: analysis.analysisVersion,
                })}
              </T>
              <T style={styles.losCaption}>
                {t("tests:limiteEstabilidade.results.phoneHeightLine", {
                  phoneCm: analysis.phoneHeightCM.toFixed(1),
                  pct: heightPct,
                })}
              </T>
              {analysis.movementStartTimeSec != null ? (
                <T style={styles.losCaption}>
                  {t("tests:limiteEstabilidade.results.movementStart", {
                    sec: analysis.movementStartTimeSec.toFixed(2),
                  })}
                </T>
              ) : null}
            </View>

            <LosDistancesCard sorted={sorted} tr={t} />

            {analysis.warnings.length ? <WarningsBox warnings={analysis.warnings} tr={t} /> : null}

            <PolarLosChart results={sorted} tr={t} />

            <TimeSeriesBlock
              title={t("tests:limiteEstabilidade.results.apTitle")}
              subtitle={t("tests:limiteEstabilidade.results.apSubtitle")}
              yLabel={t("tests:limiteEstabilidade.results.apY")}
              analysis={analysis}
              yKey="ap"
            />
            <TimeSeriesBlock
              title={t("tests:limiteEstabilidade.results.mlTitle")}
              subtitle={t("tests:limiteEstabilidade.results.mlSubtitle")}
              yLabel={t("tests:limiteEstabilidade.results.mlY")}
              analysis={analysis}
              yKey="ml"
            />
            <TimeSeriesBlock
              title={t("tests:limiteEstabilidade.results.omegaTitle")}
              subtitle={t("tests:limiteEstabilidade.results.omegaSubtitle")}
              yLabel={t("tests:limiteEstabilidade.results.omegaY")}
              analysis={analysis}
              yKey="omega"
            />

            <Trajectory2DChart analysis={analysis} tr={t} />

            {finishReason ? <FinishReasonBox kind={finishReason} tr={t} /> : null}
          </View>
        ) : (
          <View style={styles.losCard}>
            <T style={styles.losTitle}>{t("tests:common.resultsTitle")}</T>
            <T style={styles.losSub}>{t("tests:common.insufficientSignal")}</T>
          </View>
        )}

        <View style={styles.buttonWrap}>
          <ThemedButton
            title={`${t("tests:common.share.jsonButton")}${sessionNumber ? ` • S${sessionNumber}` : ""}`}
            onPress={shareJson}
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

function ParticipantCard({
  name,
  age,
  sex,
}: {
  name: string;
  age: string;
  sex: string;
}) {
  const { t } = useTranslation(["tests"]);
  return (
    <View style={[styles.card, styles.participantCard]}>
      <View style={styles.participantHeader}>
        <View style={styles.avatar}>
          <T style={styles.avatarText}>{getInitials(name)}</T>
        </View>

        <View style={styles.participantHeaderText}>
          <T style={styles.participantOverline}>{t("tests:common.participantLabel")}</T>
          <T style={styles.participantName}>{name}</T>
        </View>
      </View>

      <View style={styles.pillRow}>
        <StatPill label={t("tests:common.ageLabel")} value={age} />
        <StatPill label={t("tests:common.sexLabel")} value={sex} />
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

function getInitials(name?: string | null) {
  const base = String(name ?? "").trim();
  if (!base || base === "—") return "P";

  const parts = base.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";

  return `${first}${last}`.toUpperCase();
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
    fontWeight: "800",
    color: "#0B63F6",
  },
  participantOverline: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  participantName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
  },
  pillRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  pill: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  pillLabel: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "700",
    marginBottom: 2,
  },
  pillValue: {
    fontSize: 15,
    color: "#111827",
    fontWeight: "800",
  },
  losCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E9EDF4",
    gap: 14,
  },
  losHeader: {
    gap: 6,
  },
  losTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
  },
  losSub: {
    fontSize: 15,
    color: "#64748B",
    lineHeight: 20,
  },
  losCaption: {
    fontSize: 12,
    color: "#94A3B8",
    lineHeight: 16,
  },
  distancesCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 10,
  },
  distancesSubtitle: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 18,
  },
  distGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  distCell: {
    flexBasis: "48%",
    flexGrow: 1,
    maxWidth: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderLeftWidth: 4,
  },
  distLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
  },
  distValue: {
    fontSize: 22,
    fontWeight: "900",
    marginTop: 4,
  },
  distUnit: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 2,
  },
  captionMuted: {
    fontSize: 11,
    color: "#64748B",
  },
  warnBox: {
    backgroundColor: "rgba(251, 146, 60, 0.12)",
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  warnTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#9A3412",
  },
  warnItem: {
    fontSize: 12,
    color: "#64748B",
  },
  chartCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 8,
  },
  chartCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  chartTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
  },
  chartSub: {
    fontSize: 12,
    color: "#64748B",
    lineHeight: 16,
  },
  chartYLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94A3B8",
  },
  finishBox: {
    paddingTop: 4,
    gap: 8,
  },
  finishCaption: {
    fontSize: 11,
    color: "#64748B",
  },
  finishRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  finishDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  finishTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  finishSub: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 18,
  },
  buttonWrap: {
    marginTop: 2,
  },
});
