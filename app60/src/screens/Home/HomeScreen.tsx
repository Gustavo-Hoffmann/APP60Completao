import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Pressable,
  FlatList,
  Dimensions,
  ImageBackground,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen, T } from "../../components/Themed";
import { ThemedButton } from "../../components/ThemedButton";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { Routes } from "../../navigation/routes";
import type { Role } from "../../models/auth";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const CARD_WIDTH = Math.min(SCREEN_WIDTH * 0.76, 310);
const CARD_HEIGHT = Math.min(SCREEN_WIDTH * 1.02, 400);
const CARD_GAP = 16;
const ITEM_SIZE = CARD_WIDTH + CARD_GAP;
const SIDE_SPACER = (SCREEN_WIDTH - CARD_WIDTH) / 2;

type CarouselItem = {
  key: string;
  testKey: string;
  title: string;
  nextRoute?: string;
  isQuestionnaire?: boolean;
  image: any;
};

const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Administrador",
  GESTOR: "Gestor",
  SUPERVISOR: "Supervisor",
  AVALIADOR: "Avaliador / Pesquisador",
};

const baseItems: CarouselItem[] = [
  {
    key: "sl",
    testKey: "sentar_levantar",
    title: "Sentar e Levantar",
    nextRoute: Routes.Test_SentarLevantar,
    image: require("../../../assets/tests/sentar-levantar.jpeg"),
  },
  {
    key: "ec",
    testKey: "elevacao_calcanhares",
    title: "Elevação de calcanhares",
    nextRoute: Routes.Test_ElevacaoCalcanhares,
    image: require("../../../assets/tests/elevacao-calcanhares.jpeg"),
  },
  {
    key: "le",
    testKey: "limite_estabilidade",
    title: "Limite de Estabilidade",
    nextRoute: Routes.Test_LimiteEstabilidade,
    image: require("../../../assets/tests/limite-estabilidade.jpeg"),
  },
  {
    key: "me",
    testKey: "marcha_estacionaria",
    title: "Marcha estacionária",
    nextRoute: Routes.Test_MarchaEstacionaria,
    image: require("../../../assets/tests/marcha-estacionaria.jpeg"),
  },
  {
    key: "tug",
    testKey: "tug",
    title: "Time Up and Go",
    nextRoute: Routes.Test_TUG,
    image: require("../../../assets/tests/tug.png"),
  },
  {
    key: "questionarios",
    testKey: "questionarios",
    title: "Questionários",
    isQuestionnaire: true,
    image: require("../../../assets/tests/questionarios.jpeg"),
  },
];

function buildInfiniteData(items: CarouselItem[], copies = 3) {
  const data: CarouselItem[] = [];
  for (let i = 0; i < copies; i++) {
    items.forEach((item, idx) => {
      data.push({
        ...item,
        key: `${item.key}-${i}-${idx}`,
      });
    });
  }
  return data;
}

