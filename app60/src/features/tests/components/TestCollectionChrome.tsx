import React from "react";
import {
  Image,
  type ImageSourcePropType,
  type StyleProp,
  type ImageStyle,
  View,
  useWindowDimensions,
} from "react-native";

import { T } from "../../../components/Themed";
import { ThemedButton } from "../../../components/ThemedButton";
import type { Participant } from "../../../models/types";
import { calcAge } from "../../../models/utils";
import { getParticipantSubtitle } from "../../../services/participants";

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

export function buildParticipantCollectionLine(participant?: Participant, extra?: string) {
  const extraTrim = extra?.trim();
  if (!participant?.name?.trim()) return extraTrim ?? "—";

  const bits: string[] = [];
  if (participant.dob) {
    try {
      const age = calcAge(participant.dob);
      if (Number.isFinite(age) && age >= 0 && age <= 120) {
        bits.push(`${age} anos`);
      }
    } catch {
      /* ignore */
    }
  }
  if (participant.biologicalSex) {
    bits.push(participant.biologicalSex === "Masculino" ? "M" : "F");
  }
  const doc = getParticipantSubtitle(participant);
  if (doc) bits.push(doc);

  let line = participant.name.trim();
  if (bits.length) line += ` · ${bits.join(" · ")}`;
  if (extraTrim) line += ` · ${extraTrim}`;
  return line;
}

export function TestCollectionHeader({
  title,
  participant,
  participantLineExtra,
}: {
  title: string;
  participant?: Participant;
  participantLineExtra?: string;
}) {
  const line = buildParticipantCollectionLine(participant, participantLineExtra);

  return (
    <View style={{ marginTop: 4 }}>
      <T style={{ fontSize: 22, fontWeight: "900", textAlign: "center", color: TITLE_BLUE }}>{title}</T>
      <T
        style={{
          marginTop: 8,
          fontSize: 14,
          lineHeight: 20,
          textAlign: "center",
          color: META_GRAY,
          fontWeight: "500",
        }}
        numberOfLines={4}
      >
        {line}
      </T>
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
