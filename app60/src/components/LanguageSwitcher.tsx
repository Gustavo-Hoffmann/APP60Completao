import React from "react";
import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { T } from "./Themed";
import { changeAppLanguage, getCurrentLanguage } from "../i18n";
import type { AppLanguage } from "../i18n/settings";
import { useTheme } from "../contexts/ThemeContext";

const OPTIONS: Array<{ language: AppLanguage; flag: string; labelKey: string; ariaKey: string }> = [
  { language: "pt-BR", flag: "🇧🇷", labelKey: "common:language.pt", ariaKey: "common:language.switchToPt" },
  { language: "en-GB", flag: "🇬🇧", labelKey: "common:language.en", ariaKey: "common:language.switchToEn" },
];

export function LanguageSwitcher() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const active = getCurrentLanguage();

  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {OPTIONS.map((item) => {
        const selected = active === item.language;
        return (
          <Pressable
            key={item.language}
            onPress={() => void changeAppLanguage(item.language)}
            accessibilityRole="button"
            accessibilityLabel={t(item.ariaKey)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              borderWidth: 1,
              borderColor: selected ? theme.colors.primary : theme.colors.border,
              borderRadius: 999,
              paddingVertical: 6,
              paddingHorizontal: 10,
              backgroundColor: selected ? theme.colors.primary : theme.colors.card,
            }}
          >
            <T style={{ color: selected ? "#fff" : theme.colors.text }}>{item.flag}</T>
            <T style={{ color: selected ? "#fff" : theme.colors.text, fontWeight: "800" }}>
              {t(item.labelKey)}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}
