import React, { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Screen, T } from "../../components/Themed";
import { ThemedInput } from "../../components/ThemedInput";
import { ThemedButton } from "../../components/ThemedButton";
import { DateField } from "../../components/DateField";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { useAuth } from "../../contexts/AuthContext";
import type { Role } from "../../models/auth";
import { isValidCPF } from "../../models/validators";

export function SettingsScreen({ navigation }: any) {
  const { user, update, logout } = useAuth();
  const { t } = useTranslation(["settings", "common", "errors", "home"]);

  const [name, setName] = useState("");
  const [dob, setDob] = useState(new Date(1990, 0, 1));
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");

  useEffect(() => {
    if (!user) return;
    setName(user.name ?? "");
    setDob(new Date(user.birth_date ?? "1990-01-01"));
    setCpf(user.cpf ?? "");
    setEmail(user.email ?? "");
  }, [user]);

  const onSave = async () => {
    try {
      if (!name.trim()) throw new Error(t("settings:validation.nameRequired"));
      if (!email.trim()) throw new Error(t("settings:validation.emailRequired"));
      if (cpf.trim() && !isValidCPF(cpf)) throw new Error(t("settings:validation.cpfInvalid"));

      await update(
        {
          name: name.trim(),
          dob: dob.toISOString().slice(0, 10),
          cpf: cpf.trim(),
          email: email.trim(),
        },
        newPw ? currentPw : null,
        newPw || undefined
      );

      Alert.alert(t("errors:titles.ok"), t("settings:updated"));
      navigation.goBack();
    } catch (e: any) {
      Alert.alert(t("errors:titles.error"), e.message ?? t("settings:errors.saveFailed"));
    }
  };

  const onLogout = async () => {
    try {
      await logout();
    } catch (e: any) {
      Alert.alert(t("errors:titles.error"), e.message ?? t("settings:errors.logoutFailed"));
    }
  };

  const roleLabel = user?.role ? t(`home:roles.${user.role as Role}`) : "-";

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 28 }}
        >
          <T style={{ fontSize: 22, fontWeight: "900", marginTop: 18 }}>{t("settings:title")}</T>
          <View style={{ height: 8 }} />
          <T style={{ opacity: 0.7 }}>
            {t("settings:profile", { role: roleLabel })}
          </T>

          <View style={{ height: 14 }} />

          <T style={{ marginTop: 4, fontWeight: "900" }}>{t("settings:languageSection")}</T>
          <View style={{ height: 8 }} />
          <LanguageSwitcher />

          <View style={{ height: 18 }} />

          <ThemedInput label={t("common:labels.name")} value={name} onChangeText={setName} />
          <DateField label={t("common:labels.birthDate")} value={dob} onChange={setDob} />
          <ThemedInput label={t("common:labels.cpf")} value={cpf} onChangeText={setCpf} />
          <ThemedInput
            label={t("common:labels.email")}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <T style={{ marginTop: 10, fontWeight: "900" }}>{t("settings:changePassword")}</T>
          <View style={{ height: 8 }} />
          <ThemedInput
            label={t("settings:currentPassword")}
            value={currentPw}
            onChangeText={setCurrentPw}
            secureTextEntry
          />
          <ThemedInput
            label={t("settings:newPassword")}
            value={newPw}
            onChangeText={setNewPw}
            secureTextEntry
          />

          <View style={{ height: 8 }} />
          <ThemedButton title={t("common:actions.save")} onPress={onSave} />
          <View style={{ height: 12 }} />
          <ThemedButton title={t("settings:logout")} onPress={onLogout} />
          <View style={{ height: 12 }} />
          <ThemedButton
            title={t("common:actions.back")}
            variant="secondary"
            onPress={() => navigation.goBack()}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}