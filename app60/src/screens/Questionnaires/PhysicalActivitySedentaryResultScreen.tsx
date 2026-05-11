import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import * as Sharing from "expo-sharing";

import { T } from "../../components/Themed";
import { ThemedButton } from "../../components/ThemedButton";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import type { Participant } from "../../models/types";
import { showCloudUploadFailure } from "../../services/tests/uploadSyncErrors";
import {
  getNextSessionNumber,
  saveActivitySedentaryJsonToCache,
  uploadActivitySedentaryResultToCollection,
} from "../../services/tests/uploadTestJson";

type LevelKey = "sedentary" | "irregular_b" | "irregular_a" | "active" | "very_active";

type Summary = {
  key?: LevelKey;
  label?: string;
  totalDays?: number;
  totalMin?: number;
  sleepMinWeek?: number;
  sleepDays?: number;
  modMinWeek?: number;
  modDays?: number;
  vigMinWeek?: number;
  vigDays?: number;
  sedentaryMinWeek?: number;
  sedentaryDays?: number;
  modMET?: number;
  vigMET?: number;
  totalMET?: number;
};

type RouteParams = {
  participant?: any;
  participantId?: string;
  participantName?: string;
  summary?: Summary;
  answers?: Record<string, unknown>;
};

type SleepRange = {
  labelKey: string;
  ageTextKey: string;
  minH: number;
  maxH: number | null;
  sourceKey: string;
};

const WEEK_MINUTES = 7 * 24 * 60;

const SLEEP_RANGES: SleepRange[] = [
  {
    labelKey: "questionnaires:activitySedentary.result.sleepRef.ranges.adults.label",
    ageTextKey: "questionnaires:activitySedentary.result.sleepRef.ranges.adults.ageText",
    minH: 7,
    maxH: null,
    sourceKey: "questionnaires:activitySedentary.result.sleepRef.ranges.adults.source",
  },
  {
    labelKey: "questionnaires:activitySedentary.result.sleepRef.ranges.olderAdults.label",
    ageTextKey: "questionnaires:activitySedentary.result.sleepRef.ranges.olderAdults.ageText",
    minH: 7,
    maxH: 9,
    sourceKey: "questionnaires:activitySedentary.result.sleepRef.ranges.olderAdults.source",
  },
  {
    labelKey: "questionnaires:activitySedentary.result.sleepRef.ranges.olderPeople.label",
    ageTextKey: "questionnaires:activitySedentary.result.sleepRef.ranges.olderPeople.ageText",
    minH: 7,
    maxH: 8,
    sourceKey: "questionnaires:activitySedentary.result.sleepRef.ranges.olderPeople.source",
  },
];

