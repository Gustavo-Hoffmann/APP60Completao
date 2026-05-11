import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { T } from "../../../components/Themed";
import { ThemedButton } from "../../../components/ThemedButton";

type TestCollectionAttemptActionsProps = {
  hasLocalAttempt: boolean;
  showActiveControl: boolean;
  activeControlTitle: string;
  onActiveControlPress: () => void;
  activeControlDisabled?: boolean;
  onStart: () => void;
  onRestart: () => void;
  onGoToResults: () => void;
  goToResultsLabel: string;
  showGoToResults: boolean;
  extraIdleContent?: React.ReactNode;
};

export function TestCollectionAttemptActions({
  hasLocalAttempt,
  showActiveControl,
  activeControlTitle,
  onActiveControlPress,
  activeControlDisabled,
  onStart,
  onRestart,
  onGoToResults,
  goToResultsLabel,
  showGoToResults,
  extraIdleContent,
}: TestCollectionAttemptActionsProps) {
  const { t } = useTranslation("tests");

  if (showActiveControl) {
    return (
      <ThemedButton
        title={activeControlTitle}
        variant="danger"
        onPress={onActiveControlPress}
        disabled={activeControlDisabled}
        style={styles.primaryButton}
      />
    );
  }

  if (hasLocalAttempt) {
    return (
      <View style={styles.stack}>
        {showGoToResults ? (
          <ThemedButton title={goToResultsLabel} onPress={onGoToResults} style={styles.primaryButton} />
        ) : null}
        <Pressable style={styles.restartButton} onPress={onRestart}>
          <T style={styles.restartButtonText}>{t("tests:common.restartTest")}</T>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      <ThemedButton title={t("tests:common.startTest")} onPress={onStart} style={styles.primaryButton} />
      {extraIdleContent}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    alignItems: "center",
    gap: 12,
    width: "100%",
  },
  primaryButton: {
    alignSelf: "stretch",
    minWidth: 220,
  },
  restartButton: {
    minWidth: 180,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  restartButtonText: {
    fontWeight: "700",
    color: "#475569",
    fontSize: 14,
  },
});
