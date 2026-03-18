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
  variant?: "primary" | "secondary" | "danger";
  style?: ViewStyle;
  disabled?: boolean;
}) {
  const { theme } = useTheme();

  const bg =
    variant === "primary"
      ? theme.colors.primary
      : variant === "danger"
      ? theme.colors.danger
      : theme.colors.card;

  const textColor = variant === "secondary" ? theme.colors.text : "#FFFFFF";

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
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          borderWidth: variant === "secondary" ? 1 : 0,
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