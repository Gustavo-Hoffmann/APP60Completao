import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../contexts/ThemeContext";
import { Routes } from "../../navigation/routes";
import type { Participant } from "../../models/types";

type SectionKey = "sleep" | "moderate" | "vigorous" | "sedentary";

type SectionAnswers = {
  weekDays: number | null;
  weekH: number | null;
  weekM: number | null;
  weekendDays: number | null;
  weekendH: number | null;
  weekendM: number | null;
};

type Answers = Record<SectionKey, SectionAnswers>;

type SectionConfig = {
  key: SectionKey;
  titleKey?: string;
  bodyKey?: string;
  qPrefixKey?: string;
  title?: string;
  body?: string;
  weekdaysQuestion?: string;
  weekendQuestion?: string;
};

const INPUT_ACCESSORY_VIEW_ID = "activity-sedentary-numberpad-done";

const emptySection = (
  defaults: Partial<SectionAnswers> = {}
): SectionAnswers => ({
  weekDays: defaults.weekDays ?? null,
  weekH: defaults.weekH ?? null,
  weekM: defaults.weekM ?? null,
  weekendDays: defaults.weekendDays ?? null,
  weekendH: defaults.weekendH ?? null,
  weekendM: defaults.weekendM ?? null,
});

function clampInt(v: number, min: number, max: number) {
  if (!Number.isFinite(v)) return min;
  if (v < min) return min;
  if (v > max) return max;
  return Math.trunc(v);
}

