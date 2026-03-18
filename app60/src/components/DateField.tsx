import React, { useState } from "react";
import { Pressable, View, Text } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTheme } from "../contexts/ThemeContext";

export function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Date;
  onChange: (d: Date) => void;
}) {
  const { theme } = useTheme();
  const [show, setShow] = useState(false);

  const fmt = (d: Date) =>
    d.toLocaleDateString("pt-BR", { year: "numeric", month: "2-digit", day: "2-digit" });

  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: theme.colors.muted, marginBottom: 6, fontWeight: "700" }}>
        {label}
      </Text>

      <Pressable
        onPress={() => setShow(true)}
        style={{
          backgroundColor: theme.colors.card,
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 12,
          borderWidth: 1,
          borderColor: theme.colors.border,
        }}
      >
        <Text style={{ color: theme.colors.text, fontWeight: "700" }}>{fmt(value)}</Text>
      </Pressable>

      {show && (
        <DateTimePicker
          value={value}
          mode="date"
          display="default"
          onChange={(_, d) => {
            setShow(false);
            if (d) onChange(d);
          }}
        />
      )}
    </View>
  );
}