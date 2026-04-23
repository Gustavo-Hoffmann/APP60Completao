import React, { useLayoutEffect, useMemo, useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as Sharing from "expo-sharing";
import { useTranslation } from "react-i18next";

import { T } from "../../../components/Themed";
import { ThemedButton } from "../../../components/ThemedButton";
import { useAuth } from "../../../contexts/AuthContext";
import type { Participant } from "../../../models/types";
import type { NativeImuStopResult } from "../../../services/sensors/nativeImu";
import { uploadLosJsonToCollection } from "../../../services/tests/uploadTestJson";

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
    } catch (e: any) {
      Alert.alert(t("tests:common.upload.errorTitle"), e?.message ?? t("tests:common.upload.errorBody"));
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
        <ParticipantCard
          name={participant?.name ?? "—"}
          age={age != null ? `${age} ${t("tests:common.yearsSuffix")}` : "—"}
          sex={displaySex}
        />

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <T style={styles.cardTitle}>{t("tests:common.resultsTitle")}</T>
            <T style={styles.cardSubtitle}>
              Ainda sem métricas específicas. Mas agora o bruto vai em JSON no padrão certo, sem
              virar um Frankenstein no dashboard depois.
            </T>
          </View>

          <View style={styles.metricsWrap}>
            <MetricRow label={t("tests:common.samples")} value={String(result?.stats?.n ?? "—")} />
            <MetricRow
              label={t("tests:common.hzMean")}
              value={result?.stats?.hzMean != null ? result.stats.hzMean.toFixed(2) : "—"}
            />
            <MetricRow
              label={t("tests:common.hzInRange")}
              value={
                result?.stats?.pctIn58to62 != null ? `${result.stats.pctIn58to62.toFixed(1)}%` : "—"
              }
            />
            <MetricRow label={t("tests:common.sessionLocal")} value={sessionNumber ? `S${sessionNumber}` : "—"} />
          </View>
        </View>

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

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricRow}>
      <T style={styles.metricLabel}>{label}</T>
      <T style={styles.metricValue}>{value}</T>
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
  cardHeader: {
    gap: 4,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  cardSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: "#6B7280",
  },
  metricsWrap: {
    gap: 10,
  },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 4,
  },
  metricLabel: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "700",
  },
  metricValue: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "800",
  },
  buttonWrap: {
    marginTop: 2,
  },
});