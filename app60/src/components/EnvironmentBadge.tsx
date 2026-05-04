import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { ENV_LABEL, IS_STAGING } from "../config/env";

export function EnvironmentBadge() {
  if (!IS_STAGING) return null;

  return (
    <View pointerEvents="none" style={styles.container} accessibilityElementsHidden>
      <View style={styles.badge}>
        <Text style={styles.text}>{ENV_LABEL}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 9999,
  },
  badge: {
    backgroundColor: "rgba(180, 44, 44, 0.92)",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  text: {
    color: "white",
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 0.4,
  },
});

