import React from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { T } from "../Themed";

function calculateAgeFromDob(dob?: string | null) {
  if (!dob) return null;
  const date = new Date(String(dob));
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const monthDiff = now.getMonth() - date.getMonth();
  const hasNotHadBirthdayThisYear =
    monthDiff < 0 || (monthDiff === 0 && now.getDate() < date.getDate());
  if (hasNotHadBirthdayThisYear) age -= 1;
  return Number.isFinite(age) && age >= 0 && age <= 130 ? age : null;
}

function normalizeSex(value?: unknown): "M" | "F" | null {
  if (!value) return null;
  const s = String(value).trim().toUpperCase();
  if (["M", "MASCULINO", "HOMEM", "MALE"].includes(s)) return "M";
  if (["F", "FEMININO", "MULHER", "FEMALE"].includes(s)) return "F";
  return null;
}

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

export function QuestionnaireParticipantCard({
  name,
  subtitle,
  dob,
  sex,
  id,
}: {
  name: string;
  subtitle?: string;
  dob?: string | null;
  sex?: unknown;
  id?: string | null;
}) {
  const { t } = useTranslation(["questionnaires", "tests", "common"]);

  const age = calculateAgeFromDob(dob);
  const sexNorm = normalizeSex(sex);
  const sexLabel =
    sexNorm === "M"
      ? t("tests:common.sexMale")
      : sexNorm === "F"
        ? t("tests:common.sexFemale")
        : String(sex ?? "").trim() || "—";

  const ageLabel = age != null ? t("questionnaires:resultParticipantCard.ageYears", { n: age }) : "—";
  const idLabel = String(id ?? "").trim() || "—";

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <T style={styles.avatarText}>{getInitials(name)}</T>
        </View>

        <View style={styles.headerText}>
          <T style={styles.overline}>{t("questionnaires:resultParticipantCard.overline")}</T>
          <T style={styles.name}>{name || "—"}</T>
          {!!subtitle && <T style={styles.subtitle}>{subtitle}</T>}
        </View>
      </View>

      <View style={styles.pillRow}>
        <StatPill label={t("questionnaires:resultParticipantCard.pills.age")} value={ageLabel} />
        <StatPill label={t("questionnaires:resultParticipantCard.pills.sex")} value={sexLabel} />
      </View>

      <View style={[styles.pillRow, { marginTop: 10 }]}>
        <StatPill label={t("questionnaires:resultParticipantCard.pills.id")} value={idLabel} />
      </View>
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
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerText: { flex: 1, gap: 2 },
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
  avatarText: { fontSize: 18, fontWeight: "900", color: "#1456D9" },
  overline: {
    fontSize: 12,
    fontWeight: "800",
    color: "#6E7A89",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  name: { fontSize: 22, fontWeight: "900", lineHeight: 28, color: "#111827" },
  subtitle: { marginTop: 2, fontSize: 13, lineHeight: 18, color: "#6D7887", fontWeight: "700" },

  pillRow: { flexDirection: "row", gap: 10, marginTop: 14 },
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
  pillLabel: { fontSize: 12, color: "#708092" },
  pillValue: { fontSize: 15, fontWeight: "800", color: "#111827" },
});

