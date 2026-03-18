import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";

import { Screen, T } from "../../components/Themed";
import { ThemedInput } from "../../components/ThemedInput";
import { ThemedButton } from "../../components/ThemedButton";
import { DateField } from "../../components/DateField";

import type { BiologicalSex, Participant } from "../../models/types";
import { normalizeDigits } from "../../models/utils";
import { isValidCPF } from "../../models/validators";
import { fetchViaCep } from "../../services/viacep";
import { upsertParticipant } from "../../services/participants";
import { useTheme } from "../../contexts/ThemeContext";

type Params = {
  mode?: "create" | "edit";
  participant?: Participant;
};

function formatCPF(raw: string) {
  const d = normalizeDigits(raw).slice(0, 11);
  const a = d.slice(0, 3);
  const b = d.slice(3, 6);
  const c = d.slice(6, 9);
  const e = d.slice(9, 11);

  if (d.length <= 3) return a;
  if (d.length <= 6) return `${a}.${b}`;
  if (d.length <= 9) return `${a}.${b}.${c}`;
  return `${a}.${b}.${c}-${e}`;
}

function formatCEP(raw: string) {
  const d = normalizeDigits(raw).slice(0, 8);
  const a = d.slice(0, 5);
  const b = d.slice(5, 8);
  if (d.length <= 5) return a;
  return `${a}-${b}`;
}

const kbNumeric = Platform.OS === "ios" ? "numbers-and-punctuation" : "numeric";

function SexOption({
  label,
  value,
  selected,
  onPress,
}: {
  label: string;
  value: BiologicalSex;
  selected: boolean;
  onPress: (value: BiologicalSex) => void;
}) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={() => onPress(value)}
      style={({ pressed }) => ({
        flex: 1,
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: selected ? theme.colors.primary : theme.colors.border,
        backgroundColor: selected ? theme.colors.primary : theme.colors.card,
        opacity: pressed ? 0.88 : 1,
        alignItems: "center",
        justifyContent: "center",
      })}
    >
      <T
        style={{
          fontWeight: "900",
          color: selected ? "#fff" : theme.colors.text,
        }}
      >
        {label}
      </T>
    </Pressable>
  );
}

