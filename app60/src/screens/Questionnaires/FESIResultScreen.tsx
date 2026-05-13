import React, { useEffect, useMemo, useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import * as Sharing from "expo-sharing";

import { T } from "../../components/Themed";
import { ThemedButton } from "../../components/ThemedButton";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import type { Participant } from "../../models/types";
import { QuestionnaireParticipantCard } from "../../components/questionnaires/QuestionnaireParticipantCard";
import { showCloudUploadFailure } from "../../services/tests/uploadSyncErrors";
import {
  getNextSessionNumber,
  saveFesiJsonToCache,
  uploadFesiResultToCollection,
} from "../../services/tests/uploadTestJson";

type FesiClassificationKey = "baixa" | "moderada" | "alta";

type ItemScore = {
  key: string;
  number: number;
  score: number;
};

type RouteParams = {
  participant?: Participant;
  participantName?: string;
  scoreTotal?: number;
  meanScore?: number;
  classification?: { key: FesiClassificationKey; label?: string };
  itemScores?: ItemScore[];
  answers?: Record<string, unknown>;
  meta?: Record<string, unknown>;
};

const CLASSIFICATION_ORDER: FesiClassificationKey[] = ["baixa", "moderada", "alta"];

function classifyFesiKeyFromTotal(score: number): FesiClassificationKey {
  if (score <= 19) return "baixa";
  if (score <= 27) return "moderada";
  return "alta";
}

function badgeColor(key: FesiClassificationKey) {
  if (key === "baixa") return "#2ECC71";
  if (key === "moderada") return "#F1C40F";
  return "#E74C3C";
}

function answerScoreColor(score: number) {
  if (score <= 1) return "#16A34A";
  if (score === 2) return "#1456D9";
  if (score === 3) return "#F59E0B";
  return "#DC2626";
}

export function FESIResultScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const { t } = useTranslation(["questionnaires", "common", "tests", "errors"]);
  const { isGuest } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [nextSessionNumber, setNextSessionNumber] = useState<number | null>(null);
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const {
    participant,
    participantName,
    scoreTotal,
    meanScore,
    classification,
    itemScores,
    answers,
    meta,
  } = (route?.params ?? {}) as RouteParams;

  const total = Number(scoreTotal ?? 0);
  const clsKey: FesiClassificationKey =
    classification?.key ?? classifyFesiKeyFromTotal(total || 16);
  const clsLabel = t(`questionnaires:fesi.classification.${clsKey}.badge`);
  const clsColor = badgeColor(clsKey);

  useEffect(() => {
    navigation?.setOptions?.({
      headerStyle: { backgroundColor: theme.colors.primary },
      headerTintColor: "#fff",
      headerTitleStyle: { color: "#fff", fontWeight: "900" },
      headerShadowVisible: false,
      title: t("questionnaires:fesi.resultTitle"),
    });
  }, [navigation, theme.colors.primary, t]);

  useEffect(() => {
    let alive = true;

    async function loadNextSession() {
      try {
        if (!participant?.id) return;
        const session = await getNextSessionNumber(String(participant.id), "FESI");
        if (alive) setNextSessionNumber(session);
      } catch {
        if (alive) setNextSessionNumber(null);
      }
    }

    loadNextSession();

    return () => {
      alive = false;
    };
  }, [participant?.id]);

  const dash = t("questionnaires:fesi.result.dash");
  const resolvedMeanScore = Number(meanScore ?? (total ? total / 16 : 0));
  const resolvedItemScores = itemScores ?? [];

  const handleShareJson = async () => {
    try {
      if (!participant?.id) {
        Alert.alert(
          t("tests:common.upload.errorTitle"),
          t("questionnaires:fesi.result.missingParticipant")
        );
        return;
      }

      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert(t("tests:common.share.title"), t("tests:common.share.unavailable"));
        return;
      }

      let sessionNumberToUse = nextSessionNumber ?? 1;
      if (nextSessionNumber == null) {
        try {
          sessionNumberToUse = await getNextSessionNumber(String(participant.id), "FESI");
        } catch {
          sessionNumberToUse = 1;
        }
      }

      const saved = await saveFesiJsonToCache({
        participant,
        sessionNumber: sessionNumberToUse,
        scoreTotal: total,
        meanScore: resolvedMeanScore,
        classification: { key: clsKey, label: clsLabel },
        itemScores: resolvedItemScores,
        answers,
        meta,
      });

      await Sharing.shareAsync(saved.uri, {
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

      if (!participant?.id) {
        Alert.alert(
          t("tests:common.upload.errorTitle"),
          t("questionnaires:fesi.result.missingParticipant")
        );
        return;
      }

      setUploading(true);

      const sessionNumberToUse =
        nextSessionNumber ?? (await getNextSessionNumber(String(participant.id), "FESI"));

      const sent = await uploadFesiResultToCollection({
        participant,
        sessionNumber: sessionNumberToUse,
        scoreTotal: total,
        meanScore: resolvedMeanScore,
        classification: { key: clsKey, label: clsLabel },
        itemScores: resolvedItemScores,
        answers,
        meta,
      });

      setNextSessionNumber(sent.sessionNumber + 1);

      Alert.alert(
        t("tests:common.upload.doneTitle"),
        t("tests:common.upload.doneBody", {
          session: sent.sessionNumber,
          path: sent.path,
        })
      );
    } catch (e: unknown) {
      showCloudUploadFailure(t, e);
    } finally {
      setUploading(false);
    }
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

          <T style={styles.heroTitle}>{t("questionnaires:fesi.resultTitle")}</T>
          <T style={styles.heroSub}>{participant?.name ?? participantName ?? ""}</T>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
          <View style={{ marginHorizontal: 18, marginTop: 14 }}>
            <QuestionnaireParticipantCard
              name={participant?.name ?? participantName ?? dash}
              subtitle={t("questionnaires:fesi.subtitle")}
              dob={participant?.dob ?? null}
              sex={participant?.biologicalSex}
            />
          </View>

          <View style={styles.card}>
            <T style={styles.cardLabel}>{t("questionnaires:fesi.result.totalScore")}</T>

            <View style={styles.scoreRow}>
              <T style={styles.scoreNumber}>{total}</T>
              <View style={[styles.badge, { backgroundColor: clsColor }]}>
                <T style={styles.badgeText}>{clsLabel}</T>
              </View>
            </View>

            <T style={styles.smallHint}>{t("questionnaires:fesi.result.scoreHint")}</T>
            <T style={styles.smallHint}>
              {t("questionnaires:fesi.result.meanPerItem", {
                value: resolvedMeanScore.toFixed(2),
              })}
            </T>
          </View>

          <T style={styles.sectionTitle}>{t("questionnaires:fesi.result.classificationTitle")}</T>

          <View style={styles.card}>
            <View style={styles.tableHeader}>
              <T style={[styles.th, { flex: 0.7 }]}>{t("questionnaires:fesi.result.thScore")}</T>
              <T style={[styles.th, { flex: 1.5 }]}>{t("questionnaires:fesi.result.thClassification")}</T>
              <T style={[styles.th, { flex: 0.7, textAlign: "right" }]}>{t("questionnaires:fesi.result.thStatus")}</T>
            </View>

            {CLASSIFICATION_ORDER.map((rowKey) => {
              const active = rowKey === clsKey;
              const range = t(`questionnaires:fesi.classification.${rowKey}.range`);
              const rowLabel = t(`questionnaires:fesi.classification.${rowKey}.row`);

              return (
                <View key={rowKey} style={[styles.tableRow, active && styles.tableRowActive]}>
                  <T style={[styles.td, { flex: 0.7 }, active && styles.tdActive]}>{range}</T>
                  <T style={[styles.td, { flex: 1.5 }, active && styles.tdActive]}>{rowLabel}</T>
                  <T style={[styles.td, { flex: 0.7, textAlign: "right" }, active && styles.tdActive]}>
                    {active ? t("questionnaires:fesi.result.here") : dash}
                  </T>
                </View>
              );
            })}
          </View>

          {!!resolvedItemScores.length && (
            <>
              <T style={styles.sectionTitle}>{t("questionnaires:fesi.result.perItemTitle")}</T>

              <View style={styles.card}>
                {resolvedItemScores.map((item, i) => (
                  <View
                    key={item.key}
                    style={[
                      styles.itemRow,
                      i === resolvedItemScores.length - 1 && { borderBottomWidth: 0 },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <T style={styles.itemTitle}>
                        {item.number}. {t(`questionnaires:fesi.items.${item.key}`)}
                      </T>
                    </View>

                    <T style={[styles.itemScore, { color: answerScoreColor(item.score) }]}>
                      {item.score}
                    </T>
                  </View>
                ))}
              </View>
            </>
          )}

          <View style={styles.card}>
            <ThemedButton
              title={`${t("tests:common.share.jsonButton")}${nextSessionNumber ? ` • S${nextSessionNumber}` : ""}`}
              onPress={handleShareJson}
            />
          </View>

          {!isGuest && (
            <View style={styles.card}>
              <ThemedButton
                title={uploading ? t("tests:common.upload.sending") : t("tests:common.upload.button")}
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

    cardLabel: { color: theme.colors.muted, fontWeight: "800" },
    participantName: { marginTop: 8, fontSize: 22, fontWeight: "900" },

    scoreRow: {
      marginTop: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    scoreNumber: { fontSize: 46, fontWeight: "900" },

    badge: {
      flexShrink: 1,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 999,
    },
    badgeText: { color: "#111", fontWeight: "900", textAlign: "center" },

    smallHint: { marginTop: 10, color: theme.colors.muted, lineHeight: 20 },
    sectionTitle: {
      marginTop: 16,
      marginHorizontal: SP.lg,
      fontSize: 16,
      fontWeight: "900",
    },

    metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
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

    tableHeader: {
      flexDirection: "row",
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    th: { color: theme.colors.muted, fontWeight: "900", fontSize: 12 },

    tableRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    tableRowActive: {
      backgroundColor:
        theme.mode === "light" ? "rgba(11,99,246,0.08)" : "rgba(255,255,255,0.08)",
      marginHorizontal: -8,
      paddingHorizontal: 8,
      borderRadius: 12,
    },
    td: { color: theme.colors.text, fontWeight: "800" },
    tdActive: { color: theme.colors.primary, fontWeight: "900" },

    itemRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    itemTitle: { color: theme.colors.text, lineHeight: 20, fontWeight: "700" },
    itemScore: {
      minWidth: 32,
      textAlign: "right",
      fontSize: 18,
      fontWeight: "900",
      color: theme.colors.primary,
    },
  });
}
