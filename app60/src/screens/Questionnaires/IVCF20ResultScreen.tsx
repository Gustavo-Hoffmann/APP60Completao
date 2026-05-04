import React, { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  View,
  useWindowDimensions,
  StyleSheet,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path, Line, Circle, Text as SvgText } from "react-native-svg";
import { useTranslation } from "react-i18next";

import { T } from "../../components/Themed";
import { ThemedButton } from "../../components/ThemedButton";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import type { Participant } from "../../models/types";
import { QuestionnaireParticipantCard } from "../../components/questionnaires/QuestionnaireParticipantCard";
import {
  getNextSessionNumber,
  uploadIvcf20ResultToCollection,
  type Ivcf20CategoryScore,
  type Ivcf20Classification,
} from "../../services/tests/uploadTestJson";

type ClsKey = "robusto" | "prefragil" | "fragil";

type RouteParams = {
  participant?: Participant;
  participantName?: string;
  scoreTotal?: number;
  classification?: Ivcf20Classification;
  blockScores?: Ivcf20CategoryScore[];
  answers?: Record<string, unknown>;
  meta?: Record<string, unknown>;
};

const badgeColor = (key: ClsKey) => {
  if (key === "robusto") return "#2ECC71";
  if (key === "prefragil") return "#F1C40F";
  return "#E74C3C";
};

const IVCF_DOMAIN_ROWS = [
  { key: "idade", max: 3 },
  { key: "percepcao", max: 1 },
  { key: "avd_i", max: 4 },
  { key: "avd_b", max: 6 },
  { key: "cognicao", max: 4 },
  { key: "humor", max: 4 },
  { key: "mobilidade", max: 8 },
  { key: "continencia", max: 2 },
  { key: "comunicacao", max: 4 },
  { key: "comorbidades", max: 4 },
] as const;

function clamp01(x: number) {
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function hexToRgba(hex: string, a: number) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}

function riskColor(v01: number) {
  const v = clamp01(v01);
  if (v < 0.34) return "#2ECC71";
  if (v < 0.67) return "#F39C12";
  return "#E74C3C";
}

