import React from "react";
import { StyleSheet, View } from "react-native";

import { T } from "../../../components/Themed";

type TestCollectionRunProgressProps = {
  visible: boolean;
  finished: boolean;
  interrupted: boolean;
  timerText: string;
  progress?: number;
  percentLabel?: string;
  captionText?: string;
  showProgressBar?: boolean;
  interruptedTitle?: string;
};

export function TestCollectionRunProgress({
  visible,
  finished,
  interrupted,
  timerText,
  progress = 0,
  percentLabel,
  captionText,
  showProgressBar = true,
  interruptedTitle,
}: TestCollectionRunProgressProps) {
  if (!visible) return null;

  const clampedProgress = Math.max(0, Math.min(progress, 1));

  return (
    <View style={styles.wrap}>
      <T style={[styles.timer, finished && !percentLabel && styles.timerFinishedLarge]}>{timerText}</T>

      {showProgressBar && !finished ? (
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${clampedProgress * 100}%` }]} />
        </View>
      ) : null}

      {percentLabel ? (
        <View style={styles.percentBlock}>
          {finished && interrupted && interruptedTitle ? (
            <T style={styles.interruptedTitle}>{interruptedTitle}</T>
          ) : null}
          <T style={[styles.percent, finished && styles.percentFinished]}>{percentLabel}</T>
        </View>
      ) : null}

      {captionText ? (
        <T style={[styles.caption, finished && styles.captionFinished]}>{captionText}</T>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    marginBottom: 16,
  },
  timer: {
    textAlign: "center",
    fontSize: 28,
    fontWeight: "900",
    marginBottom: 10,
    color: "#0F172A",
  },
  timerFinishedLarge: {
    marginBottom: 6,
    fontSize: 32,
    color: "#0F172A",
  },
  track: {
    height: 14,
    borderRadius: 999,
    backgroundColor: "#D6DCEC",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    backgroundColor: "#0B5FFF",
  },
  percentBlock: {
    marginTop: 8,
    alignItems: "center",
    gap: 4,
  },
  interruptedTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
  },
  percent: {
    textAlign: "center",
    opacity: 0.7,
    color: "#64748B",
    fontSize: 14,
    fontWeight: "600",
  },
  percentFinished: {
    opacity: 1,
    color: "#0F172A",
    fontSize: 24,
    fontWeight: "900",
  },
  caption: {
    textAlign: "center",
    opacity: 0.7,
    marginTop: 8,
    color: "#64748B",
    fontSize: 14,
    fontWeight: "600",
  },
  captionFinished: {
    opacity: 1,
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "800",
  },
});
