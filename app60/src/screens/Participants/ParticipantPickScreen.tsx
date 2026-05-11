import React, { useCallback, useMemo, useState } from "react";
import { Alert, FlatList, Pressable, View } from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";

import { Screen, T } from "../../components/Themed";
import { useTheme } from "../../contexts/ThemeContext";
import type { Participant } from "../../models/types";
import { calcAge } from "../../models/utils";
import {
  listParticipants,
  TEST_PARTICIPANT_ID,
  getParticipantSubtitle,
} from "../../services/participants";

type RouteParams = {
  nextRoute: string;
  testTitle?: string;
  testKey?: string;
  nextParams?: Record<string, any>;
};

function ParticipantCard({
  p,
  t,
  onPress,
}: {
  p: Participant;
  t: (key: string, options?: any) => string;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const age = calcAge(p.dob);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: theme.colors.card,
        borderColor: theme.colors.border,
        borderWidth: 1,
        borderRadius: 14,
        padding: 14,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <T style={{ fontSize: 16, fontWeight: "900" }}>{p.name}</T>

      <View style={{ height: 6 }} />

      <T style={{ color: theme.colors.muted }}>
        {age != null ? `${age} anos` : ""}
        {age != null ? " • " : ""}
        {getParticipantSubtitle(p)}
      </T>
    </Pressable>
  );
}

export default function ParticipantPickScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { theme } = useTheme();
  const { t } = useTranslation(["participants", "common"]);

  const { nextRoute, testTitle, testKey, nextParams } = (route.params ?? {}) as RouteParams;

  const [all, setAll] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const list = await listParticipants();
      setAll(list);
    } catch (e: any) {
      Alert.alert(t("participants:pick.listTitle"), e?.message ?? t("participants:pick.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const participants = useMemo(
    () => all.filter((participant) => participant.id !== TEST_PARTICIPANT_ID),
    [all]
  );

  const go = (p: Participant) => {
    if (!nextRoute) return;

    const payload = {
      ...(nextParams ?? {}),
      participant: p,
      participantId: p.id,
      testKey,
    };

    nav.replace(nextRoute, payload);
  };

  const ITEM_H = 86;
  const GAP = 12;

  return (
    <Screen>
      <T style={{ fontSize: 20, fontWeight: "900" }}>{t("participants:pick.title")}</T>

      {!!testTitle && (
        <T style={{ marginTop: 4, color: theme.colors.muted }}>
          {testTitle}
        </T>
      )}

      <View style={{ height: 14 }} />

      <T style={{ fontWeight: "900", marginBottom: 8 }}>
        {loading ? t("common:actions.loading") : t("participants:pick.registered")}
      </T>

      <FlatList
        data={participants}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
        ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
        snapToInterval={ITEM_H + GAP}
        decelerationRate="fast"
        renderItem={({ item }) => (
          <View style={{ minHeight: ITEM_H }}>
            <ParticipantCard p={item} t={t} onPress={() => go(item)} />
          </View>
        )}
        ListEmptyComponent={
          <T style={{ color: theme.colors.muted }}>
            {t("participants:pick.empty")}
          </T>
        }
      />
    </Screen>
  );
}
