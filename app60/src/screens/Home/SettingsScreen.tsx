import React, { useEffect, useState } from "react";
import { Alert, View } from "react-native";
import { Screen, T } from "../../components/Themed";
import { ThemedInput } from "../../components/ThemedInput";
import { ThemedButton } from "../../components/ThemedButton";
import { DateField } from "../../components/DateField";
import { useAuth } from "../../contexts/AuthContext";
import type { Role } from "../../models/auth";
import { isValidCPF } from "../../models/validators";

const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Administrador",
  GESTOR: "Gestor",
  SUPERVISOR: "Supervisor",
  AVALIADOR: "Avaliador / Pesquisador",
};

export function SettingsScreen({ navigation }: any) {
  const { user, update, logout } = useAuth();

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
      if (!name.trim()) throw new Error("Nome é obrigatório.");
      if (!email.trim()) throw new Error("E-mail é obrigatório.");
      if (cpf.trim() && !isValidCPF(cpf)) throw new Error("CPF inválido.");

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

      Alert.alert("Ok", "Dados atualizados.");
      navigation.goBack();
    } catch (e: any) {
      Alert.alert("Erro", e.message ?? "Falha ao salvar");
    }
  };

  const onLogout = async () => {
    try {
      await logout();
    } catch (e: any) {
      Alert.alert("Erro", e.message ?? "Falha ao sair");
    }
  };

  return (
    <Screen>
      <T style={{ fontSize: 22, fontWeight: "900", marginTop: 18 }}>Configurações</T>
      <View style={{ height: 8 }} />
      <T style={{ opacity: 0.7 }}>
        Perfil: {user?.role ? ROLE_LABEL[user.role] : "-"}
      </T>

      <View style={{ height: 14 }} />

      <ThemedInput label="Nome" value={name} onChangeText={setName} />
      <DateField label="Data de nascimento" value={dob} onChange={setDob} />
      <ThemedInput label="CPF" value={cpf} onChangeText={setCpf} />
      <ThemedInput
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <T style={{ marginTop: 10, fontWeight: "900" }}>Trocar senha (opcional)</T>
      <View style={{ height: 8 }} />
      <ThemedInput
        label="Senha atual"
        value={currentPw}
        onChangeText={setCurrentPw}
        secureTextEntry
      />
      <ThemedInput
        label="Nova senha"
        value={newPw}
        onChangeText={setNewPw}
        secureTextEntry
      />

      <View style={{ height: 8 }} />
      <ThemedButton title="Salvar" onPress={onSave} />
      <View style={{ height: 12 }} />
      <ThemedButton title="Sair" onPress={onLogout} />
      <View style={{ height: 12 }} />
      <ThemedButton title="Voltar" variant="secondary" onPress={() => navigation.goBack()} />
    </Screen>
  );
}