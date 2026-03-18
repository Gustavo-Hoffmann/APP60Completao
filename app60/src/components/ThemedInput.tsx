import React, { forwardRef } from "react";
import { View, TextInput, Text, ViewStyle, TextInputProps } from "react-native";
import { useTheme } from "../contexts/ThemeContext";

type Props = {
  label: string;
  value: string;
  onChangeText: (t: string) => void;

  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: TextInputProps["keyboardType"];
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  style?: ViewStyle; // container
  error?: string;

  // ✅ extras necessários pra form decente
  maxLength?: number;
  returnKeyType?: TextInputProps["returnKeyType"];
  onSubmitEditing?: TextInputProps["onSubmitEditing"];
  blurOnSubmit?: boolean;
  autoCorrect?: boolean;
  textContentType?: TextInputProps["textContentType"];
  inputMode?: TextInputProps["inputMode"];
  editable?: boolean;
};

export const ThemedInput = forwardRef<TextInput, Props>(function ThemedInput(
  {
    label,
    value,
    onChangeText,
    placeholder,
    secureTextEntry,
    keyboardType,
    autoCapitalize = "none",
    style,
    error,
    maxLength,
    returnKeyType,
    onSubmitEditing,
    blurOnSubmit,
    autoCorrect = false,
    textContentType,
    inputMode,
    editable = true,
  },
  ref
) {
  const { theme } = useTheme();

  return (
    <View style={[{ marginBottom: 12 }, style]}>
      <Text style={{ color: theme.colors.muted, marginBottom: 6, fontWeight: "700" }}>
        {label}
      </Text>

      <TextInput
        ref={ref}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.muted}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        maxLength={maxLength}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        blurOnSubmit={blurOnSubmit}
        autoCorrect={autoCorrect}
        textContentType={textContentType}
        inputMode={inputMode}
        editable={editable}
        style={{
          backgroundColor: theme.colors.card,
          color: theme.colors.text,
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 12,
          borderWidth: 1,
          borderColor: theme.colors.border,
        }}
      />

      {!!error && (
        <Text style={{ color: theme.colors.danger, marginTop: 6, fontWeight: "700" }}>
          {error}
        </Text>
      )}
    </View>
  );
});