export function ParticipantFormScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { theme } = useTheme();
  const { mode = "create", participant } = (route.params ?? {}) as Params;

  const isEdit = mode === "edit";

  const cpfRef = useRef<TextInput>(null);
  const cepRef = useRef<TextInput>(null);
  const streetRef = useRef<TextInput>(null);
  const numberRef = useRef<TextInput>(null);
  const complementRef = useRef<TextInput>(null);
  const neighRef = useRef<TextInput>(null);
  const cityRef = useRef<TextInput>(null);
  const ufRef = useRef<TextInput>(null);

  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [dob, setDob] = useState<Date>(new Date("2000-01-01"));
  const [biologicalSex, setBiologicalSex] = useState<BiologicalSex | undefined>(undefined);

  const [cep, setCep] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [uf, setUf] = useState("");

  const [loadingCep, setLoadingCep] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!participant) return;

    setName(participant.name ?? "");
    setCpf(formatCPF(participant.cpf ?? ""));
    setDob(new Date(participant.dob ?? "2000-01-01"));
    setBiologicalSex(participant.biologicalSex);

    setCep(formatCEP(participant.cep ?? ""));
    setStreet(participant.address?.street ?? "");
    setNumber(participant.address?.number ?? "");
    setComplement(participant.address?.complement ?? "");
    setNeighborhood(participant.address?.neighborhood ?? "");
    setCity(participant.address?.city ?? "");
    setUf(participant.address?.uf ?? "");
  }, [participant]);

  const onFetchCep = async () => {
    try {
      const digits = normalizeDigits(cep);
      if (digits.length !== 8) {
        Alert.alert("CEP", "CEP inválido (8 dígitos).");
        return;
      }

      setLoadingCep(true);
      const data = await fetchViaCep(digits);

      setStreet(data.street ?? "");
      setNeighborhood(data.neighborhood ?? "");
      setCity(data.city ?? "");
      setUf(data.uf ?? "");

      setTimeout(() => numberRef.current?.focus(), 200);
    } catch (e: any) {
      Alert.alert("CEP", e?.message ?? "Falha ao buscar CEP");
    } finally {
      setLoadingCep(false);
    }
  };

  const validate = () => {
    if (!name.trim()) return "Nome é obrigatório.";
    if (!isValidCPF(normalizeDigits(cpf))) return "CPF inválido.";
    if (!biologicalSex) return "Selecione o sexo biológico.";

    const cepDigits = normalizeDigits(cep);
    if (cepDigits.length === 8 && !number.trim()) return "Número da casa é obrigatório.";

    return null;
  };

  const onSave = async () => {
    try {
      const err = validate();
      if (err) {
        Alert.alert("Salvar", err);
        return;
      }

      setSaving(true);

      const payload: Participant = {
        id: participant?.id,
        name: name.trim(),
        cpf: normalizeDigits(cpf),
        dob: dob.toISOString().slice(0, 10),
        biologicalSex,
        cep: normalizeDigits(cep) || undefined,
        address: {
          street: street.trim() || undefined,
          neighborhood: neighborhood.trim() || undefined,
          city: city.trim() || undefined,
          uf: uf.trim() || undefined,
          ...(number.trim() ? { number: number.trim() } : {}),
          ...(complement.trim() ? { complement: complement.trim() } : {}),
        },
        createdAt: participant?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await upsertParticipant(payload);

      Alert.alert("Salvo", "Participante salvo com sucesso.");
      nav.goBack();
    } catch (e: any) {
      Alert.alert("Salvar", e?.message ?? "Falha ao salvar participante.");
    } finally {
      setSaving(false);
    }
  };

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
          <T style={{ fontSize: 20, fontWeight: "900" }}>
            {isEdit ? "Editar participante" : "Cadastrar participante"}
          </T>

          <View style={{ height: 14 }} />

          <ThemedInput
            label="Nome"
            value={name}
            onChangeText={setName}
            placeholder="Nome completo"
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => cpfRef.current?.focus()}
            textContentType="name"
          />

          <ThemedInput
            ref={cpfRef}
            label="CPF"
            value={cpf}
            onChangeText={(t) => setCpf(formatCPF(t))}
            placeholder="000.000.000-00"
            keyboardType={kbNumeric}
            inputMode="numeric"
            maxLength={14}
            returnKeyType="next"
            onSubmitEditing={() => {
              Keyboard.dismiss();
              setTimeout(() => cepRef.current?.focus(), 150);
            }}
          />

          <DateField label="Data de nascimento" value={dob} onChange={setDob} />

          <View style={{ height: 14 }} />

          <T style={{ fontWeight: "900", marginBottom: 8 }}>Sexo biológico</T>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <SexOption
              label="Masculino"
              value="Masculino"
              selected={biologicalSex === "Masculino"}
              onPress={setBiologicalSex}
            />
            <SexOption
              label="Feminino"
              value="Feminino"
              selected={biologicalSex === "Feminino"}
              onPress={setBiologicalSex}
            />
          </View>

          <View style={{ height: 16 }} />

          <ThemedInput
            ref={cepRef}
            label="CEP"
            value={cep}
            onChangeText={(t) => setCep(formatCEP(t))}
            placeholder="00000-000"
            keyboardType={kbNumeric}
            inputMode="numeric"
            maxLength={9}
            returnKeyType="go"
            onSubmitEditing={onFetchCep}
          />

          <ThemedButton
            title={loadingCep ? "Buscando CEP..." : "Buscar CEP"}
            variant="secondary"
            onPress={onFetchCep}
            disabled={loadingCep}
            style={{ paddingVertical: 12, borderRadius: 10 }}
          />

          <View style={{ height: 12 }} />

          <ThemedInput
            ref={streetRef}
            label="Rua"
            value={street}
            onChangeText={setStreet}
            placeholder="Logradouro"
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => numberRef.current?.focus()}
          />

          <ThemedInput
            ref={numberRef}
            label="Número"
            value={number}
            onChangeText={(t) => setNumber(normalizeDigits(t).slice(0, 8))}
            placeholder="Número da casa"
            keyboardType={kbNumeric}
            inputMode="numeric"
            maxLength={8}
            returnKeyType="next"
            onSubmitEditing={() => complementRef.current?.focus()}
          />

          <ThemedInput
            ref={complementRef}
            label="Complemento"
            value={complement}
            onChangeText={setComplement}
            placeholder="Apto, bloco, casa fundos..."
            autoCapitalize="sentences"
            returnKeyType="next"
            onSubmitEditing={() => neighRef.current?.focus()}
          />

          <ThemedInput
            ref={neighRef}
            label="Bairro"
            value={neighborhood}
            onChangeText={setNeighborhood}
            placeholder="Bairro"
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => cityRef.current?.focus()}
          />

          <ThemedInput
            ref={cityRef}
            label="Cidade"
            value={city}
            onChangeText={setCity}
            placeholder="Cidade"
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => ufRef.current?.focus()}
          />

          <ThemedInput
            ref={ufRef}
            label="UF"
            value={uf}
            onChangeText={(t) => setUf(t.toUpperCase().slice(0, 2))}
            placeholder="UF"
            autoCapitalize="characters"
            maxLength={2}
            returnKeyType="done"
            onSubmitEditing={() => Keyboard.dismiss()}
          />

          <View style={{ height: 10 }} />

          <ThemedButton
            title={saving ? "Salvando..." : "Salvar"}
            onPress={onSave}
            disabled={saving}
            style={{ paddingVertical: 12, borderRadius: 10 }}
          />

          <View style={{ height: 12 }} />
          <T style={{ color: theme.colors.muted, fontSize: 12 }}>
            Sexo biológico será usado nas análises normativas dos testes funcionais.
          </T>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}