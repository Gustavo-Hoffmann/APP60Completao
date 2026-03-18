import React from "react";
import { View, Text, ViewProps, TextProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../contexts/ThemeContext";

export function Screen({ children, style, ...rest }: ViewProps) {
  const { theme } = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }} edges={["top", "bottom"]}>
      <View {...rest} style={[{ flex: 1, padding: 16 }, style]}>
        {children}
      </View>
    </SafeAreaView>
  );
}

export function T(props: TextProps) {
  const { theme } = useTheme();
  return <Text {...props} style={[{ color: theme.colors.text }, props.style]} />;
}