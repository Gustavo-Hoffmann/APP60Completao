import React, { useCallback, useMemo, useState } from "react";
import { Alert, FlatList, Pressable, View } from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";

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
  pinned,
  onPress,
}: {
  p: Participant;
  pinned?: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const age = p.id === TEST_PARTICIPANT_ID ? null : calcAge(p.dob);

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
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <T style={{ fontSize: 16, fontWeight: "900" }}>{p.name}</T>

        {pinned ? (
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: theme.colors.primary,
            }}
          >
            <T style={{ color: "#fff", fontWeight: "900", fontSize: 12 }}>EXEMPLO</T>
          </View>
        ) : null}
      </View>

      <View style={{ height: 6 }} />

      {p.id === TEST_PARTICIPANT_ID ? (
        <T style={{ color: theme.colors.muted }}>
          Maria Silva • sujeito exemplo fixo para testar fluxo/export.
        </T>
      ) : (
        <T style={{ color: theme.colors.muted }}>
          {age != null ? `${age} anos` : ""}
          {age != null ? " • " : ""}
          {getParticipantSubtitle(p)}
        </T>
      )}
    </Pressable>
  );
}

export default function ParticipantPickScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { theme } = useTheme();

  const { nextRoute, testTitle, testKey, nextParams } = (route.params ?? {}) as RouteParams;

  const [all, setAll] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const list = await listParticipants();
      setAll(list);
    } catch (e: any) {
      Alert.alert("Participantes", e?.message ?? "Falha ao carregar participantes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const { testP, others } = useMemo(() => {
    const testP = all.find((p) => p.id === TEST_PARTICIPANT_ID) ?? null;
    const others = all.filter((p) => p.id !== TEST_PARTICIPANT_ID);
    return { testP, others };
  }, [all]);

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
      <T style={{ fontSize: 20, fontWeight: "900" }}>Escolha o participante</T>

      {!!testTitle && (
        <T style={{ marginTop: 4, color: theme.colors.muted }}>
          {testTitle}
        </T>
      )}

      <View style={{ height: 14 }} />

      {testP ? <ParticipantCard p={testP} pinned onPress={() => go(testP)} /> : null}

      <View style={{ height: 14 }} />

      <T style={{ fontWeight: "900", marginBottom: 8 }}>
        {loading ? "Carregando..." : "Cadastrados"}
      </T>

      <FlatList
        data={others}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
        ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
        snapToInterval={ITEM_H + GAP}
        decelerationRate="fast"
        renderItem={({ item }) => (
          <View style={{ minHeight: ITEM_H }}>
            <ParticipantCard p={item} onPress={() => go(item)} />
          </View>
        )}
        ListEmptyComponent={
          <T style={{ color: theme.colors.muted }}>
            Nenhum participante real cadastrado ainda. Só tem a Maria Silva travada em cima.
          </T>
        }
      />
    </Screen>
  );
}