export function HomeScreen({ navigation }: any) {
  const { user } = useAuth();
  const { theme, toggle } = useTheme();

  const flatListRef = useRef<FlatList<CarouselItem>>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const infiniteData = useMemo(() => buildInfiniteData(baseItems, 3), []);
  const [currentIndex, setCurrentIndex] = useState(baseItems.length);

  const isDark = theme.mode === "dark";
  const firstName = user?.name?.split(" ")[0] ?? "Usuário";

  useEffect(() => {
    const timer = setTimeout(() => {
      flatListRef.current?.scrollToIndex({
        index: baseItems.length,
        animated: false,
      });
    }, 40);

    return () => clearTimeout(timer);
  }, []);

  const openItem = (item: CarouselItem) => {
    if (item.isQuestionnaire) {
      navigation.navigate(Routes.QuestionnaireHub);
      return;
    }

    navigation.navigate(Routes.ParticipantPick, {
      nextRoute: item.nextRoute,
      testTitle: item.title,
      testKey: item.testKey,
    });
  };

  const openEditParticipant = () => {
    navigation.navigate(Routes.ParticipantPick, {
      nextRoute: Routes.ParticipantForm,
      testTitle: "Editar participante",
      testKey: "edit_participant",
      nextParams: { mode: "edit" },
    });
  };

  const syncIndexFromOffset = (offsetX: number) => {
    const rawIndex = Math.round(offsetX / ITEM_SIZE);
    setCurrentIndex((prev) => (prev === rawIndex ? prev : rawIndex));
    return rawIndex;
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    syncIndexFromOffset(event.nativeEvent.contentOffset.x);
  };

  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const rawIndex = syncIndexFromOffset(offsetX);

    const total = infiniteData.length;
    const chunk = baseItems.length;

    if (rawIndex < chunk) {
      const newIndex = rawIndex + chunk;
      requestAnimationFrame(() => {
        flatListRef.current?.scrollToIndex({
          index: newIndex,
          animated: false,
        });
        setCurrentIndex(newIndex);
      });
    } else if (rawIndex >= total - chunk) {
      const newIndex = rawIndex - chunk;
      requestAnimationFrame(() => {
        flatListRef.current?.scrollToIndex({
          index: newIndex,
          animated: false,
        });
        setCurrentIndex(newIndex);
      });
    }
  };

  const activeDot = ((currentIndex % baseItems.length) + baseItems.length) % baseItems.length;

  return (
    <Screen>
      <View
        style={{
          flex: 1,
          paddingTop: 8,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: 8,
            paddingHorizontal: 2,
          }}
        >
          <View>
            <T
              style={{
                fontSize: 17,
                color: isDark ? "rgba(255,255,255,0.60)" : "rgba(20,20,30,0.52)",
                fontWeight: "500",
                marginBottom: 2,
              }}
            >
              Bem-vindo
            </T>

            <T
              style={{
                fontSize: 34,
                lineHeight: 38,
                fontWeight: "900",
                color: theme.colors.text,
                letterSpacing: -0.8,
              }}
            >
              {firstName}
            </T>

            <T
              style={{
                marginTop: 4,
                fontSize: 14,
                color: theme.colors.muted,
                fontWeight: "700",
              }}
            >
              Perfil: {user?.role ? ROLE_LABEL[user.role] : "-"}
            </T>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Pressable
              onPress={toggle}
              style={{
                width: 50,
                height: 50,
                borderRadius: 25,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#F3F4F8",
                borderWidth: 1,
                borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(20,20,30,0.05)",
                marginRight: 10,
                shadowColor: "#000",
                shadowOpacity: isDark ? 0.18 : 0.08,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 5 },
                elevation: 3,
              }}
            >
              <Ionicons
                name={isDark ? "sunny-outline" : "moon-outline"}
                size={22}
                color={theme.colors.text}
              />
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate(Routes.Settings)}
              style={{
                width: 50,
                height: 50,
                borderRadius: 25,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#F3F4F8",
                borderWidth: 1,
                borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(20,20,30,0.05)",
                shadowColor: "#000",
                shadowOpacity: isDark ? 0.18 : 0.08,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 5 },
                elevation: 3,
              }}
            >
              <Ionicons name="settings-outline" size={22} color={theme.colors.text} />
            </Pressable>
          </View>
        </View>

        <View
          style={{
            flex: 1,
            justifyContent: "center",
            marginTop: -8,
          }}
        >
          <View
            style={{
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                width: "100%",
                height: CARD_HEIGHT + 34,
                justifyContent: "center",
              }}
            >
              <Animated.FlatList
                ref={flatListRef}
                data={infiniteData}
                keyExtractor={(item) => item.key}
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={ITEM_SIZE}
                decelerationRate="fast"
                bounces={false}
                disableIntervalMomentum
                onMomentumScrollEnd={handleMomentumEnd}
                onScroll={Animated.event(
                  [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                  {
                    useNativeDriver: true,
                    listener: handleScroll,
                  }
                )}
                onScrollToIndexFailed={({ index }) => {
                  setTimeout(() => {
                    flatListRef.current?.scrollToOffset({
                      offset: index * ITEM_SIZE,
                      animated: false,
                    });
                  }, 50);
                }}
                scrollEventThrottle={16}
                getItemLayout={(_, index) => ({
                  length: ITEM_SIZE,
                  offset: ITEM_SIZE * index,
                  index,
                })}
                contentContainerStyle={{
                  paddingHorizontal: SIDE_SPACER,
                  paddingVertical: 12,
                }}
                renderItem={({ item, index }) => {
                  const inputRange = [
                    (index - 1) * ITEM_SIZE,
                    index * ITEM_SIZE,
                    (index + 1) * ITEM_SIZE,
                  ];

                  const translateY = scrollX.interpolate({
                    inputRange,
                    outputRange: [16, 0, 16],
                    extrapolate: "clamp",
                  });

                  const scale = scrollX.interpolate({
                    inputRange,
                    outputRange: [0.94, 1, 0.94],
                    extrapolate: "clamp",
                  });

                  return (
                    <Animated.View
                      style={{
                        width: CARD_WIDTH,
                        height: CARD_HEIGHT,
                        marginRight: CARD_GAP,
                        transform: [{ translateY }, { scale }],
                      }}
                    >
                      <Pressable
                        onPress={() => openItem(item)}
                        style={{
                          flex: 1,
                          borderRadius: 30,
                          overflow: "hidden",
                          backgroundColor: theme.colors.card,
                          borderWidth: 1,
                          borderColor: isDark
                            ? "rgba(255,255,255,0.08)"
                            : "rgba(20,20,30,0.06)",
                          shadowColor: "#000",
                          shadowOpacity: isDark ? 0.22 : 0.12,
                          shadowRadius: 18,
                          shadowOffset: { width: 0, height: 10 },
                          elevation: 8,
                        }}
                      >
                        <ImageBackground
                          source={item.image}
                          resizeMode="cover"
                          style={{ flex: 1, justifyContent: "flex-end" }}
                        >
                          <View
                            style={{
                              padding: 22,
                              backgroundColor: "rgba(0,0,0,0.34)",
                            }}
                          >
                            <T
                              style={{
                                color: "#fff",
                                fontSize: 24,
                                lineHeight: 28,
                                fontWeight: "900",
                              }}
                            >
                              {item.title}
                            </T>
                          </View>
                        </ImageBackground>
                      </Pressable>
                    </Animated.View>
                  );
                }}
              />
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                marginTop: 16,
                gap: 8,
              }}
            >
              {baseItems.map((_, idx) => {
                const active = idx === activeDot;
                return (
                  <View
                    key={idx}
                    style={{
                      width: active ? 22 : 8,
                      height: 8,
                      borderRadius: 99,
                      backgroundColor: active ? theme.colors.primary : theme.colors.border,
                    }}
                  />
                );
              })}
            </View>
          </View>
        </View>

        <View style={{ gap: 10, paddingBottom: 8 }}>
          <ThemedButton
            title="Cadastrar participante"
            onPress={() => navigation.navigate(Routes.ParticipantForm, { mode: "create" })}
          />
          <ThemedButton
            title="Editar participante"
            variant="secondary"
            onPress={openEditParticipant}
          />
        </View>
      </View>
    </Screen>
  );
}