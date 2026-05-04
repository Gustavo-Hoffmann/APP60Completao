import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../contexts/ThemeContext";
import { Routes } from "../../navigation/routes";
import type { Participant } from "../../models/types";

type Patient = {
  id: string;
  name: string;
  dateOfBirth?: string;
};

function participantToPatient(p: Participant): Patient {
  return {
    id: p.id ?? "",
    name: (p as any).name,
    dateOfBirth: (p as any).dob ?? (p as any).dateOfBirth,
  };
}

type FesiAnswerValue = 1 | 2 | 3 | 4;
type Answers = Record<string, FesiAnswerValue | undefined>;

const FESI_ITEM_KEYS = [
  "q1",
  "q2",
  "q3",
  "q4",
  "q5",
  "q6",
  "q7",
  "q8",
  "q9",
  "q10",
  "q11",
  "q12",
  "q13",
  "q14",
  "q15",
  "q16",
] as const;

function classifyFesiKey(score: number): "baixa" | "moderada" | "alta" {
  if (score <= 19) return "baixa";
  if (score <= 27) return "moderada";
  return "alta";
}

function computeScore(answers: Answers) {
  return FESI_ITEM_KEYS.reduce((acc, key) => acc + Number(answers[key] ?? 0), 0);
}

const AnswerError = ({ text, styles }: { text: string; styles: any }) => {
  if (!text) return null;
  return <Text style={styles.errorText}>{text}</Text>;
};

