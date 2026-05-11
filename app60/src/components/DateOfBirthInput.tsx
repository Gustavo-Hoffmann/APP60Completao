import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";
import {
  formatDobBr,
  isValidDob,
  maskDobInput,
  parseDobBr,
} from "../lib/dateOfBirth";

export function DateOfBirthInput({
  label,
  value,
  onChange,
  error,
  invalidMessage = "Data de nascimento inválida.",
  onValidityChange,
}: {
  label: string;
  value: Date | null;
  onChange: (d: Date | null) => void;
  error?: string;
  invalidMessage?: string;
  onValidityChange?: (valid: boolean) => void;
}) {
  const { theme } = useTheme();
  const [text, setText] = useState(value ? formatDobBr(value) : "");
  const [textInvalid, setTextInvalid] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerDate, setPickerDate] = useState(value ?? new Date());
  const editingRef = useRef(false);

  useEffect(() => {
    if (!editingRef.current) {
      setText(value ? formatDobBr(value) : "");
      setTextInvalid(false);
      onValidityChange?.(true);
    }
    if (value) setPickerDate(value);
  }, [onValidityChange, value]);

  const commitText = (next: string) => {
    const masked = maskDobInput(next);
    setText(masked);

    if (!masked.trim()) {
      setTextInvalid(false);
      onValidityChange?.(true);
      onChange(null);
      return;
    }

    if (masked.length < 10) {
      setTextInvalid(false);
      onValidityChange?.(false);
      onChange(null);
      return;
    }

    const parsed = parseDobBr(masked);
    if (parsed && isValidDob(parsed)) {
      setTextInvalid(false);
      onValidityChange?.(true);
      onChange(parsed);
      return;
    }

    setTextInvalid(true);
    onValidityChange?.(false);
    onChange(null);
  };

  const openPicker = () => {
    setPickerDate(value ?? new Date());
    setShowPicker(true);
  };

  const closePicker = () => setShowPicker(false);

  const confirmPicker = () => {
    if (isValidDob(pickerDate)) {
      setTextInvalid(false);
      onValidityChange?.(true);
      onChange(pickerDate);
      setText(formatDobBr(pickerDate));
    }
    closePicker();
  };

  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: theme.colors.muted, marginBottom: 6, fontWeight: "700" }}>
        {label}
      </Text>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <TextInput
          value={text}
          onFocus={() => {
            editingRef.current = true;
          }}
          onChangeText={commitText}
          onBlur={() => {
            editingRef.current = false;
            if (!text.trim()) {
              setTextInvalid(false);
              onValidityChange?.(true);
              onChange(null);
              return;
            }
            const parsed = parseDobBr(text);
            if (parsed && isValidDob(parsed)) {
              setTextInvalid(false);
              onValidityChange?.(true);
              onChange(parsed);
              setText(formatDobBr(parsed));
              return;
            }
            setTextInvalid(true);
            onValidityChange?.(false);
          }}
          placeholder="DD/MM/AAAA"
          placeholderTextColor={theme.colors.muted}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={10}
          style={{
            flex: 1,
            backgroundColor: theme.colors.card,
            color: theme.colors.text,
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 12,
            borderWidth: 1,
            borderColor: error || textInvalid ? theme.colors.danger : theme.colors.border,
            fontWeight: "700",
          }}
        />

        <Pressable
          onPress={openPicker}
          accessibilityRole="button"
          accessibilityLabel={label}
          style={({ pressed }) => ({
            width: 48,
            height: 48,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.card,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.88 : 1,
          })}
        >
          <Ionicons name="calendar-outline" size={22} color={theme.colors.primary} />
        </Pressable>
      </View>

      {!!(error || textInvalid) && (
        <Text style={{ color: theme.colors.danger, marginTop: 6, fontWeight: "700" }}>
          {error || invalidMessage}
        </Text>
      )}

      {showPicker && Platform.OS === "ios" ? (
        <Modal transparent animationType="slide" onRequestClose={closePicker}>
          <View
            style={{
              flex: 1,
              justifyContent: "flex-end",
              backgroundColor: "rgba(0,0,0,0.35)",
            }}
          >
            <View
              style={{
                backgroundColor: theme.colors.card,
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                paddingBottom: 20,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.colors.border,
                }}
              >
                <Pressable onPress={closePicker} hitSlop={12}>
                  <Text style={{ color: theme.colors.muted, fontWeight: "800" }}>
                    Cancelar
                  </Text>
                </Pressable>
                <Pressable onPress={confirmPicker} hitSlop={12}>
                  <Text style={{ color: theme.colors.primary, fontWeight: "800" }}>
                    Confirmar
                  </Text>
                </Pressable>
              </View>

              <DateTimePicker
                value={pickerDate}
                mode="date"
                display="spinner"
                maximumDate={new Date()}
                onChange={(_, d) => {
                  if (d) setPickerDate(d);
                }}
              />
            </View>
          </View>
        </Modal>
      ) : null}

      {showPicker && Platform.OS === "android" ? (
        <DateTimePicker
          value={pickerDate}
          mode="date"
          display="default"
          maximumDate={new Date()}
          onChange={(event, d) => {
            closePicker();
            if (event.type === "set" && d && isValidDob(d)) {
              setTextInvalid(false);
              onValidityChange?.(true);
              onChange(d);
              setText(formatDobBr(d));
            }
          }}
        />
      ) : null}
    </View>
  );
}