function asNumber(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function clamp(v: number, min: number, max: number) {
  if (!Number.isFinite(v)) return min;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function formatMinutes(t: (key: string, opts?: any) => string, totalMinutes: number) {
  const safe = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;

  const minShort = t("questionnaires:activitySedentary.result.units.minShort");
  const hourShort = t("questionnaires:activitySedentary.result.units.hourShort");

  if (h <= 0) return `${m} ${minShort}`;
  if (m <= 0) return `${h} ${hourShort}`;
  return `${h} ${hourShort} ${m} ${minShort}`;
}

function formatDaily(t: (key: string, opts?: any) => string, totalWeekMinutes: number) {
  return t("questionnaires:activitySedentary.result.units.perDay", {
    value: formatMinutes(t, totalWeekMinutes / 7),
  });
}

function getFirstValue(obj: any, keys: string[]) {
  if (!obj || typeof obj !== "object") return undefined;

  for (const key of keys) {
    const value = obj[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return undefined;
}

function calculateAgeFromDate(value: unknown) {
  if (!value) return null;

  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;

  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const monthDiff = now.getMonth() - date.getMonth();
  const hasNotHadBirthdayThisYear =
    monthDiff < 0 || (monthDiff === 0 && now.getDate() < date.getDate());

  if (hasNotHadBirthdayThisYear) age -= 1;

  return Number.isFinite(age) && age >= 0 && age <= 130 ? age : null;
}

function getParticipantAge(participant: any) {
  const ageValue = getFirstValue(participant, ["age", "idade"]);
  const numericAge = Number(ageValue);
  if (Number.isFinite(numericAge) && numericAge > 0 && numericAge <= 130) {
    return Math.trunc(numericAge);
  }

  return calculateAgeFromDate(
    getFirstValue(participant, [
      "birthDate",
      "birth_date",
      "dob",
      "dateOfBirth",
      "date_of_birth",
      "birthday",
      "dataNascimento",
      "data_nascimento",
    ])
  );
}

function getSleepRangeForAge(age: number | null): SleepRange {
  if (age == null) return SLEEP_RANGES[2];
  if (age >= 65) return SLEEP_RANGES[2];
  if (age >= 61) return SLEEP_RANGES[1];
  return SLEEP_RANGES[0];
}

function normalizeSex(value?: unknown): "M" | "F" | null {
  if (!value) return null;
  const s = String(value).trim().toUpperCase();
  if (["M", "MASCULINO", "HOMEM", "MALE"].includes(s)) return "M";
  if (["F", "FEMININO", "MULHER", "FEMALE"].includes(s)) return "F";
  return null;
}

function formatSexLabel(
  t: (key: string, opts?: any) => string,
  value?: unknown
) {
  const normalized = normalizeSex(value);
  if (normalized === "M") return t("tests:common.sexMale");
  if (normalized === "F") return t("tests:common.sexFemale");
  const raw = String(value ?? "").trim();
  return raw || "—";
}

function rangeText(t: (key: string, opts?: any) => string, range: SleepRange) {
  return range.maxH == null
    ? t("questionnaires:activitySedentary.result.units.perNightAtLeast", { hours: range.minH })
    : t("questionnaires:activitySedentary.result.units.perNightRange", { min: range.minH, max: range.maxH });
}

function truncateText(text: string, maxChars: number) {
  const base = String(text ?? "").trim().replace(/\s+/g, " ");
  if (!base) return "";
  if (base.length <= maxChars) return base;
  return `${base.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

function classifySleep(t: (key: string, opts?: any) => string, dailyMinutes: number, range: SleepRange) {
  const dailyHours = dailyMinutes / 60;

  if (dailyHours <= 0) {
    return {
      label: t("questionnaires:activitySedentary.result.classifiers.sleep.noData.label"),
      tone: "neutral" as const,
      description: t("questionnaires:activitySedentary.result.classifiers.sleep.noData.description"),
    };
  }

  if (dailyHours < range.minH) {
    return {
      label: t("questionnaires:activitySedentary.result.classifiers.sleep.below.label"),
      tone: "bad" as const,
      description: t("questionnaires:activitySedentary.result.classifiers.sleep.below.description", {
        minH: range.minH,
      }),
    };
  }

  if (range.maxH != null && dailyHours > range.maxH) {
    return {
      label: t("questionnaires:activitySedentary.result.classifiers.sleep.above.label"),
      tone: "warn" as const,
      description: t("questionnaires:activitySedentary.result.classifiers.sleep.above.description", {
        maxH: range.maxH,
      }),
    };
  }

  return {
    label: t("questionnaires:activitySedentary.result.classifiers.sleep.within.label"),
    tone: "good" as const,
    description: t("questionnaires:activitySedentary.result.classifiers.sleep.within.description", {
      ageText: t(range.ageTextKey),
    }),
  };
}

function classifyPhysicalActivity(t: (key: string, opts?: any) => string, modMinWeek: number, vigMinWeek: number) {
  const equivalentModerateMinutes = modMinWeek + vigMinWeek * 2;

  if (equivalentModerateMinutes >= 300) {
    return {
      label: t("questionnaires:activitySedentary.result.classifiers.activity.upper.label"),
      tone: "good" as const,
      equivalentModerateMinutes,
      description: t("questionnaires:activitySedentary.result.classifiers.activity.upper.description"),
    };
  }

  if (equivalentModerateMinutes >= 150) {
    return {
      label: t("questionnaires:activitySedentary.result.classifiers.activity.minimum.label"),
      tone: "good" as const,
      equivalentModerateMinutes,
      description: t("questionnaires:activitySedentary.result.classifiers.activity.minimum.description"),
    };
  }

  if (equivalentModerateMinutes > 0) {
    return {
      label: t("questionnaires:activitySedentary.result.classifiers.activity.below.label"),
      tone: "warn" as const,
      equivalentModerateMinutes,
      description: t("questionnaires:activitySedentary.result.classifiers.activity.below.description"),
    };
  }

  return {
    label: t("questionnaires:activitySedentary.result.classifiers.activity.none.label"),
    tone: "bad" as const,
    equivalentModerateMinutes,
    description: t("questionnaires:activitySedentary.result.classifiers.activity.none.description"),
  };
}

function classifySedentary(t: (key: string, opts?: any) => string, sedentaryMinWeek: number) {
  const dailyHours = sedentaryMinWeek / 7 / 60;

  if (dailyHours <= 0) {
    return {
      label: t("questionnaires:activitySedentary.result.classifiers.sedentary.noData.label"),
      tone: "neutral" as const,
      description: t("questionnaires:activitySedentary.result.classifiers.sedentary.noData.description"),
    };
  }

  if (dailyHours <= 7) {
    return {
      label: t("questionnaires:activitySedentary.result.classifiers.sedentary.low.label"),
      tone: "good" as const,
      description: t("questionnaires:activitySedentary.result.classifiers.sedentary.low.description"),
    };
  }

  if (dailyHours <= 9) {
    return {
      label: t("questionnaires:activitySedentary.result.classifiers.sedentary.attention.label"),
      tone: "warn" as const,
      description: t("questionnaires:activitySedentary.result.classifiers.sedentary.attention.description"),
    };
  }

  if (dailyHours <= 10) {
    return {
      label: t("questionnaires:activitySedentary.result.classifiers.sedentary.high.label"),
      tone: "bad" as const,
      description: t("questionnaires:activitySedentary.result.classifiers.sedentary.high.description"),
    };
  }

  return {
    label: t("questionnaires:activitySedentary.result.classifiers.sedentary.veryHigh.label"),
    tone: "bad" as const,
    description: t("questionnaires:activitySedentary.result.classifiers.sedentary.veryHigh.description"),
  };
}

function getToneStyle(styles: ReturnType<typeof makeStyles>, tone: "good" | "warn" | "bad" | "neutral") {
  if (tone === "good") return styles.toneGood;
  if (tone === "warn") return styles.toneWarn;
  if (tone === "bad") return styles.toneBad;
  return styles.toneNeutral;
}

export function PhysicalActivitySedentaryResultScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation(["questionnaires", "common", "tests", "errors"]);
  const [showSleepRef, setShowSleepRef] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [nextSessionNumber, setNextSessionNumber] = useState<number | null>(null);
  const { isGuest } = useAuth();

  const { participant, participantId, participantName, summary, answers } = (route?.params ?? {}) as RouteParams;
  const effectiveParticipant = useMemo(() => {
    if (participant?.id) return participant as Participant;
    if (participantId) {
      return {
        ...(participant ?? {}),
        id: String(participantId),
        name:
          participantName ||
          getFirstValue(participant, ["name", "nome", "fullName", "full_name"]) ||
          "",
      } as Participant;
    }
    return participant as Participant | undefined;
  }, [participant, participantId, participantName]);

  const sleepMinWeek = asNumber(summary?.sleepMinWeek);
  const modMinWeek = asNumber(summary?.modMinWeek);
  const vigMinWeek = asNumber(summary?.vigMinWeek);
  const sedentaryMinWeek = asNumber(summary?.sedentaryMinWeek);

  const usedMinutes = sleepMinWeek + modMinWeek + vigMinWeek + sedentaryMinWeek;
  const lightMinWeek = clamp(WEEK_MINUTES - usedMinutes, 0, WEEK_MINUTES);
  const overflowMinutes = Math.max(0, usedMinutes - WEEK_MINUTES);

  const age = getParticipantAge(participant);
  const rawSex = getFirstValue(participant, [
    "biologicalSex",
    "sexoBiologico",
    "sex",
    "sexo",
    "gender",
    "genero",
    "gender_label",
  ]);
  const displaySex = formatSexLabel(t, rawSex);
  const displayName =
    participantName ||
    getFirstValue(participant, ["name", "nome", "fullName", "full_name"]) ||
    t("questionnaires:activitySedentary.participantFallback");
  const sleepRange = getSleepRangeForAge(age);
  const sleepClass = classifySleep(t, sleepMinWeek / 7, sleepRange);
  const activityClass = classifyPhysicalActivity(t, modMinWeek, vigMinWeek);
  const sedentaryClass = classifySedentary(t, sedentaryMinWeek);

  useEffect(() => {
    let alive = true;

    async function loadNextSession() {
      try {
        if (!effectiveParticipant?.id) return;
        const session = await getNextSessionNumber(String(effectiveParticipant.id), "ACT_SEDENTARY");
        if (alive) setNextSessionNumber(session);
      } catch {
        if (alive) setNextSessionNumber(null);
      }
    }

    loadNextSession();

    return () => {
      alive = false;
    };
  }, [effectiveParticipant?.id]);

  const handleUploadCloud = async () => {
    try {
      if (uploading) return;
      if (!effectiveParticipant?.id) {
        Alert.alert(
          t("questionnaires:activitySedentary.result.alerts.errorTitle"),
          t("questionnaires:activitySedentary.result.alerts.invalidParticipant")
        );
        return;
      }

      setUploading(true);
      const sessionNumberToUse =
        nextSessionNumber ??
        (await getNextSessionNumber(String(effectiveParticipant.id), "ACT_SEDENTARY"));

      const sent = await uploadActivitySedentaryResultToCollection({
        participant: effectiveParticipant,
        sessionNumber: sessionNumberToUse,
        summary: (summary ?? {}) as Record<string, unknown>,
        answers: (answers ?? {}) as Record<string, unknown>,
        meta: {
          screen: "PhysicalActivitySedentaryResult",
        },
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

  const handleShareJson = async () => {
    try {
      if (sharing) return;
      if (!effectiveParticipant?.id) {
        Alert.alert(
          t("questionnaires:activitySedentary.result.alerts.errorTitle"),
          t("questionnaires:activitySedentary.result.alerts.invalidParticipant")
        );
        return;
      }

      setSharing(true);

      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert(t("tests:common.share.title"), t("tests:common.share.unavailable"));
        return;
      }

      const sessionNumberToUse =
        nextSessionNumber ??
        (await getNextSessionNumber(String(effectiveParticipant.id), "ACT_SEDENTARY"));

      const saved = await saveActivitySedentaryJsonToCache({
        participant: effectiveParticipant,
        sessionNumber: sessionNumberToUse,
        summary: (summary ?? {}) as Record<string, unknown>,
        answers: (answers ?? {}) as Record<string, unknown>,
        meta: {
          screen: "PhysicalActivitySedentaryResult",
        },
      });

      await Sharing.shareAsync(saved.uri, {
        mimeType: "application/json",
        dialogTitle: t("tests:common.share.jsonDialog"),
        UTI: Platform.OS === "ios" ? "public.json" : undefined,
      });
    } catch (e: any) {
      Alert.alert(t("errors:titles.error"), e?.message ?? t("tests:common.share.error"));
    } finally {
      setSharing(false);
    }
  };

  useEffect(() => {
    navigation?.setOptions?.({
      headerStyle: { backgroundColor: theme.colors.primary },
      headerTintColor: "#fff",
      headerTitleStyle: { color: "#fff", fontWeight: "900" },
      headerShadowVisible: false,
      headerBackTitleVisible: false,
      headerBackTitle: "",
      headerBackButtonDisplayMode: "minimal",
      headerTitleAlign: "center",
      contentStyle: { backgroundColor: "#F3F5F8" },
      title: t("questionnaires:activitySedentary.result.title"),
    });
  }, [navigation, theme.colors.primary, t]);

  const StatusPill = ({ label, tone }: { label: string; tone: "good" | "warn" | "bad" | "neutral" }) => (
    <View style={[styles.statusPill, getToneStyle(styles, tone)]}>
      <T style={styles.statusPillText}>{label}</T>
    </View>
  );

  const SleepTableRow = ({ row }: { row: SleepRange }) => {
    const active = row.labelKey === sleepRange.labelKey;

    return (
      <View style={[styles.refRow, active && styles.refRowActive]}>
        <T style={[styles.refCell, styles.refAgeCell, active && styles.refCellActive]}>{t(row.ageTextKey)}</T>
        <T style={[styles.refCell, styles.refMainCell, active && styles.refCellActive]}>{rangeText(t, row)}</T>
        <T style={[styles.refCell, styles.refSourceCell, active && styles.refCellActive]}>{t(row.sourceKey)}</T>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#F3F5F8" }} edges={["bottom"]}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { flexGrow: 1 }]}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
        >
          <ParticipantCard
            name={displayName}
            age={
              age != null
                ? t("questionnaires:activitySedentary.result.participant.ageYears", { n: age })
                : "—"
            }
            sex={displaySex}
            subtitle={t("questionnaires:activitySedentary.result.subtitle", {
              defaultValue: "Sono, atividade física e comportamento sedentário",
            })}
          />

          <InfoCard
            title={t("questionnaires:activitySedentary.result.cards.weeklyTime.title")}
            subtitle={t("questionnaires:activitySedentary.result.cards.weeklyTime.subtitle")}
            rightBadgeText={formatMinutes(t, WEEK_MINUTES)}
            rightBadgeLabel={t("questionnaires:activitySedentary.result.cards.weeklyTime.badgeLabel")}
          >
            <MetricTable
              rows={[
                {
                  label: t("questionnaires:activitySedentary.result.cards.weeklyTime.rows.sleep"),
                  primary: formatDaily(t, sleepMinWeek),
                  secondary: t("questionnaires:activitySedentary.result.units.perWeek", {
                    value: formatMinutes(t, sleepMinWeek),
                  }),
                },
                {
                  label: t("questionnaires:activitySedentary.result.cards.weeklyTime.rows.light"),
                  primary: formatDaily(t, lightMinWeek),
                  secondary: t("questionnaires:activitySedentary.result.units.perWeek", {
                    value: formatMinutes(t, lightMinWeek),
                  }),
                },
                {
                  label: t("questionnaires:activitySedentary.result.cards.weeklyTime.rows.moderate"),
                  primary: formatDaily(t, modMinWeek),
                  secondary: t("questionnaires:activitySedentary.result.units.perWeek", {
                    value: formatMinutes(t, modMinWeek),
                  }),
                },
                {
                  label: t("questionnaires:activitySedentary.result.cards.weeklyTime.rows.vigorous"),
                  primary: formatDaily(t, vigMinWeek),
                  secondary: t("questionnaires:activitySedentary.result.units.perWeek", {
                    value: formatMinutes(t, vigMinWeek),
                  }),
                },
                {
                  label: t("questionnaires:activitySedentary.result.cards.weeklyTime.rows.sedentary"),
                  primary: formatDaily(t, sedentaryMinWeek),
                  secondary: t("questionnaires:activitySedentary.result.units.perWeek", {
                    value: formatMinutes(t, sedentaryMinWeek),
                  }),
                },
              ]}
            />

            {overflowMinutes > 0 ? (
              <T style={styles.warningText}>
                {t("questionnaires:activitySedentary.result.cards.weeklyTime.overflowWarning", {
                  overflow: formatMinutes(t, overflowMinutes),
                })}
              </T>
            ) : null}
          </InfoCard>

          <InfoCard
            title={t("questionnaires:activitySedentary.result.cards.sleep.title")}
            subtitle={t("questionnaires:activitySedentary.result.cards.sleep.subtitle", {
              ageText: t(sleepRange.ageTextKey),
              range: rangeText(t, sleepRange),
            })}
          >
            <View style={styles.headerRow}>
              <StatusPill label={sleepClass.label} tone={sleepClass.tone} />
              <View style={{ flex: 1 }} />
              <DailyWeeklyStat
                label={t("questionnaires:activitySedentary.result.cards.sleep.statLabel")}
                primary={formatDaily(t, sleepMinWeek)}
                secondary={t("questionnaires:activitySedentary.result.units.perWeek", {
                  value: formatMinutes(t, sleepMinWeek),
                })}
              />
            </View>

            <T style={styles.bodyText}>{truncateText(sleepClass.description, 170)}</T>

            <Pressable onPress={() => setShowSleepRef((v) => !v)} style={styles.expandButton}>
              <T style={styles.expandButtonText}>
                {showSleepRef
                  ? t("questionnaires:activitySedentary.result.actions.hideReference")
                  : t("questionnaires:activitySedentary.result.actions.showReference")}
              </T>
            </Pressable>

            {showSleepRef ? (
              <View style={styles.refTable}>
                <View style={styles.refHeaderRow}>
                  <T style={[styles.refHeaderCell, styles.refAgeCell]}>
                    {t("questionnaires:activitySedentary.result.sleepRef.headers.age")}
                  </T>
                  <T style={[styles.refHeaderCell, styles.refMainCell]}>
                    {t("questionnaires:activitySedentary.result.sleepRef.headers.recommendedSleep")}
                  </T>
                  <T style={[styles.refHeaderCell, styles.refSourceCell]}>
                    {t("questionnaires:activitySedentary.result.sleepRef.headers.source")}
                  </T>
                </View>
                {SLEEP_RANGES.map((row) => (
                  <SleepTableRow key={row.labelKey} row={row} />
                ))}
              </View>
            ) : null}
          </InfoCard>

          <InfoCard
            title={t("questionnaires:activitySedentary.result.cards.activity.title")}
            subtitle={t("questionnaires:activitySedentary.result.cards.activity.subtitle")}
          >
            <View style={styles.headerRow}>
              <StatusPill label={activityClass.label} tone={activityClass.tone} />
            </View>

            <View style={styles.statGrid}>
              <HighlightStatBox
                label={t("questionnaires:activitySedentary.result.cards.activity.stats.moderate")}
                value={formatMinutes(t, modMinWeek)}
              />
              <HighlightStatBox
                label={t("questionnaires:activitySedentary.result.cards.activity.stats.vigorous")}
                value={formatMinutes(t, vigMinWeek)}
              />
            </View>
            <View style={{ marginTop: 10 }}>
              <HighlightStatBox
                label={t("questionnaires:activitySedentary.result.cards.activity.stats.equivalent")}
                value={String(Math.round(activityClass.equivalentModerateMinutes))}
              />
            </View>

            <T style={styles.bodyText}>{truncateText(activityClass.description, 170)}</T>
          </InfoCard>

          <InfoCard
            title={t("questionnaires:activitySedentary.result.cards.sedentary.title")}
            subtitle={t("questionnaires:activitySedentary.result.cards.sedentary.subtitle")}
          >
            <View style={styles.headerRow}>
              <StatusPill label={sedentaryClass.label} tone={sedentaryClass.tone} />
              <View style={{ flex: 1 }} />
              <DailyWeeklyStat
                label={t("questionnaires:activitySedentary.result.cards.sedentary.statLabel")}
                primary={formatDaily(t, sedentaryMinWeek)}
                secondary={t("questionnaires:activitySedentary.result.units.perWeek", {
                  value: formatMinutes(t, sedentaryMinWeek),
                })}
              />
            </View>

            <T style={styles.bodyText}>{truncateText(sedentaryClass.description, 170)}</T>
          </InfoCard>

          <View style={styles.buttonSection}>
            <View style={styles.buttonWrap}>
              <ThemedButton
                title={`${t("tests:common.share.jsonButton")}${nextSessionNumber ? ` • S${nextSessionNumber}` : ""}`}
                onPress={handleShareJson}
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
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

export default PhysicalActivitySedentaryResultScreen;

function makeStyles(theme: any) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: "#F3F5F8" },
    scroll: { flex: 1, backgroundColor: "#F3F5F8" },
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
      color: "#111827",
    },
    participantSub: {
      marginTop: 2,
      fontSize: 13,
      lineHeight: 18,
      color: "#6D7887",
      fontWeight: "700",
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
      color: "#111827",
    },
    cardSubtitle: {
      fontSize: 13,
      lineHeight: 18,
      color: "#6D7887",
    },

    cardHeaderRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
    },
    totalWeekBadge: {
      minWidth: 86,
      paddingHorizontal: 10,
      paddingVertical: 10,
      borderRadius: 16,
      alignItems: "center",
      backgroundColor: "#EEF4FF",
      borderWidth: 1,
      borderColor: "#CFE0FF",
    },
    totalWeekValue: { color: "#1456D9", fontWeight: "900", fontSize: 14 },
    totalWeekLabel: { marginTop: 2, color: "#6D7887", fontSize: 11, fontWeight: "800" },

    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },

    warningText: { marginTop: 12, color: "#B45309", fontWeight: "800", lineHeight: 20 },
    bodyText: { marginTop: 12, opacity: 0.86, lineHeight: 20, color: "#4C5866" },

    statusPill: {
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1,
      maxWidth: 150,
    },
    statusPillText: {
      fontSize: 12,
      fontWeight: "900",
      textAlign: "center",
      color: "#111827",
    },
    toneGood: {
      backgroundColor: "rgba(22,163,74,0.12)",
      borderColor: "rgba(22,163,74,0.35)",
    },
    toneWarn: {
      backgroundColor: "rgba(245,158,11,0.14)",
      borderColor: "rgba(245,158,11,0.40)",
    },
    toneBad: {
      backgroundColor: "rgba(239,68,68,0.12)",
      borderColor: "rgba(239,68,68,0.40)",
    },
    toneNeutral: {
      backgroundColor: "rgba(100,116,139,0.12)",
      borderColor: "#D9E2EF",
    },

    statGrid: {
      flexDirection: "row",
      gap: 10,
      marginTop: 12,
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
      fontWeight: "800",
    },
    tableHint: {
      marginTop: 2,
      fontSize: 12,
      lineHeight: 16,
      color: "#6D7887",
      fontWeight: "700",
    },
    tableValueWrap: {
      alignItems: "flex-end",
      flex: 1,
    },
    tableValue: {
      fontSize: 14,
      fontWeight: "900",
      lineHeight: 19,
      textAlign: "right",
      color: "#101828",
    },

    refTable: {
      marginTop: 14,
      borderWidth: 1,
      borderColor: "#E9EDF4",
      borderRadius: 14,
      overflow: "hidden",
    },
    refHeaderRow: {
      flexDirection: "row",
      backgroundColor: "#F4F7FB",
      borderBottomWidth: 1,
      borderBottomColor: "#EEF2F7",
    },
    refRow: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: "#EEF2F7",
      backgroundColor: "#FFFFFF",
    },
    refRowActive: {
      backgroundColor: "#DDEBFF",
    },
    refHeaderCell: {
      paddingVertical: 10,
      paddingHorizontal: 10,
      color: "#4A5562",
      fontWeight: "900",
      fontSize: 12,
    },
    refCell: {
      paddingVertical: 11,
      paddingHorizontal: 10,
      color: "#42505E",
      fontSize: 12,
      lineHeight: 17,
    },
    refCellActive: { color: "#0E4FC7", fontWeight: "900" },
    refAgeCell: { flex: 1.05 },
    refMainCell: { flex: 1.25 },
    refSourceCell: { flex: 0.7, textAlign: "right" },

    expandButton: {
      alignSelf: "flex-start",
      marginTop: 12,
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

    buttonSection: {
      marginTop: 2,
      gap: 12,
    },
    buttonWrap: {
      marginTop: 2,
    },
  });
}

function ParticipantCard({
  name,
  age,
  sex,
  subtitle,
}: {
  name: string;
  age: string;
  sex: string;
  subtitle: string;
}) {
  const { t } = useTranslation(["questionnaires", "common", "tests"]);
  return (
    <View style={[stylesStatic.card, stylesStatic.participantCard]}>
      <View style={stylesStatic.participantHeader}>
        <View style={stylesStatic.avatar}>
          <T style={stylesStatic.avatarText}>{getInitials(name)}</T>
        </View>

        <View style={stylesStatic.participantHeaderText}>
          <T style={stylesStatic.participantOverline}>
            {t("questionnaires:activitySedentary.result.participant.overline")}
          </T>
          <T style={stylesStatic.participantName}>{name}</T>
          <T style={stylesStatic.participantSub}>{subtitle}</T>
        </View>
      </View>

      <View style={stylesStatic.pillRow}>
        <StatPill label={t("questionnaires:activitySedentary.result.participant.pills.age")} value={age} />
        <StatPill label={t("questionnaires:activitySedentary.result.participant.pills.sex")} value={sex} />
      </View>
    </View>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={stylesStatic.pill}>
      <T style={stylesStatic.pillLabel}>{label}</T>
      <T style={stylesStatic.pillValue}>{value}</T>
    </View>
  );
}

function InfoCard({
  title,
  subtitle,
  rightBadgeText,
  rightBadgeLabel,
  children,
}: {
  title: string;
  subtitle?: string;
  rightBadgeText?: string;
  rightBadgeLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={stylesStatic.card}>
      <View style={stylesStatic.cardHeaderRow}>
        <View style={{ flex: 1 }}>
          <T style={stylesStatic.cardTitle}>{title}</T>
          {subtitle ? <T style={stylesStatic.cardSubtitle}>{subtitle}</T> : null}
        </View>

        {rightBadgeText ? (
          <View style={stylesStatic.totalWeekBadge}>
            <T style={stylesStatic.totalWeekValue}>{rightBadgeText}</T>
            {!!rightBadgeLabel && <T style={stylesStatic.totalWeekLabel}>{rightBadgeLabel}</T>}
          </View>
        ) : null}
      </View>
      <View style={{ marginTop: 12 }}>{children}</View>
    </View>
  );
}

function HighlightStatBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={stylesStatic.statBox}>
      <T style={stylesStatic.statBoxLabel}>{label}</T>
      <T style={stylesStatic.statBoxValue}>{value}</T>
    </View>
  );
}

function DailyWeeklyStat({
  label,
  primary,
  secondary,
}: {
  label: string;
  primary: string;
  secondary: string;
}) {
  return (
    <View style={stylesStatic.dailyWeeklyBox}>
      <T style={stylesStatic.dailyWeeklyLabel}>{label}</T>
      <T style={stylesStatic.tableValuePrimary}>{primary}</T>
      <T style={stylesStatic.tableValueSecondary}>{secondary}</T>
    </View>
  );
}

function MetricTable({
  rows,
}: {
  rows: Array<{ label: string; primary: string; secondary?: string }>;
}) {
  return (
    <View style={stylesStatic.tableWrap}>
      {rows.map((row, idx) => (
        <View
          key={`${row.label}-${idx}`}
          style={[
            stylesStatic.tableRow,
            idx === rows.length - 1 && stylesStatic.tableRowLast,
          ]}
        >
          <View style={{ flex: 1.35 }}>
            <T style={stylesStatic.tableLabel}>{row.label}</T>
          </View>
          <View style={stylesStatic.tableValueWrap}>
            <T style={stylesStatic.tableValuePrimary}>{row.primary}</T>
            {row.secondary ? (
              <T style={stylesStatic.tableValueSecondary}>{row.secondary}</T>
            ) : null}
          </View>
        </View>
      ))}
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

// Reuso do StyleSheet do screen para componentes locais
const stylesStatic = (() => {
  // `makeStyles` depende de theme; aqui usamos as mesmas chaves com cores fixas do padrão "tests".
  return StyleSheet.create({
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
    participantCard: { paddingTop: 14, paddingBottom: 14 },
    participantHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
    participantHeaderText: { flex: 1, gap: 2 },
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
    participantOverline: {
      fontSize: 12,
      fontWeight: "800",
      color: "#6E7A89",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    participantName: { fontSize: 22, fontWeight: "900", lineHeight: 28, color: "#111827" },
    participantSub: { marginTop: 2, fontSize: 13, lineHeight: 18, color: "#6D7887", fontWeight: "700" },
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
    cardHeaderRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
    cardTitle: { fontSize: 21, fontWeight: "900", lineHeight: 27, color: "#111827" },
    cardSubtitle: { fontSize: 13, lineHeight: 18, color: "#6D7887" },
    totalWeekBadge: {
      minWidth: 86,
      paddingHorizontal: 10,
      paddingVertical: 10,
      borderRadius: 16,
      alignItems: "center",
      backgroundColor: "#EEF4FF",
      borderWidth: 1,
      borderColor: "#CFE0FF",
    },
    totalWeekValue: { color: "#1456D9", fontWeight: "900", fontSize: 14 },
    totalWeekLabel: { marginTop: 2, color: "#6D7887", fontSize: 11, fontWeight: "800" },
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
    statBoxLabel: { fontSize: 12, color: "#708092", lineHeight: 16 },
    statBoxValue: { fontSize: 18, fontWeight: "900", lineHeight: 23, color: "#0F172A" },
    dailyWeeklyBox: {
      alignItems: "flex-end",
      backgroundColor: "#F7F9FC",
      borderWidth: 1,
      borderColor: "#E9EEF5",
      borderRadius: 18,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 2,
      minWidth: 138,
    },
    dailyWeeklyLabel: {
      fontSize: 12,
      color: "#708092",
      fontWeight: "800",
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
    tableRowLast: { borderBottomWidth: 0 },
    tableLabel: { fontSize: 14, lineHeight: 19, color: "#3B4754", fontWeight: "800" },
    tableValueWrap: { alignItems: "flex-end", flex: 1 },
    tableValuePrimary: {
      fontSize: 16,
      fontWeight: "900",
      lineHeight: 20,
      textAlign: "right",
      color: "#1456D9",
    },
    tableValueSecondary: {
      marginTop: 2,
      fontSize: 12,
      fontWeight: "800",
      lineHeight: 16,
      textAlign: "right",
      color: "#6D7887",
    },
  });
})();