function polar(cx: number, cy: number, r: number, a: number) {
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function wedgePath(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p0 = polar(cx, cy, r, a0);
  const p1 = polar(cx, cy, r, a1);
  return `M ${cx} ${cy} L ${p0.x} ${p0.y} A ${r} ${r} 0 0 1 ${p1.x} ${p1.y} Z`;
}

function PizzaDomainsChart({
  values,
  labels,
  size,
  gridColor,
  baseFill,
}: {
  values: number[];
  labels: string[];
  size: number;
  gridColor: string;
  baseFill: string;
}) {
  const n = Math.max(3, values.length);
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 46;

  const slice = (Math.PI * 2) / n;
  const pad = slice * 0.1;
  const centerAngles = Array.from({ length: n }, (_, i) => -Math.PI / 2 + i * slice);

  const levels = 4;
  const rings = Array.from({ length: levels }, (_, i) => (R * (i + 1)) / levels);

  return (
    <Svg width={size} height={size}>
      {rings.map((rr, idx) => (
        <Circle
          key={`ring-${idx}`}
          cx={cx}
          cy={cy}
          r={rr}
          fill="transparent"
          stroke={gridColor}
          strokeWidth={1}
        />
      ))}

      {centerAngles.map((ac, i) => {
        const a0 = ac - slice / 2 + pad / 2;
        const a1 = ac + slice / 2 - pad / 2;
        return (
          <Path
            key={`base-${i}`}
            d={wedgePath(cx, cy, R, a0, a1)}
            fill={baseFill}
            stroke="transparent"
          />
        );
      })}

      {centerAngles.map((ac, i) => {
        const x = cx + R * Math.cos(ac - slice / 2);
        const y = cy + R * Math.sin(ac - slice / 2);
        return (
          <Line
            key={`sep-${i}`}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke={gridColor}
            strokeWidth={1}
          />
        );
      })}

      {centerAngles.map((ac, i) => {
        const v = clamp01(values[i] ?? 0);
        const col = riskColor(v);
        const a0 = ac - slice / 2 + pad / 2;
        const a1 = ac + slice / 2 - pad / 2;
        const rr = Math.max(2, R * v);

        return (
          <Path
            key={`fill-${i}`}
            d={wedgePath(cx, cy, rr, a0, a1)}
            fill={hexToRgba(col, 0.35)}
            stroke={hexToRgba(col, 0.85)}
            strokeWidth={1.4}
          />
        );
      })}

      <Circle cx={cx} cy={cy} r={4} fill={gridColor} />

      {centerAngles.map((ac, i) => {
        const v = clamp01(values[i] ?? 0);
        const col = riskColor(v);

        const lx = cx + (R + 18) * Math.cos(ac);
        const ly = cy + (R + 18) * Math.sin(ac);
        const c = Math.cos(ac);
        const anchor = c > 0.25 ? "start" : c < -0.25 ? "end" : "middle";

        return (
          <SvgText
            key={`lab-${i}`}
            x={lx}
            y={ly}
            fontSize="11"
            fill={col}
            textAnchor={anchor as any}
            alignmentBaseline="middle"
          >
            {labels[i] ?? ""}
          </SvgText>
        );
      })}
    </Svg>
  );
}

export function IVCF20ResultScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const { t } = useTranslation(["questionnaires", "common"]);
  const { isGuest } = useAuth();
  const { width } = useWindowDimensions();
  const [uploading, setUploading] = useState(false);
  const [nextSessionNumber, setNextSessionNumber] = useState<number | null>(null);

  const {
    participant,
    participantName,
    scoreTotal,
    classification,
    blockScores,
    answers,
    meta,
  } = (route?.params ?? {}) as RouteParams;

  const clsKey = (classification?.key ?? "robusto") as ClsKey;
  const clsDisplayLabel = t(`questionnaires:ivcf20.classification.${clsKey}`);
  const clsColor = useMemo(() => badgeColor(clsKey), [clsKey]);

  const dash = t("questionnaires:ivcf20.result.unknown");

  const riskLabelT = useMemo(
    () => (v01: number) => {
      const v = clamp01(v01);
      if (v < 0.34) return t("questionnaires:ivcf20.result.riskGood");
      if (v < 0.67) return t("questionnaires:ivcf20.result.riskMid");
      return t("questionnaires:ivcf20.result.riskBad");
    },
    [t]
  );

  useEffect(() => {
    navigation?.setOptions?.({
      headerStyle: { backgroundColor: theme.colors.primary },
      headerTintColor: "#fff",
      headerTitleStyle: { color: "#fff", fontWeight: "900" },
      headerShadowVisible: false,
      title: t("questionnaires:ivcf20.result.title"),
    });
  }, [navigation, theme.colors.primary, t]);

  useEffect(() => {
    let alive = true;

    async function loadNextSession() {
      try {
        if (!participant?.id) return;
        const s = await getNextSessionNumber(String(participant.id), "IVCF20");
        if (alive) setNextSessionNumber(s);
      } catch {
        if (alive) setNextSessionNumber(null);
      }
    }

    loadNextSession();

    return () => {
      alive = false;
    };
  }, [participant?.id]);

  const blocksArr = useMemo(() => {
    const arr = Array.isArray(blockScores) ? blockScores : [];

    return IVCF_DOMAIN_ROWS.map((metaItem) => {
      const found = arr.find((b: any) => String(b?.key) === metaItem.key);
      return {
        key: metaItem.key,
        label: String(
          found?.label ?? t(`questionnaires:ivcf20.chartDomains.${metaItem.key}`)
        ),
        score: Number(found?.score ?? 0),
        max_score: Number(found?.max_score ?? metaItem.max),
      };
    });
  }, [blockScores, t]);

  const chart = useMemo(() => {
    const labels = blocksArr.map((d) => d.label);
    const values = blocksArr.map((d) => clamp01(d.score / d.max_score));
    const raw = blocksArr.map((d) => ({
      ...d,
      v01: clamp01(d.score / d.max_score),
    }));

    return { labels, values, raw };
  }, [blocksArr]);

  const handleUploadCloud = async () => {
    try {
      if (uploading) return;

      if (!participant?.id) {
        Alert.alert(
          t("questionnaires:ivcf20.result.uploadErrorTitle"),
          t("questionnaires:ivcf20.result.uploadMissingParticipant")
        );
        return;
      }

      setUploading(true);

      const sessionNumberToUse =
        nextSessionNumber ?? (await getNextSessionNumber(String(participant.id), "IVCF20"));

      const sent = await uploadIvcf20ResultToCollection({
        participant,
        sessionNumber: sessionNumberToUse,
        scoreTotal: Number(scoreTotal ?? 0),
        classification: { key: clsKey, label: clsDisplayLabel },
        blockScores: blocksArr,
        answers,
        meta,
      });

      setNextSessionNumber(sent.sessionNumber + 1);

      Alert.alert(
        t("questionnaires:ivcf20.result.uploadOkTitle"),
        t("questionnaires:ivcf20.result.uploadOkBody", {
          name: participant?.name ?? participantName ?? dash,
          session: sent.sessionNumber,
          path: sent.path,
        })
      );
    } catch (e: any) {
      Alert.alert(
        t("questionnaires:ivcf20.result.uploadErrorTitle"),
        e?.message ?? t("questionnaires:ivcf20.result.uploadFailBody")
      );
    } finally {
      setUploading(false);
    }
  };

  const size = Math.min(360, Math.max(290, width - 36));
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const gridColor =
    theme.mode === "light" ? "rgba(20,60,120,0.14)" : "rgba(255,255,255,0.14)";
  const baseFill =
    theme.mode === "light" ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.06)";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.card }} edges={["bottom"]}>
      <View style={styles.container}>
        <View style={styles.hero}>
          <View style={styles.heroPattern} pointerEvents="none">
            <View style={styles.heroRingA} />
            <View style={styles.heroRingB} />
            <View style={styles.heroDiag} />
          </View>

          <T style={styles.heroTitle}>{t("questionnaires:ivcf20.result.title")}</T>
          <T style={styles.heroSub}>{participant?.name ?? participantName ?? ""}</T>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
        >
          <View style={{ marginHorizontal: 18, marginTop: 14 }}>
            <QuestionnaireParticipantCard
              name={participant?.name ?? participantName ?? dash}
              subtitle={t("questionnaires:ivcf20.result.title")}
              dob={participant?.dob ?? null}
              sex={participant?.biologicalSex}
              id={participant?.id ?? null}
            />
          </View>

          <View style={[styles.card, { marginTop: 14 }]}>
            <T style={{ color: theme.colors.muted }}>{t("questionnaires:ivcf20.result.totalScore")}</T>

            <View
              style={{
                marginTop: 10,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <T style={{ fontSize: 46, fontWeight: "900" }}>{Number(scoreTotal ?? 0)}</T>

              <View style={[styles.badge, { backgroundColor: clsColor }]}>
                <T style={{ color: "#111", fontWeight: "900" }}>{clsDisplayLabel}</T>
              </View>
            </View>

            <T style={styles.smallHint}>{t("questionnaires:ivcf20.result.scoreHint")}</T>

            <View style={styles.metaRow}>
              <T style={styles.metaPill}>
                {t("questionnaires:ivcf20.result.participantPill", {
                  name: participant?.name ?? participantName ?? dash,
                })}
              </T>

              <T style={styles.metaPill}>
                {t("questionnaires:ivcf20.result.sessionPill", {
                  session: nextSessionNumber != null ? `S${nextSessionNumber}` : dash,
                })}
              </T>
            </View>
          </View>

          <T style={styles.sectionTitle}>{t("questionnaires:ivcf20.result.pizzaTitle")}</T>

          <View style={styles.card}>
            <T style={styles.hintText}>{t("questionnaires:ivcf20.result.pizzaHint")}</T>

            <View style={styles.legendRow}>
              <View
                style={[styles.legendPill, { borderColor: hexToRgba("#2ECC71", 0.6) }]}
              >
                <View style={[styles.legendDot, { backgroundColor: "#2ECC71" }]} />
                <T style={styles.legendText}>{t("questionnaires:ivcf20.result.riskGood")}</T>
              </View>

              <View
                style={[styles.legendPill, { borderColor: hexToRgba("#F39C12", 0.6) }]}
              >
                <View style={[styles.legendDot, { backgroundColor: "#F39C12" }]} />
                <T style={styles.legendText}>{t("questionnaires:ivcf20.result.riskMid")}</T>
              </View>

              <View
                style={[styles.legendPill, { borderColor: hexToRgba("#E74C3C", 0.6) }]}
              >
                <View style={[styles.legendDot, { backgroundColor: "#E74C3C" }]} />
                <T style={styles.legendText}>{t("questionnaires:ivcf20.result.riskBad")}</T>
              </View>
            </View>

            <View style={{ alignItems: "center", marginTop: 12 }}>
              <PizzaDomainsChart
                values={chart.values}
                labels={chart.labels}
                size={size}
                gridColor={gridColor}
                baseFill={baseFill}
              />
            </View>

            <View style={{ marginTop: 12 }}>
              {chart.raw
                .slice()
                .sort((a, b) => (b.v01 ?? 0) - (a.v01 ?? 0))
                .slice(0, 3)
                .map((d, idx) => (
                  <View key={d.key} style={[styles.topRow, idx === 0 && { borderTopWidth: 0 }]}>
                    <T style={{ fontWeight: "900" }}>{d.label}</T>
                    <T style={{ color: riskColor(d.v01), fontWeight: "900" }}>
                      {riskLabelT(d.v01)} ({Math.round(d.v01 * 100)}%)
                    </T>
                  </View>
                ))}
            </View>
          </View>

          <T style={styles.sectionTitle}>{t("questionnaires:ivcf20.result.domainScores")}</T>

          <View style={styles.card}>
            {blocksArr.map((b, i) => (
              <View
                key={b.key}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingVertical: 10,
                  borderBottomWidth: i === blocksArr.length - 1 ? 0 : 1,
                  borderBottomColor: theme.colors.border,
                }}
              >
                <T>{b.label}</T>
                <T style={{ fontWeight: "900" }}>
                  {b.score} / {b.max_score}
                </T>
              </View>
            ))}
          </View>

          {!isGuest && (
            <View style={styles.card}>
              <ThemedButton
                title={
                  uploading
                    ? t("questionnaires:ivcf20.result.uploading")
                    : t("questionnaires:ivcf20.result.upload")
                }
                onPress={handleUploadCloud}
              />
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(theme: any) {
  const SP = { lg: 18 } as const;

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.card },

    hero: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: SP.lg,
      paddingTop: SP.lg,
      paddingBottom: 26,
      borderBottomLeftRadius: 24,
      borderBottomRightRadius: 24,
      overflow: "hidden",
    },
    heroPattern: { ...StyleSheet.absoluteFillObject, opacity: 0.25 },
    heroRingA: {
      position: "absolute",
      width: 220,
      height: 220,
      borderRadius: 110,
      borderWidth: 2,
      borderColor: "#FFFFFF",
      right: -90,
      top: -60,
    },
    heroRingB: {
      position: "absolute",
      width: 140,
      height: 140,
      borderRadius: 70,
      borderWidth: 2,
      borderColor: "#FFFFFF",
      left: -60,
      bottom: -50,
    },
    heroDiag: {
      position: "absolute",
      width: 520,
      height: 2,
      backgroundColor: "#FFFFFF",
      top: 70,
      left: -140,
      transform: [{ rotate: "-12deg" }],
      opacity: 0.45,
    },

    heroTitle: { color: "#fff", fontSize: 22, fontWeight: "900" },
    heroSub: { marginTop: 6, color: "#fff", opacity: 0.92 },

    card: {
      marginHorizontal: SP.lg,
      marginTop: 14,
      backgroundColor: theme.colors.bg,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      shadowColor: "#000",
      shadowOpacity: theme.mode === "light" ? 0.08 : 0.25,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },

    badge: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999 },

    sectionTitle: { marginTop: 16, marginHorizontal: SP.lg, fontSize: 16, fontWeight: "900" },

    hintText: { color: theme.colors.muted, lineHeight: 20 },
    smallHint: { marginTop: 10, color: theme.colors.muted, lineHeight: 20 },

    legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 },
    legendPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 999,
      borderWidth: 1,
      backgroundColor:
        theme.mode === "light" ? "rgba(0,0,0,0.02)" : "rgba(255,255,255,0.06)",
    },
    legendDot: { width: 10, height: 10, borderRadius: 6 },
    legendText: { color: theme.colors.muted, fontWeight: "900", fontSize: 12 },

    topRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },

    metaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 12,
    },
    metaPill: {
      fontSize: 12,
      fontWeight: "800",
      color: theme.colors.primary,
      backgroundColor:
        theme.mode === "light" ? "rgba(11,99,246,0.10)" : "rgba(255,255,255,0.08)",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      overflow: "hidden",
    },
  });
}