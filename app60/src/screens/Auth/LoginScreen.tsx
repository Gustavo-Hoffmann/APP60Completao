import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, View } from "react-native";
import { Screen, T } from "../../components/Themed";
import { ThemedInput } from "../../components/ThemedInput";
import { ThemedButton } from "../../components/ThemedButton";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";

export function LoginScreen() {
  const { login } = useAuth();
  const { theme } = useTheme();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    try {
      if (!email.trim() || !password.trim()) {
        Alert.alert("Login", "Preencha e-mail e senha.");
        return;
      }

      setLoading(true);
      await login(email, password);
    } catch (e: any) {
      Alert.alert("Login", e?.message ?? "Erro ao entrar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: "center" }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          style={{
            borderRadius: 24,
            padding: 20,
            backgroundColor: theme.colors.card,
            borderWidth: 1,
            borderColor: theme.colors.border,
            gap: 14,
          }}
        >
          <View>
            <T style={{ fontSize: 28, fontWeight: "900" }}>Entrar</T>
            <T style={{ color: theme.colors.muted, marginTop: 6 }}>
              Use seu e-mail e senha cadastrados no sistema.
            </T>
          </View>

          <ThemedInput
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            placeholder="seuemail@dominio.com"
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="next"
          />

          <ThemedInput
            label="Senha"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={onLogin}
          />

          <ThemedButton
            title={loading ? "Entrando..." : "Entrar"}
            onPress={onLogin}
            disabled={loading}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}