import React, { useEffect, useMemo } from "react";
import { ScrollView, View, useWindowDimensions, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path, Line, Circle, Text as SvgText } from "react-native-svg";

import { T } from "../../components/Themed";
import { useTheme } from "../../contexts/ThemeContext";

type ClsKey = "robusto" | "prefragil" | "fragil";

const badgeColor = (key: ClsKey) => {
  if (key === "robusto") return "#2ECC71";
  if (key === "prefragil") return "#F1C40F";
  return "#E74C3C";
};

// máximos por domínio (pra normalizar)
const DOMAIN_META = [
  { key: "idade", label: "Idade", max: 3 },
  { key: "percepcao", label: "Saúde", max: 1 },
  { key: "avd_i", label: "AVD-I", max: 4 },
  { key: "avd_b", label: "AVD-B", max: 6 },
  { key: "cognicao", label: "Cognição", max: 4 },
  { key: "humor", label: "Humor", max: 4 },
  { key: "mobilidade", label: "Mobilidade", max: 8 },
  { key: "continencia", label: "Continência", max: 2 },
  { key: "comunicacao", label: "Comunicação", max: 4 },
  { key: "comorbidades", label: "Comorb.", max: 4 },
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

// escala por % do máximo (normalizado)
function riskColor(v01: number) {
  const v = clamp01(v01);
  if (v < 0.34) return "#2ECC71"; // bom/excelente
  if (v < 0.67) return "#F39C12"; // intermediário
  return "#E74C3C"; // ruim/péssimo
}

function riskLabel(v01: number) {
  const v = clamp01(v01);
  if (v < 0.34) return "Bom/Excelente";
  if (v < 0.67) return "Intermediário";
  return "Ruim/Péssimo";
}

function polar(cx: number, cy: number, r: number, a: number) {
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function wedgePath(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p0 = polar(cx, cy, r, a0);
  const p1 = polar(cx, cy, r, a1);
  // slice angle < π (10 domínios), então largeArcFlag = 0
  return `M ${cx} ${cy} L ${p0.x} ${p0.y} A ${r} ${r} 0 0 1 ${p1.x} ${p1.y} Z`;
}

function PizzaDomainsChart({
  values,
  labels,
  size,
  gridColor,
  baseFill,
  textColor,
}: {
  values: number[]; // 0..1
  labels: string[];
  size: number;
  gridColor: string;
  baseFill: string;
  textColor: string;
}) {
  const n = Math.max(3, values.length);
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 46;

  const slice = (Math.PI * 2) / n;
  const pad = slice * 0.10; // “gap” entre fatias

  // ângulos centrados nos rótulos, começando no topo
  const centerAngles = Array.from({ length: n }, (_, i) => -Math.PI / 2 + i * slice);

  const levels = 4;
  const rings = Array.from({ length: levels }, (_, i) => (R * (i + 1)) / levels);

  return (
    <Svg width={size} height={size}>
      {/* rings */}
      {rings.map((rr, idx) => (
        <Circle key={`ring-${idx}`} cx={cx} cy={cy} r={rr} fill="transparent" stroke={gridColor} strokeWidth={1} />
      ))}

      {/* fatias base (vazias) */}
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

      {/* separadores */}
      {centerAngles.map((ac, i) => {
        const x = cx + R * Math.cos(ac - slice / 2);
        const y = cy + R * Math.sin(ac - slice / 2);
        return <Line key={`sep-${i}`} x1={cx} y1={cy} x2={x} y2={y} stroke={gridColor} strokeWidth={1} />;
      })}

      {/* fatias preenchidas (pizza) */}
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

      {/* miolo */}
      <Circle cx={cx} cy={cy} r={4} fill={gridColor} />

      {/* labels */}
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
  const { width } = useWindowDimensions();

  const { participantName, scoreTotal, classification, blockScores } = route?.params ?? {};
  const cls = classification ?? { label: "—", key: "robusto" as ClsKey };
  const clsColor = useMemo(() => badgeColor(cls.key), [cls.key]);

  useEffect(() => {
    navigation?.setOptions?.({
      headerStyle: { backgroundColor: theme.colors.primary },
      headerTintColor: "#fff",
      headerTitleStyle: { color: "#fff", fontWeight: "900" },
      headerShadowVisible: false,
    });
  }, [navigation, theme.colors.primary]);

  const blocksArr = Array.isArray(blockScores) ? blockScores : [];

  const chart = useMemo(() => {
    const byKey = new Map<string, number>();
    blocksArr.forEach((b: any) => byKey.set(String(b.key), Number(b.score ?? 0)));

    const labels = DOMAIN_META.map((d) => d.label);
    const values = DOMAIN_META.map((d) => clamp01((byKey.get(d.key) ?? 0) / d.max));
    const raw = DOMAIN_META.map((d) => ({
      ...d,
      score: byKey.get(d.key) ?? 0,
      v01: clamp01((byKey.get(d.key) ?? 0) / d.max),
    }));

    return { labels, values, raw };
  }, [blocksArr]);

  const size = Math.min(360, Math.max(290, width - 36));
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const gridColor = theme.mode === "light" ? "rgba(20,60,120,0.14)" : "rgba(255,255,255,0.14)";
  const baseFill = theme.mode === "light" ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.06)";
  const textColor = theme.mode === "light" ? "rgba(0,0,0,0.75)" : "rgba(255,255,255,0.85)";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.card }} edges={["bottom"]}>
      <View style={styles.container}>
        {/* HERO */}
        <View style={styles.hero}>
          <View style={styles.heroPattern} pointerEvents="none">
            <View style={styles.heroRingA} />
            <View style={styles.heroRingB} />
            <View style={styles.heroDiag} />
          </View>

          <T style={styles.heroTitle}>Resultado IVCF-20</T>
          <T style={styles.heroSub}>{participantName ?? ""}</T>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
          {/* TOTAL */}
          <View style={[styles.card, { marginTop: -18 }]}>
            <T style={{ color: theme.colors.muted }}>Score total</T>

            <View style={{ marginTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <T style={{ fontSize: 46, fontWeight: "900" }}>{scoreTotal ?? 0}</T>

              <View style={[styles.badge, { backgroundColor: clsColor }]}>
                <T style={{ color: "#111", fontWeight: "900" }}>{cls.label}</T>
              </View>
            </View>

            <T style={styles.smallHint}>Quanto maior o score, maior a vulnerabilidade clínico-funcional.</T>
          </View>

          {/* TEIA PIZZA */}
          <T style={styles.sectionTitle}>Mapa de domínios (pizza)</T>

          <View style={styles.card}>
            <T style={styles.hintText}>Cada fatia enche do centro para fora conforme (score ÷ máximo do domínio).</T>

            {/* legenda */}
            <View style={styles.legendRow}>
              <View style={[styles.legendPill, { borderColor: hexToRgba("#2ECC71", 0.6) }]}>
                <View style={[styles.legendDot, { backgroundColor: "#2ECC71" }]} />
                <T style={styles.legendText}>Bom/Excelente</T>
              </View>

              <View style={[styles.legendPill, { borderColor: hexToRgba("#F39C12", 0.6) }]}>
                <View style={[styles.legendDot, { backgroundColor: "#F39C12" }]} />
                <T style={styles.legendText}>Intermediário</T>
              </View>

              <View style={[styles.legendPill, { borderColor: hexToRgba("#E74C3C", 0.6) }]}>
                <View style={[styles.legendDot, { backgroundColor: "#E74C3C" }]} />
                <T style={styles.legendText}>Ruim/Péssimo</T>
              </View>
            </View>

            <View style={{ alignItems: "center", marginTop: 12 }}>
              <PizzaDomainsChart
                values={chart.values}
                labels={chart.labels}
                size={size}
                gridColor={gridColor}
                baseFill={baseFill}
                textColor={textColor}
              />
            </View>

            {/* top 3 piores */}
            <View style={{ marginTop: 12 }}>
              {chart.raw
                .slice()
                .sort((a, b) => (b.v01 ?? 0) - (a.v01 ?? 0))
                .slice(0, 3)
                .map((d, idx) => (
                  <View key={d.key} style={[styles.topRow, idx === 0 && { borderTopWidth: 0 }]}>
                    <T style={{ fontWeight: "900" }}>{d.label}</T>
                    <T style={{ color: riskColor(d.v01), fontWeight: "900" }}>
                      {riskLabel(d.v01)} ({Math.round(d.v01 * 100)}%)
                    </T>
                  </View>
                ))}
            </View>
          </View>

          {/* LISTA */}
          <T style={styles.sectionTitle}>Score por domínio</T>

          <View style={styles.card}>
            {blocksArr.map((b: any, i: number) => (
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
                <T style={{ fontWeight: "900" }}>{b.score}</T>
              </View>
            ))}
          </View>
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
      backgroundColor: theme.mode === "light" ? "rgba(0,0,0,0.02)" : "rgba(255,255,255,0.06)",
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
  });
}