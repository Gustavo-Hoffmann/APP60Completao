import React from "react";
import {
  Image,
  type ImageSourcePropType,
  type StyleProp,
  type ImageStyle,
  type ViewStyle,
  View,
  useWindowDimensions,
} from "react-native";
import { useTranslation } from "react-i18next";

import { T } from "../../../components/Themed";
import { ThemedButton } from "../../../components/ThemedButton";
import { useTheme } from "../../../contexts/ThemeContext";
import type { Participant } from "../../../models/types";
import { formatParticipantCpf, formatParticipantName } from "./participantDisplay";

export type TestHeroKey =
  | "sentar_levantar"
  | "elevacao_calcanhares"
  | "limite_estabilidade"
  | "marcha_estacionaria"
  | "tug";

export const TEST_HERO_IMAGE: Record<TestHeroKey, ImageSourcePropType> = {
  sentar_levantar: require("../../../../assets/tests/sentar-levantar.jpeg"),
  elevacao_calcanhares: require("../../../../assets/tests/elevacao-calcanhares.jpeg"),
  limite_estabilidade: require("../../../../assets/tests/limite-estabilidade.jpeg"),
  marcha_estacionaria: require("../../../../assets/tests/marcha-estacionaria.jpeg"),
  tug: require("../../../../assets/tests/tug.png"),
};

const TITLE_BLUE = "#0B5FFF";
const META_GRAY = "#64748B";

export function TestCollectionHeader({
  title,
  participant,
}: {
  title: string;
  participant?: Participant;
}) {
  const { t } = useTranslation("tests");
  const name = formatParticipantName(participant, t);
  const cpf = formatParticipantCpf(participant, t);

  return (
    <View style={{ marginTop: 4 }}>
      <T style={{ fontSize: 22, fontWeight: "900", textAlign: "center", color: TITLE_BLUE }}>{title}</T>
      <View
        style={{
          marginTop: 8,
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
          columnGap: 16,
          rowGap: 4,
        }}
      >
        <T
          style={{
            fontSize: 14,
            lineHeight: 20,
            textAlign: "center",
            color: META_GRAY,
            fontWeight: "500",
          }}
        >
          {t("tests:common.nameLabel")}: {name}
        </T>
        <T
          style={{
            fontSize: 14,
            lineHeight: 20,
            textAlign: "center",
            color: META_GRAY,
            fontWeight: "500",
          }}
        >
          {t("tests:common.cpfLabel")}: {cpf}
        </T>
      </View>
    </View>
  );
}

export function TestCollectionHeroImage({
  testKey,
  style,
}: {
  testKey: TestHeroKey;
  style?: StyleProp<ImageStyle>;
}) {
  const { width } = useWindowDimensions();
  const imgW = Math.min(width * 0.58, 236);
  const imgH = Math.round(imgW * 1.02);

  return (
    <Image
      source={TEST_HERO_IMAGE[testKey]}
      style={[{ width: imgW, height: imgH, borderRadius: 22 }, style]}
      resizeMode="cover"
      accessibilityIgnoresInvertColors
    />
  );
}

export function TestCollectionGoToResultsRow({
  visible,
  title,
  onPress,
}: {
  visible: boolean;
  title: string;
  onPress: () => void;
}) {
  if (!visible) return null;

  return (
    <View style={{ width: "100%", marginTop: 12 }}>
      <ThemedButton title={title} onPress={onPress} style={{ alignSelf: "stretch" }} />
    </View>
  );
}

export function TestCollectionInfoCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        {
          width: "100%",
          backgroundColor: theme.colors.card,
          borderRadius: 20,
          paddingVertical: 18,
          paddingHorizontal: 18,
          borderWidth: 1,
          borderColor: theme.colors.border,
          shadowColor: "#0F172A",
          shadowOpacity: theme.mode === "light" ? 0.06 : 0.2,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