function parseMaybeInt(s: string) {
  const cleaned = String(s ?? "").replace(/[^\d]/g, "");
  if (!cleaned) return null;

  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function minutesPerDay(h: number | null, m: number | null) {
  const hh = h ?? 0;
  const mm = m ?? 0;
  const total = hh * 60 + mm;

  return total > 0 ? total : 0;
}

function minutesPerWeekForSection(a: SectionAnswers) {
  const wDays = clampInt(a.weekDays ?? 0, 0, 5);
  const weDays = clampInt(a.weekendDays ?? 0, 0, 2);
  const wMin = minutesPerDay(a.weekH, a.weekM);
  const weMin = minutesPerDay(a.weekendH, a.weekendM);

  return wDays * wMin + weDays * weMin;
}

function daysPerWeekForSection(a: SectionAnswers) {
  const wDays = clampInt(a.weekDays ?? 0, 0, 5);
  const weDays = clampInt(a.weekendDays ?? 0, 0, 2);

  return wDays + weDays;
}

type ActivityLevelKey =
  | "sedentary"
  | "irregular_b"
  | "irregular_a"
  | "active"
  | "very_active";

function classifyLevel(
  modMinWeek: number,
  modDays: number,
  vigMinWeek: number,
  vigDays: number
) {
  const totalMin = modMinWeek + vigMinWeek;
  const totalDays = clampInt(modDays + vigDays, 0, 7);

  const modMET = modMinWeek * 4.0;
  const vigMET = vigMinWeek * 8.0;
  const totalMET = modMET + vigMET;

  const didAny = totalMin >= 10;

  if (!didAny) {
    return {
      key: "sedentary" as const,
      totalDays,
      totalMin,
      modMET,
      vigMET,
      totalMET,
    };
  }

  const meetsVeryActive =
    (vigDays >= 3 && vigMET >= 1500) ||
    (totalDays >= 5 && totalMET >= 3000);

  if (meetsVeryActive) {
    return {
      key: "very_active" as const,
      totalDays,
      totalMin,
      modMET,
      vigMET,
      totalMET,
    };
  }

  const meetsActive =
    (totalDays >= 7 && totalMET >= 3000) ||
    (vigDays >= 3 && vigMET >= 1500);

  if (meetsActive) {
    return {
      key: "active" as const,
      totalDays,
      totalMin,
      modMET,
      vigMET,
      totalMET,
    };
  }

  const meetsFrequency = totalDays >= 5;
  const meetsDuration = totalMin >= 150;

  if (meetsFrequency && meetsDuration) {
    return {
      key: "active" as const,
      totalDays,
      totalMin,
      modMET,
      vigMET,
      totalMET,
    };
  }

  if (meetsFrequency || meetsDuration) {
    return {
      key: "irregular_a" as const,
      totalDays,
      totalMin,
      modMET,
      vigMET,
      totalMET,
    };
  }

  return {
    key: "irregular_b" as const,
    totalDays,
    totalMin,
    modMET,
    vigMET,
    totalMET,
  };
}

function levelLabel(t: (k: string) => string, key: ActivityLevelKey) {
  return t(`questionnaires:activitySedentary.levels.${key}`);
}

type NumberBoxProps = {
  label: string;
  value: number | null;
  onChange: (txt: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  width?: number;
  maxLength: number;
  editable?: boolean;
  styles: ReturnType<typeof makeStyles>;
  mutedColor: string;
};

const NumberBox = React.memo(function NumberBox({
  label,
  value,
  onChange,
  onFocus,
  onBlur,
  placeholder,
  width,
  maxLength,
  editable = true,
  styles,
  mutedColor,
}: NumberBoxProps) {
  return (
    <View style={{ flex: width ? 0 : 1, width: width ?? undefined }}>
      <Text style={styles.inputLabel}>{label}</Text>

      <TextInput
        value={value == null ? "" : String(value)}
        onChangeText={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
        keyboardType={Platform.OS === "ios" ? "number-pad" : "numeric"}
        returnKeyType="done"
        onSubmitEditing={() => Keyboard.dismiss()}
        editable={editable}
        style={[styles.input, !editable && styles.inputDisabled]}
        placeholder={placeholder}
        placeholderTextColor={mutedColor}
        maxLength={maxLength}
        blurOnSubmit={true}
        inputAccessoryViewID={
          Platform.OS === "ios" ? INPUT_ACCESSORY_VIEW_ID : undefined
        }
      />
    </View>
  );
});

export function PhysicalActivitySedentaryScreen({ navigation, route }: any) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation(["questionnaires", "common"]);

  const participant = route?.params?.participant as Participant | undefined;
  const participantId: string =
    route?.params?.participantId ?? participant?.id ?? "";

  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [numericInputFocused, setNumericInputFocused] = useState(false);
  const hideDoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [answers, setAnswers] = useState<Answers>({
    sleep: emptySection({ weekDays: 5, weekendDays: 2 }),
    moderate: emptySection(),
    vigorous: emptySection(),
    sedentary: emptySection(),
  });

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () => {
      setKeyboardVisible(true);
    });

    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    navigation?.setOptions?.({
      headerStyle: { backgroundColor: theme.colors.primary },
      headerTintColor: "#fff",
      headerTitleStyle: { color: "#fff", fontWeight: "900" },
      headerShadowVisible: false,
    });
  }, [navigation, theme.colors.primary]);

  useEffect(() => {
    if (!participant) {
      navigation.replace(Routes.ParticipantPick, {
        nextRoute: Routes.PhysicalActivitySedentary,
        testTitle: t("questionnaires:hub.openActivitySedentary"),
        testKey: "activity_sedentary",
      });
    }
  }, [participant, navigation, t]);

  const sections: SectionConfig[] = useMemo(
    () => [
      {
        key: "sleep",
        title: "Sono habitual",
        body: "Informe o tempo habitual de sono nos dias da semana e nos dias do final de semana.",
        weekdaysQuestion:
          "Qual o seu tempo habitual de sono durante os dias da semana?",
        weekendQuestion:
          "Qual o seu tempo habitual de sono durante os dias do final de semana?",
      },
      {
        key: "moderate",
        titleKey: "questionnaires:activitySedentary.moderate.title",
        bodyKey: "questionnaires:activitySedentary.moderate.body",
        qPrefixKey: "questionnaires:activitySedentary.moderate.qPrefix",
      },
      {
        key: "vigorous",
        titleKey: "questionnaires:activitySedentary.vigorous.title",
        bodyKey: "questionnaires:activitySedentary.vigorous.body",
        qPrefixKey: "questionnaires:activitySedentary.vigorous.qPrefix",
      },
      {
        key: "sedentary",
        titleKey: "questionnaires:activitySedentary.sedentary.title",
        bodyKey: "questionnaires:activitySedentary.sedentary.body",
        qPrefixKey: "questionnaires:activitySedentary.sedentary.qPrefix",
      },
    ],
    []
  );

  const current = sections[step] ?? sections[0];
  const currentAnswers = answers[current.key];
  const isSleepStep = current.key === "sleep";

  const currentTitle = current.titleKey
    ? t(current.titleKey)
    : current.title ?? "";

  const currentBody = current.bodyKey
    ? t(current.bodyKey)
    : current.body ?? "";

  const currentWeekdaysQuestion = current.qPrefixKey
    ? t(`${current.qPrefixKey}.weekdays`)
    : current.weekdaysQuestion ?? "";

  const currentWeekendQuestion = current.qPrefixKey
    ? t(`${current.qPrefixKey}.weekend`)
    : current.weekendQuestion ?? "";

  const progress = `${step + 1}/${sections.length}`;

  const setField = (
    key: keyof SectionAnswers,
    raw: string,
    min: number,
    max: number
  ) => {
    const n = parseMaybeInt(raw);

    setAnswers((prev) => ({
      ...prev,
      [current.key]: {
        ...prev[current.key],
        [key]: n == null ? null : clampInt(n, min, max),
      },
    }));
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
    setKeyboardVisible(false);
  };

  const doneLabel = t("common:actions.done", { defaultValue: "Concluir" });

  const handleNumberFocus = () => {
    if (hideDoneTimerRef.current) {
      clearTimeout(hideDoneTimerRef.current);
      hideDoneTimerRef.current = null;
    }
    setNumericInputFocused(true);
  };

  const handleNumberBlur = () => {
    if (hideDoneTimerRef.current) clearTimeout(hideDoneTimerRef.current);
    hideDoneTimerRef.current = setTimeout(() => {
      setNumericInputFocused(false);
    }, 120);
  };

  const goNext = () => {
    dismissKeyboard();

    const norm = (v: number | null, min: number, max: number) =>
      typeof v === "number" && Number.isFinite(v)
        ? clampInt(v, min, max)
        : 0;

    const normalizedAnswers: Answers = {
      ...answers,
      [current.key]: {
        weekDays: isSleepStep ? 5 : norm(answers[current.key].weekDays, 0, 5),
        weekH: norm(answers[current.key].weekH, 0, 23),
        weekM: norm(answers[current.key].weekM, 0, 59),
        weekendDays: isSleepStep
          ? 2
          : norm(answers[current.key].weekendDays, 0, 2),
        weekendH: norm(answers[current.key].weekendH, 0, 23),
        weekendM: norm(answers[current.key].weekendM, 0, 59),
      },
    };

    setAnswers(normalizedAnswers);
    setError("");

    if (step < sections.length - 1) {
      setStep((s) => s + 1);
      return;
    }

    const sleepMinWeek = minutesPerWeekForSection(normalizedAnswers.sleep);
    const sleepDays = daysPerWeekForSection(normalizedAnswers.sleep);

    const modMinWeek = minutesPerWeekForSection(normalizedAnswers.moderate);
    const modDays = daysPerWeekForSection(normalizedAnswers.moderate);

    const vigMinWeek = minutesPerWeekForSection(normalizedAnswers.vigorous);
    const vigDays = daysPerWeekForSection(normalizedAnswers.vigorous);

    const sedentaryMinWeek = minutesPerWeekForSection(
      normalizedAnswers.sedentary
    );
    const sedentaryDays = daysPerWeekForSection(normalizedAnswers.sedentary);

    const cls = classifyLevel(modMinWeek, modDays, vigMinWeek, vigDays);

    navigation.navigate(Routes.PhysicalActivitySedentaryResult, {
      participant,
      participantId,
      participantName: participant?.name ?? "",
      answers: normalizedAnswers,
      summary: {
        sleepMinWeek,
        sleepDays,
        modMinWeek,
        modDays,
        vigMinWeek,
        vigDays,
        sedentaryMinWeek,
        sedentaryDays,
        ...cls,
        label: levelLabel(t, cls.key),
      },
    });
  };

  const goPrev = () => {
    dismissKeyboard();

    if (step === 0) return;

    setStep((s) => s - 1);
    setError("");
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.card }}
      edges={["bottom"]}
    >
      <View style={styles.container}>
        <View style={styles.hero}>
          <View style={styles.heroPattern} pointerEvents="none">
            <View style={styles.heroRingA} />
            <View style={styles.heroRingB} />
            <View style={styles.heroDiag} />
          </View>

          <View style={styles.heroTopRow}>
            <Text style={styles.heroTitle}>
              {t("questionnaires:activitySedentary.heroTitle")}
            </Text>

            <View style={styles.pill}>
              <Text style={styles.pillText}>{progress}</Text>
            </View>
          </View>

          <Text style={styles.heroSub}>
            {participant?.name ??
              t("questionnaires:activitySedentary.participantFallback")}
          </Text>

          <Text style={styles.heroHint}>{currentTitle}</Text>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: keyboardVisible ? 160 : 140 },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View key={`card-${current.key}`} style={styles.card}>
              <Text style={styles.blockTitle}>{currentTitle}</Text>
              <Text style={styles.hintText}>{currentBody}</Text>

              <View style={styles.divider} />

              <Text style={styles.subBlockTitle}>
                {t("questionnaires:activitySedentary.questions.weekdaysTitle")}
              </Text>

              <Text style={styles.qText}>{currentWeekdaysQuestion}</Text>

              <View style={styles.inlineInputs}>
                <NumberBox
                  key={`${current.key}-weekDays`}
                  label={t("questionnaires:activitySedentary.fields.days")}
                  value={currentAnswers.weekDays}
                  onChange={(txt) => setField("weekDays", txt, 0, 5)}
                  onFocus={handleNumberFocus}
                  onBlur={handleNumberBlur}
                  placeholder="0"
                  width={110}
                  maxLength={1}
                  editable={!isSleepStep}
                  styles={styles}
                  mutedColor={theme.colors.muted}
                />

                <NumberBox
                  key={`${current.key}-weekH`}
                  label={t("questionnaires:activitySedentary.fields.hours")}
                  value={currentAnswers.weekH}
                  onChange={(txt) => setField("weekH", txt, 0, 23)}
                  onFocus={handleNumberFocus}
                  onBlur={handleNumberBlur}
                  placeholder="0"
                  maxLength={2}
                  styles={styles}
                  mutedColor={theme.colors.muted}
                />

                <NumberBox
                  key={`${current.key}-weekM`}
                  label={t("questionnaires:activitySedentary.fields.minutes")}
                  value={currentAnswers.weekM}
                  onChange={(txt) => setField("weekM", txt, 0, 59)}
                  onFocus={handleNumberFocus}
                  onBlur={handleNumberBlur}
                  placeholder="0"
                  maxLength={2}
                  styles={styles}
                  mutedColor={theme.colors.muted}
                />
              </View>

              <View style={{ height: 12 }} />

              <Text style={styles.subBlockTitle}>
                {t("questionnaires:activitySedentary.questions.weekendTitle")}
              </Text>

              <Text style={styles.qText}>{currentWeekendQuestion}</Text>

              <View style={styles.inlineInputs}>
                <NumberBox
                  key={`${current.key}-weekendDays`}
                  label={t("questionnaires:activitySedentary.fields.days")}
                  value={currentAnswers.weekendDays}
                  onChange={(txt) => setField("weekendDays", txt, 0, 2)}
                  onFocus={handleNumberFocus}
                  onBlur={handleNumberBlur}
                  placeholder="0"
                  width={110}
                  maxLength={1}
                  editable={!isSleepStep}
                  styles={styles}
                  mutedColor={theme.colors.muted}
                />

                <NumberBox
                  key={`${current.key}-weekendH`}
                  label={t("questionnaires:activitySedentary.fields.hours")}
                  value={currentAnswers.weekendH}
                  onChange={(txt) => setField("weekendH", txt, 0, 23)}
                  onFocus={handleNumberFocus}
                  onBlur={handleNumberBlur}
                  placeholder="0"
                  maxLength={2}
                  styles={styles}
                  mutedColor={theme.colors.muted}
                />

                <NumberBox
                  key={`${current.key}-weekendM`}
                  label={t("questionnaires:activitySedentary.fields.minutes")}
                  value={currentAnswers.weekendM}
                  onChange={(txt) => setField("weekendM", txt, 0, 59)}
                  onFocus={handleNumberFocus}
                  onBlur={handleNumberBlur}
                  placeholder="0"
                  maxLength={2}
                  styles={styles}
                  mutedColor={theme.colors.muted}
                />
              </View>

              {!!error && <Text style={styles.errorText}>{error}</Text>}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.navBtn, step === 0 && styles.navBtnDisabled]}
            disabled={step === 0}
            onPress={goPrev}
          >
            <Text style={styles.navText}>{t("common:actions.back")}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navBtn, styles.navBtnPrimary]}
            onPress={goNext}
          >
            <Text style={[styles.navText, styles.navTextPrimary]}>
              {step === sections.length - 1
                ? t("questionnaires:activitySedentary.actions.finish")
                : t("questionnaires:activitySedentary.actions.next")}
            </Text>
          </TouchableOpacity>
        </View>

        {Platform.OS === "ios" ? (
          <InputAccessoryView nativeID={INPUT_ACCESSORY_VIEW_ID}>
            <View style={styles.keyboardToolbar}>
              <Pressable
                onPress={dismissKeyboard}
                style={styles.keyboardToolbarButton}
                hitSlop={12}
              >
                <Text style={styles.keyboardToolbarButtonText}>{doneLabel}</Text>
              </Pressable>
            </View>
          </InputAccessoryView>
        ) : null}

        {Platform.OS !== "ios" && keyboardVisible && numericInputFocused ? (
          <View style={styles.androidKeyboardToolbar} pointerEvents="box-none">
            <Pressable
              onPress={dismissKeyboard}
              style={styles.androidKeyboardToolbarButton}
              hitSlop={12}
            >
              <Text style={styles.androidKeyboardToolbarButtonText}>
                {doneLabel}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

export default PhysicalActivitySedentaryScreen;

function makeStyles(theme: any) {
  const COLORS = {
    primary: theme.colors.primary,
    page: theme.colors.card,
    surface: theme.colors.bg,
    text: theme.colors.text,
    muted: theme.colors.muted,
    border: theme.colors.border,
  };

  const SPACING = {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24,
  } as const;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.page,
    },

    hero: {
      backgroundColor: COLORS.primary,
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.lg,
      paddingBottom: SPACING.xl,
      borderBottomLeftRadius: 24,
      borderBottomRightRadius: 24,
      overflow: "hidden",
    },

    heroPattern: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.25,
    },

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
      width: 500,
      height: 2,
      backgroundColor: "#FFFFFF",
      top: 70,
      left: -120,
      transform: [{ rotate: "-12deg" }],
      opacity: 0.45,
    },

    heroTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    heroTitle: {
      color: "#fff",
      fontSize: 22,
      fontWeight: "900",
      letterSpacing: 0.2,
    },

    heroSub: {
      marginTop: 10,
      color: "#fff",
      fontSize: 15,
      opacity: 0.95,
      fontWeight: "700",
    },

    heroHint: {
      marginTop: 6,
      color: "#fff",
      fontSize: 13,
      opacity: 0.9,
    },

    pill: {
      backgroundColor: "rgba(255,255,255,0.18)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.35)",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
    },

    pillText: {
      color: "#fff",
      fontWeight: "800",
      fontSize: 12,
    },

    scrollContent: {
      paddingBottom: 18,
      paddingTop: 0,
    },

    card: {
      marginHorizontal: SPACING.lg,
      marginTop: 14,
      backgroundColor: COLORS.surface,
      borderRadius: 18,
      padding: SPACING.lg,
      borderWidth: 1,
      borderColor: COLORS.border,
      shadowColor: "#000",
      shadowOpacity: theme.mode === "light" ? 0.08 : 0.25,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },

    blockTitle: {
      fontSize: 18,
      fontWeight: "900",
      color: COLORS.text,
      marginBottom: SPACING.sm,
    },

    subBlockTitle: {
      fontSize: 14,
      fontWeight: "900",
      color: COLORS.text,
      marginBottom: SPACING.sm,
    },

    hintText: {
      color: COLORS.muted,
      marginBottom: SPACING.sm,
      lineHeight: 20,
    },

    qText: {
      color: COLORS.text,
      lineHeight: 22,
    },

    input: {
      marginTop: 8,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 14,
      paddingVertical: 11,
      paddingHorizontal: 12,
      color: COLORS.text,
      backgroundColor: theme.mode === "light" ? "#F7FAFF" : theme.colors.card,
    },

    inputDisabled: {
      opacity: 0.7,
    },

    inputLabel: {
      color: COLORS.muted,
      fontSize: 12,
      fontWeight: "700",
    },

    inlineInputs: {
      marginTop: 10,
      flexDirection: "row",
      gap: 12,
      alignItems: "flex-end",
    },

    divider: {
      marginVertical: SPACING.lg,
      height: 1,
      backgroundColor: COLORS.border,
    },

    errorText: {
      marginTop: 14,
      color: "#E74C3C",
      fontWeight: "900",
    },

    footer: {
      flexDirection: "row",
      gap: 12,
      padding: SPACING.lg,
      backgroundColor: COLORS.surface,
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
    },

    navBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: "center",
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: theme.mode === "light" ? "#F7FAFF" : theme.colors.card,
    },

    navBtnPrimary: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
    },

    navBtnDisabled: {
      opacity: 0.4,
    },

    navText: {
      color: COLORS.text,
      fontWeight: "900",
    },

    navTextPrimary: {
      color: "#fff",
    },

    keyboardToolbar: {
      height: 48,
      backgroundColor: theme.mode === "light" ? "#F8FAFC" : theme.colors.bg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      paddingHorizontal: 16,
    },

    keyboardToolbarButton: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 10,
    },

    keyboardToolbarButtonText: {
      fontSize: 16,
      fontWeight: "900",
      color: theme.colors.primary,
    },

    androidKeyboardToolbar: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 74,
      minHeight: 48,
      backgroundColor: theme.mode === "light" ? "#F8FAFC" : theme.colors.bg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      paddingHorizontal: 16,
      zIndex: 99,
      elevation: 99,
    },

    androidKeyboardToolbarButton: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 10,
      backgroundColor:
        theme.mode === "light"
          ? "rgba(11,99,246,0.08)"
          : "rgba(255,255,255,0.08)",
    },

    androidKeyboardToolbarButtonText: {
      fontSize: 16,
      fontWeight: "900",
      color: theme.colors.primary,
    },
  });
}