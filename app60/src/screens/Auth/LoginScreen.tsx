import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Alert,
  Easing,
  Image,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";
import { T } from "../../components/Themed";
import { ThemedInput } from "../../components/ThemedInput";
import { ThemedButton } from "../../components/ThemedButton";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import type { AuthUser } from "../../models/auth";

const REMEMBER_ME_KEY = "APP_LOGIN_REMEMBER_ME";
const REMEMBER_EMAIL_KEY = "APP_LOGIN_REMEMBER_EMAIL";
const LOGIN_FULL_LOGO_SOURCE = require("../../../assets/logo-seniorsense.png");
const LOGIN_MAN_WHITE_SOURCE = require("../../../assets/logo-login-man-white.png");
const LOGIN_MAN_BLUE_SOURCE = require("../../../assets/logo-login-man-blue.png");
const FULL_LOGO_ASSET = Image.resolveAssetSource(LOGIN_FULL_LOGO_SOURCE);
const FULL_LOGO_ASPECT_RATIO =
  (FULL_LOGO_ASSET?.width ?? 1024) / (FULL_LOGO_ASSET?.height ?? 307);
const MAN_FRAME = {
  x: 0.073,
  y: 0.11,
  width: 0.176,
  height: 0.72,
};
const FADE_DURATION_MS = 700;
const COLOR_SHIFT_DURATION_MS = 450;
const WALK_DURATION_MS = 1850;

type LoginFlowState = "idle" | "loading" | "success_animating";

