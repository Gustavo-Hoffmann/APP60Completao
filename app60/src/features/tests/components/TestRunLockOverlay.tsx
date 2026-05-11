import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

export type TestRunLockOverlayProps = {
  visible: boolean;
  locked: boolean;
  tapCount?: number;
  onLockTap: () => void;
  canStopManually?: boolean;
  message?: string;
  unlockedMessage?: string;
};

const REQUIRED_TAPS = 3;

export function TestRunLockOverlay({
  visible,
  locked,
  tapCount = 0,
  onLockTap,
  message,
  unlockedMessage,
}: TestRunLockOverlayProps) {
  const { t } = useTranslation("tests");

  if (!visible) return null;

  const safeTapCount = Math.max(0, Math.min(REQUIRED_TAPS, tapCount));
  const title = message ?? t("tests:common.lockOverlay.title");
  const unlockedTitle = unlockedMessage ?? t("tests:common.lockOverlay.unlockedTitle");

  return (
    <View pointerEvents="box-none" style={styles.wrapper}>
      <View pointerEvents="none" style={styles.backdrop} />

      <View pointerEvents="box-none" style={styles.center}>
        <View pointerEvents="auto" style={styles.card}>
          <Pressable
            onPress={onLockTap}
            hitSlop={16}
            accessibilityRole="button"
            accessibilityLabel={
              locked
                ? t("tests:common.lockOverlay.a11yLocked")
                : t("tests:common.lockOverlay.a11yUnlocked")
            }
            style={({ pressed }) => [
              styles.lockButton,
              locked ? styles.lockButtonLocked : styles.lockButtonUnlocked,
              pressed && styles.lockButtonPressed,
            ]}
          >
            <Text style={styles.lockIcon}>{locked ? "🔒" : "🔓"}</Text>
          </Pressable>

          <View style={styles.textBlock} pointerEvents="none">
            {locked ? (
              <>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.subtitle}>{t("tests:common.lockOverlay.subtitle")}</Text>
                <Text style={styles.counter}>
                  {t("tests:common.lockOverlay.counter", {
                    current: safeTapCount,
                    total: REQUIRED_TAPS,
                  })}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.title}>{unlockedTitle}</Text>
                <Text style={styles.subtitle}>{t("tests:common.lockOverlay.unlockedSubtitle")}</Text>
              </>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.62)",
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.94)",
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 18,
    maxWidth: 380,
    width: "100%",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  lockButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
    borderWidth: 1.5,
  },
  lockButtonLocked: {
    backgroundColor: "rgba(220, 38, 38, 0.18)",
    borderColor: "rgba(248, 113, 113, 0.75)",
  },
  lockButtonUnlocked: {
    backgroundColor: "rgba(34, 197, 94, 0.22)",
    borderColor: "rgba(74, 222, 128, 0.85)",
  },
  lockButtonPressed: {
    opacity: 0.7,
  },
  lockIcon: {
    fontSize: 32,
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: "#F8FAFC",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 4,
  },
  subtitle: {
    color: "#E2E8F0",
    fontSize: 15,
    lineHeight: 21,
  },
  counter: {
    color: "#FDE68A",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 8,
  },
});

export default TestRunLockOverlay;
