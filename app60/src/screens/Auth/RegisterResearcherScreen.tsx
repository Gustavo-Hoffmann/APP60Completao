import React, { useState } from "react";
import { Alert, View } from "react-native";
import { Screen, T } from "../../components/Themed";
import { ThemedInput } from "../../components/ThemedInput";
import { ThemedButton } from "../../components/ThemedButton";
import { DateField } from "../../components/DateField";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { MaskedTextInput } from "react-native-mask-text";
import { isValidCPF } from "../../models/validators";

export function RegisterResearcherScreen({ navigation }: any) {
  const { register } = useAuth();
  const { theme } = useTheme();

  const [name, setName] = useState("");
  const [dob, setDob] = useState<Date | null>(null);
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");

  const onCreate = async () => {
    try {
      if (!name.trim()) throw new Error("Informe o nome.");
      if (!email.trim()) throw new Error("Informe o e-mail.");
      if (!isValidCPF(cpf)) throw new Error("CPF inválido.");
      if (pw.length < 6) throw new Error("Senha muito curta (mínimo 6).");
      if (pw !== pw2) throw new Error("As senhas não conferem.");

      if (!dob) throw new Error("Informe a data de nascimento.");

      await register(
        { name: name.trim(), dob: dob.toISOString(), cpf, email: email.trim() },
        pw
      );
    } catch (e: any) {
      Alert.alert("Cadastro", e.message ?? "Erro ao cadastrar");
    }
  };

  return (
    <Screen>
      <T style={{ fontSize: 24, fontWeight: "900", marginTop: 18 }}>Criar pesquisador</T>

      <View style={{ height: 14 }} />

      <ThemedInput label="Nome" value={name} onChangeText={setName} placeholder="Seu nome" />
      <DateField label="Data de nascimento" value={dob} onChange={setDob} />

      <View style={{ marginBottom: 12 }}>
        <T style={{ color: theme.colors.muted, marginBottom: 6, fontWeight: "700" }}>CPF</T>
        <MaskedTextInput
          mask="999.999.999-99"
          value={cpf}
          onChangeText={(text) => setCpf(text)}
          keyboardType="numeric"
          placeholder="000.000.000-00"
          placeholderTextColor={theme.colors.muted}
          style={{
            backgroundColor: theme.colors.card,
            color: theme.colors.text,
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 12,
            borderWidth: 1,
            borderColor: theme.colors.border,
          }}
        />
      </View>

      <ThemedInput label="E-mail" value={email} onChangeText={setEmail} placeholder="email@..." />

      <ThemedInput label="Senha" value={pw} onChangeText={setPw} secureTextEntry />
      <ThemedInput label="Confirmar senha" value={pw2} onChangeText={setPw2} secureTextEntry />

      <ThemedButton title="Criar perfil" onPress={onCreate} />
      <View style={{ height: 12 }} />
      <ThemedButton title="Voltar" variant="secondary" onPress={() => navigation.goBack()} />
    </Screen>
  );
}