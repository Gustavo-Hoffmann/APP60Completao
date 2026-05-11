import React from "react";
import { Pressable, Text, ViewStyle } from "react-native";
import { useTheme } from "../contexts/ThemeContext";

export function ThemedButton({
  title,
  onPress,
  variant = "primary",
  style,
  disabled,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "inactive";
  style?: ViewStyle;
  disabled?: boolean;
}) {
  const { theme } = useTheme();

  const bg =
    variant === "primary"
      ? theme.colors.primary
      : variant === "danger"
      ? theme.colors.danger
      : variant === "inactive"
      ? "#FFFFFF"
      : theme.colors.card;

  const textColor =
    variant === "secondary"
      ? theme.colors.text
      : variant === "inactive"
      ? "#0B1220"
      : "#FFFFFF";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          paddingVertical: 14,
          paddingHorizontal: 14,
          borderRadius: 12,
          opacity: disabled && variant !== "inactive" ? 0.5 : pressed ? 0.85 : 1,
          borderWidth: variant === "secondary" || variant === "inactive" ? 1 : 0,
          borderColor: theme.colors.border,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <Text style={{ color: textColor, fontWeight: "800" }}>{title}</Text>
    </Pressable>
  );
}