function AnimatedLoginLogo({
  animateWalker,
  onWalkComplete,
}: {
  animateWalker: boolean;
  onWalkComplete: () => void;
}) {
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const fullLogoOpacity = useRef(new Animated.Value(1)).current;
  const whiteManOpacity = useRef(new Animated.Value(0)).current;
  const blueManOpacity = useRef(new Animated.Value(0)).current;
  const walkX = useRef(new Animated.Value(0)).current;
  const bobPhase = useRef(new Animated.Value(0)).current;
  const hasStartedRef = useRef(false);
  const cadenceLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const completeTriggeredRef = useRef(false);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setLayout({ width, height });
  };

  useEffect(() => {
    if (!animateWalker || layout.width <= 0 || hasStartedRef.current) return;

    hasStartedRef.current = true;
    completeTriggeredRef.current = false;

    cadenceLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(bobPhase, {
          toValue: 1,
          duration: 180,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(bobPhase, {
          toValue: 0,
          duration: 180,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ])
    );
    cadenceLoopRef.current.start();

    const travelDistance = Math.max(layout.width * 1.22, 320);
    const animation = Animated.sequence([
      Animated.parallel([
        Animated.timing(fullLogoOpacity, {
          toValue: 0,
          duration: FADE_DURATION_MS,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(whiteManOpacity, {
          toValue: 1,
          duration: FADE_DURATION_MS,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(blueManOpacity, {
          toValue: 1,
          duration: COLOR_SHIFT_DURATION_MS,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(whiteManOpacity, {
          toValue: 0,
          duration: COLOR_SHIFT_DURATION_MS,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(walkX, {
        toValue: travelDistance,
        duration: WALK_DURATION_MS,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    animation.start(({ finished }) => {
      cadenceLoopRef.current?.stop();
      if (finished && !completeTriggeredRef.current) {
        completeTriggeredRef.current = true;
        onWalkComplete();
      }
    });
  }, [
    animateWalker,
    fullLogoOpacity,
    whiteManOpacity,
    blueManOpacity,
    bobPhase,
    layout.width,
    onWalkComplete,
    walkX,
  ]);

  useEffect(() => {
    if (animateWalker) return;
    hasStartedRef.current = false;
    completeTriggeredRef.current = false;
    cadenceLoopRef.current?.stop();
    fullLogoOpacity.setValue(1);
    whiteManOpacity.setValue(0);
    blueManOpacity.setValue(0);
    walkX.setValue(0);
    bobPhase.setValue(0);
  }, [
    animateWalker,
    fullLogoOpacity,
    whiteManOpacity,
    blueManOpacity,
    bobPhase,
    walkX,
  ]);

  useEffect(
    () => () => {
      cadenceLoopRef.current?.stop();
    },
    []
  );

  const manLeft = layout.width * MAN_FRAME.x;
  const manTop = layout.height * MAN_FRAME.y;
  const manWidth = layout.width * MAN_FRAME.width;
  const manHeight = layout.height * MAN_FRAME.height;

  return (
    <View style={{ alignItems: "center", width: "100%" }}>
      <View
        onLayout={onLayout}
        style={{
          width: "100%",
          maxWidth: 320,
          aspectRatio: FULL_LOGO_ASPECT_RATIO,
          position: "relative",
        }}
      >
        <Animated.Image
          source={LOGIN_FULL_LOGO_SOURCE}
          resizeMode="contain"
          style={{
            width: "100%",
            height: "100%",
            opacity: fullLogoOpacity,
            position: "absolute",
          }}
        />

        {layout.width > 0 && (
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: manLeft,
              top: manTop,
              width: manWidth,
              height: manHeight,
              transform: [
                { translateX: walkX },
                {
                  translateY: bobPhase.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, -4],
                  }),
                },
                {
                  rotate: bobPhase.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: ["-1.2deg", "1.2deg", "-1.2deg"],
                  }),
                },
              ],
            }}
          >
            <Animated.Image
              source={LOGIN_MAN_WHITE_SOURCE}
              resizeMode="contain"
              style={{
                width: "100%",
                height: "100%",
                position: "absolute",
                opacity: whiteManOpacity,
              }}
            />
            <Animated.Image
              source={LOGIN_MAN_BLUE_SOURCE}
              resizeMode="contain"
              style={{
                width: "100%",
                height: "100%",
                position: "absolute",
                opacity: blueManOpacity,
              }}
            />
          </Animated.View>
        )}
      </View>
    </View>
  );
}

export function LoginScreen() {
  const { login, finalizeLogin, enterGuestMode } = useAuth();
  const { theme } = useTheme();
  const { t } = useTranslation(["auth", "errors"]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [flowState, setFlowState] = useState<LoginFlowState>("idle");
  const [hydrated, setHydrated] = useState(false);

  const [guestModalVisible, setGuestModalVisible] = useState(false);
  const [guestAge, setGuestAge] = useState("");
  const [guestSex, setGuestSex] = useState<"M" | "F" | null>(null);

  const passwordRef = useRef<TextInput>(null);
  const pendingUserRef = useRef<AuthUser | null>(null);
  const finalizedRef = useRef(false);
  const isBusy = flowState !== "idle";

  useEffect(() => {
    (async () => {
      try {
        const [[, savedRemember], [, savedEmail]] =
          await AsyncStorage.multiGet([REMEMBER_ME_KEY, REMEMBER_EMAIL_KEY]);
        const remember = savedRemember !== "false";
        setRememberMe(remember);
        if (remember && savedEmail) setEmail(savedEmail);
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  const openGuestModal = () => {
    if (isBusy) return;
    setGuestAge("");
    setGuestSex(null);
    setGuestModalVisible(true);
  };

  const confirmGuest = () => {
    const parsed = Number(guestAge.replace(/\D/g, ""));
    if (!Number.isFinite(parsed) || parsed < 18 || parsed > 120) {
      Alert.alert(t("errors:titles.guest"), t("auth:guest.invalidAge"));
      return;
    }

    if (!guestSex) {
      Alert.alert(t("errors:titles.guest"), t("auth:guest.missingSex"));
      return;
    }

    setGuestModalVisible(false);
    enterGuestMode({ age: parsed, sex: guestSex });
  };

  const onLogin = async () => {
    if (isBusy) return;

    try {
      if (!email.trim() || !password.trim()) {
        Alert.alert(t("errors:titles.login"), t("auth:login.requiredFields"));
        return;
      }

      setFlowState("loading");
      finalizedRef.current = false;
      pendingUserRef.current = null;

      await AsyncStorage.setItem(REMEMBER_ME_KEY, rememberMe ? "true" : "false");
      if (rememberMe) {
        await AsyncStorage.setItem(REMEMBER_EMAIL_KEY, email.trim());
      } else {
        await AsyncStorage.removeItem(REMEMBER_EMAIL_KEY);
      }

      const nextUser = await login(email, password, { deferSession: true });
      pendingUserRef.current = nextUser;
      setFlowState("success_animating");
    } catch (e: any) {
      setFlowState("idle");
      pendingUserRef.current = null;
      Alert.alert(t("errors:titles.login"), e?.message ?? t("auth:login.genericError"));
    }
  };

  const handleAnimationComplete = () => {
    if (finalizedRef.current) return;
    if (!pendingUserRef.current) {
      setFlowState("idle");
      return;
    }

    finalizedRef.current = true;
    finalizeLogin(pendingUserRef.current);
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.card }}
      edges={["top", "bottom"]}
    >
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 4,
          alignItems: "flex-end",
        }}
      >
        <LanguageSwitcher />
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            paddingHorizontal: 16,
            paddingVertical: 24,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={{
              borderRadius: 24,
              padding: 24,
              backgroundColor: theme.colors.bg,
              borderWidth: 1,
              borderColor: theme.colors.border,
              gap: 16,
            }}
          >
            <View style={{ alignItems: "center", marginBottom: 4 }}>
              <AnimatedLoginLogo
                animateWalker={flowState === "success_animating"}
                onWalkComplete={handleAnimationComplete}
              />
              <T
                style={{
                  color: theme.colors.muted,
                  marginTop: 12,
                  textAlign: "center",
                }}
              >
                {t("auth:login.subtitle")}
              </T>
            </View>

            <ThemedInput
              label={t("common:labels.email")}
              value={email}
              onChangeText={setEmail}
              placeholder={t("auth:login.emailPlaceholder")}
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
              textContentType="emailAddress"
              editable={!isBusy}
              onSubmitEditing={() => passwordRef.current?.focus()}
              blurOnSubmit={false}
            />

            <View style={{ marginBottom: 4 }}>
              <T
                style={{
                  color: theme.colors.muted,
                  marginBottom: 6,
                  fontWeight: "700",
                }}
              >
                {t("common:labels.password")}
              </T>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: theme.colors.card,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  paddingRight: 4,
                }}
              >
                <TextInput
                  ref={passwordRef}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t("auth:login.passwordPlaceholder")}
                  placeholderTextColor={theme.colors.muted}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="password"
                  returnKeyType="done"
                  editable={!isBusy}
                  onSubmitEditing={onLogin}
                  style={{
                    flex: 1,
                    color: theme.colors.text,
                    paddingHorizontal: 12,
                    paddingVertical: 12,
                  }}
                />

                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  disabled={isBusy}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={
                    showPassword ? t("auth:login.hidePassword") : t("auth:login.showPassword")
                  }
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 10,
                  }}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={theme.colors.muted}
                  />
                </Pressable>
              </View>
            </View>

            <Pressable
              onPress={() => setRememberMe((v) => !v)}
              disabled={isBusy || !hydrated}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingVertical: 4,
              }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: rememberMe }}
            >
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 6,
                  borderWidth: 1.5,
                  borderColor: rememberMe
                    ? theme.colors.primary
                    : theme.colors.border,
                  backgroundColor: rememberMe
                    ? theme.colors.primary
                    : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {rememberMe && (
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                )}
              </View>
              <T style={{ color: theme.colors.muted }}>{t("auth:login.rememberMe")}</T>
            </Pressable>

            <ThemedButton
              title={
                flowState === "success_animating"
                  ? t("auth:login.openingTests", { defaultValue: "Abrindo testes..." })
                  : flowState === "loading"
                    ? t("auth:login.submitting")
                    : t("auth:login.submit")
              }
              onPress={onLogin}
              disabled={isBusy}
            />
          </View>

          <Pressable
            onPress={openGuestModal}
            disabled={isBusy}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t("auth:login.guestA11y")}
            style={({ pressed }) => ({
              alignSelf: "center",
              marginTop: 18,
              paddingHorizontal: 14,
              paddingVertical: 8,
              opacity: pressed ? 0.65 : 0.38,
            })}
          >
            <T
              style={{
                color: theme.colors.muted,
                fontSize: 12,
                fontWeight: "600",
                letterSpacing: 0.3,
                textDecorationLine: "underline",
                textAlign: "center",
              }}
            >
              {t("auth:login.guestCta")}
            </T>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={guestModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setGuestModalVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.55)",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 420,
              borderRadius: 20,
              padding: 22,
              backgroundColor: theme.colors.bg,
              borderWidth: 1,
              borderColor: theme.colors.border,
              gap: 14,
            }}
          >
            <T style={{ fontSize: 18, fontWeight: "900", color: theme.colors.text }}>
              {t("auth:guest.title")}
            </T>
            <T style={{ color: theme.colors.muted, fontSize: 13, lineHeight: 18 }}>
              {t("auth:guest.description")}
            </T>

            <ThemedInput
              label={t("auth:guest.ageLabel")}
              value={guestAge}
              onChangeText={(v) => setGuestAge(v.replace(/\D/g, "").slice(0, 3))}
              placeholder={t("auth:guest.agePlaceholder")}
              keyboardType="number-pad"
              returnKeyType="done"
            />

            <View>
              <T
                style={{
                  color: theme.colors.muted,
                  marginBottom: 8,
                  fontWeight: "700",
                }}
              >
                {t("auth:guest.sexLabel")}
              </T>

              <View style={{ flexDirection: "row", gap: 10 }}>
                {([
                  { key: "F" as const, label: t("auth:guest.female") },
                  { key: "M" as const, label: t("auth:guest.male") },
                ]).map((opt) => {
                  const active = guestSex === opt.key;
                  return (
                    <Pressable
                      key={opt.key}
                      onPress={() => setGuestSex(opt.key)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      style={{
                        flex: 1,
                        paddingVertical: 12,
                        paddingHorizontal: 14,
                        borderRadius: 12,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: active
                          ? theme.colors.primary
                          : theme.colors.card,
                        borderWidth: 1,
                        borderColor: active
                          ? theme.colors.primary
                          : theme.colors.border,
                      }}
                    >
                      <T
                        style={{
                          color: active ? "#FFFFFF" : theme.colors.text,
                          fontWeight: "800",
                        }}
                      >
                        {opt.label}
                      </T>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
              <View style={{ flex: 1 }}>
                <ThemedButton
                  title={t("common:actions.cancel")}
                  variant="secondary"
                  onPress={() => setGuestModalVisible(false)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedButton title={t("auth:login.submit")} onPress={confirmGuest} />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
