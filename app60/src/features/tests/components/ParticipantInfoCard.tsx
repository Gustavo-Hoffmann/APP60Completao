import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { T } from "../../../components/Themed";
import type { Participant } from "../../../models/types";
import {
  formatParticipantAge,
  formatParticipantHeight,
  formatParticipantMass,
  formatParticipantName,
  formatSexLabel,
  getParticipantSexValue,
} from "./participantDisplay";

type AnthropometryMode = "none" | "massHeight" | "heightOnly";

type ParticipantInfoCardProps = {
  participant?: Participant | null;
  anthropometry?: AnthropometryMode;
};

function getInitials(name?: string | null) {
  const base = String(name ?? "").trim();
  if (!base || base === "—") return "P";

  const parts = base.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";

  return `${first}${last}`.toUpperCase();
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.pill}>
      <T style={styles.pillLabel}>{label}</T>
      <T style={styles.pillValue}>{value}</T>
    </View>
  );
}

export function ParticipantInfoCard({
  participant,
  anthropometry = "none",
}: ParticipantInfoCardProps) {
  const { t } = useTranslation("tests");

  const name = formatParticipantName(participant, t);
  const age = formatParticipantAge(participant, t);
  const sex = formatSexLabel(getParticipantSexValue(participant), t);
  const mass = formatParticipantMass(participant, t);
  const height = formatParticipantHeight(participant, t);

  const showMass = anthropometry === "massHeight";
  const showHeight = anthropometry === "massHeight" || anthropometry === "heightOnly";

  const secondaryPills = useMemo(() => {
    const pills: Array<{ label: string; value: string }> = [];
    if (showMass) {
      pills.push({ label: t("tests:common.massLabel"), value: mass });
    }
    if (showHeight) {
      pills.push({ label: t("tests:common.heightLabel"), value: height });
    }
    return pills;
  }, [height, mass, showHeight, showMass, t]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <T style={styles.avatarText}>{getInitials(name)}</T>
        </View>

        <View style={styles.headerText}>
          <T style={styles.overline}>{t("tests:common.participantLabel")}</T>
          <T style={styles.name}>{name}</T>
        </View>
      </View>

      <View style={styles.pillRow}>
        <StatPill label={t("tests:common.ageLabel")} value={age} />
        <StatPill label={t("tests:common.sexLabel")} value={sex} />
      </View>

      {secondaryPills.length > 0 ? (
        <View style={styles.pillRow}>
          {secondaryPills.map((pill) => (
            <StatPill key={pill.label} label={pill.label} value={pill.value} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerText: {
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
  overline: {
    fontSize: 12,
    fontWeight: "800",
    color: "#6E7A89",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  name: {
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 28,
    color: "#111827",
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
});