const RadioScale = ({
  value,
  onChange,
  styles,
  options,
}: {
  value?: FesiAnswerValue;
  onChange: (v: FesiAnswerValue) => void;
  styles: any;
  options: { value: FesiAnswerValue; label: string; pointsLabel: string }[];
}) => {
  return (
    <View style={{ gap: 10 }}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            activeOpacity={0.85}
            style={[styles.radioRow, active && styles.radioRowActive]}
            onPress={() => onChange(opt.value)}
          >
            <View style={[styles.dot, active && styles.dotActive]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.radioText, active && styles.radioTextActive]}>{opt.label}</Text>
              <Text style={[styles.radioScore, active && styles.radioTextActive]}>{opt.pointsLabel}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export function FESIScreen({ navigation, route }: any) {
  const { theme } = useTheme();
  const { t } = useTranslation(["questionnaires", "common"]);
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const participant = route?.params?.participant as Participant | undefined;
  const participantId: string = route?.params?.participantId ?? participant?.id ?? "";

  const [patient, setPatient] = useState<Patient | null>(
    participant ? participantToPatient(participant) : null
  );
  const [answers, setAnswers] = useState<Answers>({});
  const [index, setIndex] = useState(0);
  const [error, setError] = useState("");

  const scaleOptions = useMemo(
    () =>
      ([1, 2, 3, 4] as const).map((value) => ({
        value,
        label: t(`questionnaires:fesi.scale.${value}`),
        pointsLabel:
          value === 1
            ? t("questionnaires:fesi.points_one", { count: value })
            : t("questionnaires:fesi.points_other", { count: value }),
      })),
    [t]
  );

  useEffect(() => {
    navigation?.setOptions?.({
      headerStyle: { backgroundColor: theme.colors.primary },
      headerTintColor: "#fff",
      headerTitleStyle: { color: "#fff", fontWeight: "900" },
      headerShadowVisible: false,
      title: t("questionnaires:fesi.instrumentName"),
    });
  }, [navigation, theme.colors.primary, t]);

  useEffect(() => {
    if (!participant) {
      navigation.replace(Routes.ParticipantPick, {
        nextRoute: Routes.FESI,
        testTitle: t("questionnaires:hub.openFesI"),
        testKey: "fesi",
      });
    }
  }, [participant, navigation, t]);

  useEffect(() => {
    if (participant) setPatient(participantToPatient(participant));
  }, [participant]);

  const itemKey = FESI_ITEM_KEYS[index];
  const itemText = t(`questionnaires:fesi.items.${itemKey}`);
  const total = useMemo(() => computeScore(answers), [answers]);
  const answeredCount = useMemo(
    () => FESI_ITEM_KEYS.filter((k) => answers[k] != null).length,
    [answers]
  );

  const goNext = () => {
    setError("");

    if (!answers[itemKey]) {
      setError(t("questionnaires:fesi.selectAnswerError"));
      return;
    }

    if (index < FESI_ITEM_KEYS.length - 1) {
      setIndex((i) => i + 1);
      return;
    }

    const scoreTotal = computeScore(answers);
    const classificationKey = classifyFesiKey(scoreTotal);

    navigation.navigate(Routes.FESIResult, {
      participant,
      participantId,
      participantName: patient?.name ?? participant?.name ?? "",
      patientId: participantId,
      patientName: patient?.name ?? participant?.name ?? "",
      scoreTotal,
      meanScore: Number((scoreTotal / FESI_ITEM_KEYS.length).toFixed(2)),
      classification: { key: classificationKey },
      answers,
      itemScores: FESI_ITEM_KEYS.map((key, idx) => ({
        key,
        number: idx + 1,
        score: Number(answers[key] ?? 0),
      })),
      meta: {
        instrument: "FES-I",
        minScore: 16,
        maxScore: 64,
        items: FESI_ITEM_KEYS.length,
      },
    });
  };

  const goPrev = () => {
    if (index === 0) return;
    setIndex((i) => i - 1);
    setError("");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.card }} edges={["bottom"]}>
      <View style={styles.container}>
        <View style={styles.hero}>
          <View style={styles.heroPattern} pointerEvents="none">
            <View style={styles.heroRingA} />
            <View style={styles.heroRingB} />
            <View style={styles.heroDiag} />
          </View>

          <View style={styles.heroTopRow}>
            <Text style={styles.heroTitle}>{t("questionnaires:fesi.instrumentName")}</Text>
            <View style={styles.pill}>
              <Text style={styles.pillText}>
                {index + 1}/{FESI_ITEM_KEYS.length}
              </Text>
            </View>
          </View>

          <Text style={styles.heroSub}>{patient?.name ?? t("questionnaires:fesi.participantFallback")}</Text>
          <Text style={styles.heroHint}>{t("questionnaires:fesi.subtitle")}</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
          <View style={styles.card}>
            <Text style={styles.blockTitle}>
              {t("questionnaires:fesi.questionProgress", { n: index + 1 })}
            </Text>
            <Text style={styles.qText}>{itemText}</Text>
            <Text style={styles.hintText}>{t("questionnaires:fesi.concernPrompt")}</Text>

            <View style={{ marginTop: 14 }}>
              <RadioScale
                styles={styles}
                options={scaleOptions}
                value={answers[itemKey]}
                onChange={(v) => setAnswers((prev) => ({ ...prev, [itemKey]: v }))}
              />
            </View>

            <AnswerError text={error} styles={styles} />
          </View>

          <View style={styles.cardSoft}>
            <Text style={styles.progressText}>
              {t("questionnaires:fesi.answered", {
                answered: answeredCount,
                total: FESI_ITEM_KEYS.length,
              })}
            </Text>
            <Text style={styles.progressText}>
              {total
                ? t("questionnaires:fesi.partialScore", { score: total })
                : t("questionnaires:fesi.partialScoreEmpty")}
            </Text>
          </View>

          <View style={styles.navRow}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.navBtn, index === 0 && styles.navBtnDisabled]}
              onPress={goPrev}
              disabled={index === 0}
            >
              <Text style={styles.navBtnText}>{t("questionnaires:fesi.back")}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.navBtn, styles.navBtnPrimary]}
              onPress={goNext}
            >
              <Text style={[styles.navBtnText, styles.navBtnTextPrimary]}>
                {index === FESI_ITEM_KEYS.length - 1
                  ? t("questionnaires:fesi.viewResult")
                  : t("questionnaires:fesi.next")}
              </Text>
            </TouchableOpacity>
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
    heroTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    heroTitle: { color: "#fff", fontSize: 22, fontWeight: "900" },
    heroSub: { marginTop: 6, color: "#fff", opacity: 0.92, fontWeight: "800" },
    heroHint: { marginTop: 8, color: "#fff", opacity: 0.9 },

    pill: {
      backgroundColor: "rgba(255,255,255,0.18)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.35)",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
    },
    pillText: { color: "#fff", fontWeight: "900" },

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
    cardSoft: {
      marginHorizontal: SP.lg,
      marginTop: 12,
      backgroundColor:
        theme.mode === "light" ? "rgba(11,99,246,0.06)" : "rgba(255,255,255,0.06)",
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 6,
    },

    blockTitle: { fontSize: 18, fontWeight: "900", color: theme.colors.text },
    qText: {
      marginTop: 12,
      fontSize: 16,
      lineHeight: 23,
      color: theme.colors.text,
      fontWeight: "800",
    },
    hintText: { marginTop: 10, color: theme.colors.muted, lineHeight: 20 },

    radioRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 13,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.mode === "light" ? "rgba(0,0,0,0.02)" : "rgba(255,255,255,0.05)",
    },
    radioRowActive: {
      borderColor: theme.colors.primary,
      backgroundColor:
        theme.mode === "light" ? "rgba(11,99,246,0.10)" : "rgba(255,255,255,0.10)",
    },
    dot: {
      width: 18,
      height: 18,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: theme.colors.border,
    },
    dotActive: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary,
    },
    radioText: { color: theme.colors.text, fontWeight: "900" },
    radioScore: {
      marginTop: 2,
      color: theme.colors.muted,
      fontSize: 12,
      fontWeight: "800",
    },
    radioTextActive: { color: theme.colors.primary },

    errorText: { marginTop: 12, color: "#E74C3C", fontWeight: "900" },
    progressText: { color: theme.colors.primary, fontWeight: "900" },

    navRow: { flexDirection: "row", gap: 12, marginHorizontal: SP.lg, marginTop: 16 },
    navBtn: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.bg,
    },
    navBtnPrimary: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    navBtnDisabled: { opacity: 0.45 },
    navBtnText: { color: theme.colors.text, fontWeight: "900" },
    navBtnTextPrimary: { color: "#fff" },
  });
}
