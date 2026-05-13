import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";

import { Screen, T } from "../../components/Themed";
import { ThemedInput } from "../../components/ThemedInput";
import { ThemedButton } from "../../components/ThemedButton";
import { DateOfBirthInput } from "../../components/DateOfBirthInput";
import { formatApiDate, isValidDob, parseApiDate } from "../../lib/dateOfBirth";

import type { AuthUser } from "../../models/auth";
import type { BiologicalSex, Participant } from "../../models/types";
import { normalizeDigits } from "../../models/utils";
import { isValidCPF } from "../../models/validators";
import { fetchViaCep } from "../../services/viacep";
import { upsertParticipant } from "../../services/participants";
import { getCurrentResearcher } from "../../services/authLocal";
import { listInstitutions, type InstitutionLite } from "../../services/institutions";
import { useTheme } from "../../contexts/ThemeContext";
import { getCountryOptions, countryLabel, type CountryOption } from "../../lib/isoCountries";

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
  const { t, i18n } = useTranslation(["participants", "common"]);
  const { mode = "create", participant } = (route.params ?? {}) as Params;

  const isEdit = mode === "edit";

  const identityRef = useRef<TextInput>(null);
  const cepRef = useRef<TextInput>(null);
  const streetRef = useRef<TextInput>(null);
  const numberRef = useRef<TextInput>(null);
  const complementRef = useRef<TextInput>(null);
  const neighRef = useRef<TextInput>(null);
  const cityRef = useRef<TextInput>(null);
  const ufRef = useRef<TextInput>(null);

  const [name, setName] = useState("");
  const [nationality, setNationality] = useState("BR");
  const [identity, setIdentity] = useState("");
  const [dob, setDob] = useState<Date | null>(null);
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
  const [dobTextValid, setDobTextValid] = useState(true);
  const [nationalityModalOpen, setNationalityModalOpen] = useState(false);

  const [me, setMe] = useState<AuthUser | null>(null);
  const [institutions, setInstitutions] = useState<InstitutionLite[]>([]);
  const [institutionModalOpen, setInstitutionModalOpen] = useState(false);
  const [selectedInstitutionId, setSelectedInstitutionId] = useState<string | null>(null);
  const [confirmLinkExisting, setConfirmLinkExisting] = useState(false);

  const nat = nationality.trim().toUpperCase();
  const isBr = nat === "BR";

  const picksInstitutionOnCreate = me?.role === "SUPER_ADMIN" || me?.role === "ADMIN";
  const selectedInstitution = institutions.find((x) => x.id === selectedInstitutionId) ?? null;
  const selectedInstitutionLabel = selectedInstitution
    ? `${selectedInstitution.name}${selectedInstitution.unit ? ` — ${selectedInstitution.unit}` : ""}`
    : t("participants:form.institutionPlaceholder", "Selecione a instituição");

  const countryOptions = React.useMemo((): CountryOption[] => {
    const lang = i18n.language ?? "pt-BR";
    const opts = getCountryOptions(lang);
    if (opts.some((o) => o.code === nat)) return opts;
    return [{ code: nat, label: countryLabel(lang, nat) }, ...opts];
  }, [i18n.language, nat]);

  const nationalityDisplay = React.useMemo(
    () => countryLabel(i18n.language ?? "pt-BR", nat),
    [i18n.language, nat],
  );

  useEffect(() => {
    if (!participant) return;

    setName(participant.name ?? "");
    const pNat = String(participant.nationality ?? "BR")
      .trim()
      .toUpperCase();
    setNationality(pNat);
    setIdentity(pNat === "BR" ? formatCPF(participant.cpf ?? "") : String(participant.cpf ?? ""));
    setDob(participant.dob ? parseApiDate(participant.dob) : null);
    setBiologicalSex(participant.biologicalSex);

    setCep(pNat === "BR" ? formatCEP(participant.cep ?? "") : String(participant.cep ?? ""));
    setStreet(participant.address?.street ?? "");
    setNumber(participant.address?.number ?? "");
    setComplement(participant.address?.complement ?? "");
    setNeighborhood(participant.address?.neighborhood ?? "");
    setCity(participant.address?.city ?? "");
    setUf(participant.address?.uf ?? "");
  }, [participant]);

  useEffect(() => {
    let active = true;
    (async () => {
      const u = await getCurrentResearcher();
      if (!active) return;
      setMe(u);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!picksInstitutionOnCreate || isEdit) return;
    let active = true;
    (async () => {
      try {
        const list = await listInstitutions();
        if (!active) return;
        setInstitutions(list);
        if (!selectedInstitutionId && list.length) setSelectedInstitutionId(list[0].id);
      } catch {
        // Silencioso: se falhar, o usuário ainda pode salvar se não for obrigatório (mas para superadmin é).
      }
    })();
    return () => {
      active = false;
    };
  }, [picksInstitutionOnCreate, isEdit, selectedInstitutionId]);

  const onFetchCep = async () => {
    if (!isBr) return;
    try {
      const digits = normalizeDigits(cep);
      if (digits.length !== 8) {
        Alert.alert(t("participants:form.alerts.cepTitle"), t("participants:form.validation.invalidCep"));
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
      Alert.alert(
        t("participants:form.alerts.cepTitle"),
        e?.message ?? t("participants:form.alerts.cepLookupError")
      );
    } finally {
      setLoadingCep(false);
    }
  };

  const validate = () => {
    if (!name.trim()) return t("participants:form.validation.nameRequired");
    if (!/^[A-Z]{2}$/.test(nat)) return t("participants:form.validation.nationalityInvalid");
    if (isBr) {
      if (!isValidCPF(normalizeDigits(identity))) return t("participants:form.validation.cpfInvalid");
    } else {
      const doc = identity.normalize("NFKC").trim();
      if (doc.length < 3) return t("participants:form.validation.identityInvalid");
    }
    if (!biologicalSex) return t("participants:form.validation.sexRequired");

    const cepDigits = normalizeDigits(cep);
    if (isBr && cepDigits.length === 8 && !number.trim()) {
      return t("participants:form.validation.houseNumberRequired");
    }

    return null;
  };

  const formError = validate();
  const dobReady = !!dob && isValidDob(dob) && dobTextValid;
  const canSave = !formError && dobReady && !(picksInstitutionOnCreate && !isEdit && !selectedInstitutionId);

  const onSave = async () => {
    try {
      const err = validate();
      if (err) {
        Alert.alert(t("participants:form.alerts.saveTitle"), err);
        return;
      }

      if (!dob || !isValidDob(dob)) {
        Alert.alert(
          t("participants:form.alerts.saveTitle"),
          t("participants:form.validation.birthDateInvalid", "Informe uma data de nascimento válida.")
        );
        return;
      }

      if (picksInstitutionOnCreate && !isEdit && !selectedInstitutionId) {
        Alert.alert(
          t("participants:form.alerts.saveTitle"),
          t("participants:form.validation.institutionRequired", "Selecione a instituição.")
        );
        return;
      }

      setSaving(true);

      const payload: Participant = {
        id: participant?.id,
        name: name.trim(),
        nationality: nat,
        cpf: isBr ? normalizeDigits(identity) : identity.normalize("NFKC").trim(),
        dob: formatApiDate(dob),
        biologicalSex,
        cep: (isBr ? normalizeDigits(cep) : cep.trim()) || undefined,
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

      // Campos extras usados pelo backend (sem mudar o type global)
      const extra = payload as Participant & {
        institutionId?: string;
        confirmLinkExisting?: boolean;
      };
      if (picksInstitutionOnCreate && !isEdit && selectedInstitutionId) extra.institutionId = selectedInstitutionId;
      if (confirmLinkExisting) extra.confirmLinkExisting = true;

      await upsertParticipant(extra);

      Alert.alert(t("participants:form.alerts.savedTitle"), t("participants:form.alerts.savedMessage"));
      nav.goBack();
    } catch (e: any) {
      // Conflito: CPF/identidade já existe em outra instituição.
      if (e?.code === "PARTICIPANT_EXISTS_OTHER_INSTITUTION" && e?.details) {
        const details = e.details as any;
        const inst = details.existingInstitution;
        const instLabel =
          inst?.name
            ? `${inst.name}${inst.unit ? ` — ${inst.unit}` : ""}`
            : t("participants:form.conflict.otherInstitution", "outra instituição");

        Alert.alert(
          t("participants:form.alerts.saveTitle"),
          t(
            "participants:form.conflict.message",
            `Participante já cadastrado em "${instLabel}". Deseja puxar os dados do participante?`
          ),
          [
            { text: t("common:actions.cancel", "Cancelar"), style: "cancel" },
            {
              text: t("participants:form.conflict.pull", "Puxar dados"),
              style: "default",
              onPress: () => {
                const p = details.participant;
                if (p) {
                  setName(p.full_name ?? "");
                  const pNat = String(p.nationality ?? "BR").trim().toUpperCase();
                  setNationality(pNat);
                  setIdentity(pNat === "BR" ? formatCPF(p.cpf_normalized ?? "") : String(p.cpf_normalized ?? ""));
                  setDob(p.birth_date ? parseApiDate(p.birth_date) : null);
                  setBiologicalSex(
                    p.sex === "M" || p.sex === "Masculino"
                      ? "Masculino"
                      : p.sex === "F" || p.sex === "Feminino"
                        ? "Feminino"
                        : undefined
                  );
                  setCep(pNat === "BR" ? formatCEP(p.cep ?? "") : String(p.cep ?? ""));
                  setStreet(p.street ?? "");
                  setNumber(p.number ?? "");
                  setComplement(p.complement ?? "");
                  setNeighborhood(p.neighborhood ?? "");
                  setCity(p.city ?? "");
                  setUf(p.state ?? "");
                }
                // Após confirmar, o próximo "Salvar" vai vincular este participante à instituição escolhida/atual.
                setConfirmLinkExisting(true);
              },
            },
          ]
        );
        return;
      }

      Alert.alert(
        t("participants:form.alerts.saveTitle"),
        e?.message ?? t("participants:form.alerts.saveError")
      );
    } finally {
      setSaving(false);
    }
  };

  const saveBarHeight = 72;

  return (
    <Screen>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{
          paddingBottom: saveBarHeight + 16,
        }}
      >
          <T style={{ fontSize: 20, fontWeight: "900" }}>
            {isEdit ? t("participants:form.editTitle") : t("participants:form.createTitle")}
          </T>

          <View style={{ height: 14 }} />

          {picksInstitutionOnCreate && !isEdit ? (
            <View style={{ marginBottom: 12 }}>
              <T style={{ fontWeight: "800", marginBottom: 8, color: theme.colors.text }}>
                {t("participants:form.fields.institution", "Instituição")}
              </T>
              <Pressable
                onPress={() => setInstitutionModalOpen(true)}
                style={({ pressed }) => ({
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.card,
                  borderRadius: 12,
                  paddingVertical: 14,
                  paddingHorizontal: 12,
                  opacity: pressed ? 0.88 : 1,
                })}
              >
                <T style={{ fontWeight: "700", color: theme.colors.text }}>{selectedInstitutionLabel}</T>
                <T style={{ marginTop: 6, fontSize: 12, color: theme.colors.muted }}>
                  {t("participants:form.institutionHint", "Escolha a instituição para cadastrar o participante.")}
                </T>
              </Pressable>
            </View>
          ) : null}

          <ThemedInput
            label={t("common:labels.name")}
            value={name}
            onChangeText={setName}
            placeholder={t("participants:form.namePlaceholder")}
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => Keyboard.dismiss()}
            textContentType="name"
          />

          <DateOfBirthInput
            label={t("common:labels.birthDate")}
            value={dob}
            onChange={setDob}
            invalidMessage={t(
              "participants:form.validation.birthDateInvalid",
              "Informe uma data de nascimento válida."
            )}
            onValidityChange={setDobTextValid}
          />

          <View style={{ marginBottom: 12 }}>
            <T style={{ fontWeight: "800", marginBottom: 8, color: theme.colors.text }}>
              {t("participants:form.fields.nationality")}
            </T>
            <Pressable
              onPress={() => setNationalityModalOpen(true)}
              style={({ pressed }) => ({
                borderWidth: 1,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.card,
                borderRadius: 12,
                paddingVertical: 14,
                paddingHorizontal: 12,
                opacity: pressed ? 0.88 : 1,
              })}
            >
              <T style={{ fontWeight: "700", color: theme.colors.text }}>{nationalityDisplay}</T>
              <T style={{ marginTop: 6, fontSize: 12, color: theme.colors.muted }}>
                {t("participants:form.nationalityHint")}
              </T>
            </Pressable>
          </View>

          <ThemedInput
            ref={identityRef}
            label={isBr ? t("common:labels.cpf") : t("participants:form.fields.identity")}
            value={identity}
            onChangeText={(v) => setIdentity(isBr ? formatCPF(v) : v)}
            placeholder={
              isBr
                ? t("participants:form.fields.identityPlaceholderBr")
                : t("participants:form.fields.identityPlaceholderIntl")
            }
            keyboardType={isBr ? kbNumeric : "default"}
            inputMode={isBr ? "numeric" : "text"}
            maxLength={isBr ? 14 : 80}
            returnKeyType="next"
            onSubmitEditing={() => {
              Keyboard.dismiss();
              setTimeout(() => cepRef.current?.focus(), 150);
            }}
          />

          <View style={{ height: 14 }} />

          <T style={{ fontWeight: "900", marginBottom: 8 }}>{t("common:labels.sexBiological")}</T>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <SexOption
              label={t("participants:form.sex.male")}
              value="Masculino"
              selected={biologicalSex === "Masculino"}
              onPress={setBiologicalSex}
            />
            <SexOption
              label={t("participants:form.sex.female")}
              value="Feminino"
              selected={biologicalSex === "Feminino"}
              onPress={setBiologicalSex}
            />
          </View>

          <View style={{ height: 16 }} />

          <ThemedInput
            ref={cepRef}
            label={isBr ? t("participants:form.fields.cep") : t("participants:form.fields.postalCode")}
            value={cep}
            onChangeText={(v) => setCep(isBr ? formatCEP(v) : v)}
            placeholder={isBr ? t("participants:form.fields.cepPlaceholder") : undefined}
            keyboardType={isBr ? kbNumeric : "default"}
            inputMode={isBr ? "numeric" : "text"}
            maxLength={isBr ? 9 : 32}
            returnKeyType="go"
            onSubmitEditing={isBr ? onFetchCep : () => streetRef.current?.focus()}
          />

          {isBr ? (
            <ThemedButton
              title={loadingCep ? t("participants:form.cepSearching") : t("participants:form.cepSearch")}
              variant="secondary"
              onPress={onFetchCep}
              disabled={loadingCep}
              style={{ paddingVertical: 12, borderRadius: 10 }}
            />
          ) : null}

          <View style={{ height: 12 }} />

          <ThemedInput
            ref={streetRef}
            label={t("participants:form.fields.street")}
            value={street}
            onChangeText={setStreet}
            placeholder={t("participants:form.fields.streetPlaceholder")}
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => numberRef.current?.focus()}
          />

          <ThemedInput
            ref={numberRef}
            label={t("participants:form.fields.number")}
            value={number}
            onChangeText={(t) => setNumber(normalizeDigits(t).slice(0, 8))}
            placeholder={t("participants:form.fields.numberPlaceholder")}
            keyboardType={kbNumeric}
            inputMode="numeric"
            maxLength={8}
            returnKeyType="next"
            onSubmitEditing={() => complementRef.current?.focus()}
          />

          <ThemedInput
            ref={complementRef}
            label={t("participants:form.fields.complement")}
            value={complement}
            onChangeText={setComplement}
            placeholder={t("participants:form.fields.complementPlaceholder")}
            autoCapitalize="sentences"
            returnKeyType="next"
            onSubmitEditing={() => neighRef.current?.focus()}
          />

          <ThemedInput
            ref={neighRef}
            label={t("participants:form.fields.neighborhood")}
            value={neighborhood}
            onChangeText={setNeighborhood}
            placeholder={t("participants:form.fields.neighborhood")}
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => cityRef.current?.focus()}
          />

          <ThemedInput
            ref={cityRef}
            label={t("participants:form.fields.city")}
            value={city}
            onChangeText={setCity}
            placeholder={t("participants:form.fields.city")}
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => ufRef.current?.focus()}
          />

          <ThemedInput
            ref={ufRef}
            label={t("participants:form.fields.uf")}
            value={uf}
            onChangeText={(t) => setUf(t.toUpperCase().slice(0, 2))}
            placeholder={t("participants:form.fields.uf")}
            autoCapitalize="characters"
            maxLength={2}
            returnKeyType="done"
            onSubmitEditing={() => Keyboard.dismiss()}
          />

          <View style={{ height: 10 }} />
          <T style={{ color: theme.colors.muted, fontSize: 12 }}>
            {t("participants:form.sexHint")}
          </T>
      </ScrollView>

      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingTop: 8,
          paddingBottom: Platform.OS === "ios" ? 12 : 8,
          paddingHorizontal: 16,
          backgroundColor: theme.colors.bg,
        }}
      >
        <ThemedButton
          title={saving ? t("participants:form.saving") : t("participants:form.save")}
          onPress={onSave}
          variant={canSave ? "primary" : "inactive"}
          disabled={saving || !canSave}
          style={{ paddingVertical: 12, borderRadius: 10 }}
        />
      </View>

      <Modal
        visible={nationalityModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setNationalityModalOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderBottomColor: theme.colors.border,
            }}
          >
            <T style={{ fontSize: 18, fontWeight: "900", color: theme.colors.text }}>
              {t("participants:form.nationalityModalTitle")}
            </T>
            <Pressable onPress={() => setNationalityModalOpen(false)} hitSlop={12}>
              <T style={{ fontWeight: "800", color: theme.colors.primary }}>{t("participants:form.nationalityClose")}</T>
            </Pressable>
          </View>

          <FlatList
            data={countryOptions}
            keyExtractor={(item) => item.code}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 24 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  setNationality(item.code);
                  setNationalityModalOpen(false);
                }}
                style={({ pressed }) => ({
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.colors.border,
                  backgroundColor: pressed ? theme.colors.card : theme.colors.bg,
                })}
              >
                <T style={{ fontWeight: "700", color: theme.colors.text }}>{item.label}</T>
              </Pressable>
            )}
          />
        </View>
      </Modal>

      <Modal
        visible={institutionModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setInstitutionModalOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderBottomColor: theme.colors.border,
            }}
          >
            <T style={{ fontSize: 18, fontWeight: "900", color: theme.colors.text }}>
              {t("participants:form.institutionModalTitle", "Selecionar instituição")}
            </T>
            <Pressable onPress={() => setInstitutionModalOpen(false)} hitSlop={12}>
              <T style={{ fontWeight: "800", color: theme.colors.primary }}>
                {t("participants:form.institutionClose", "Fechar")}
              </T>
            </Pressable>
          </View>

          <FlatList
            data={institutions}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 24 }}
            renderItem={({ item }) => {
              const label = `${item.name}${item.unit ? ` — ${item.unit}` : ""}`;
              const selected = item.id === selectedInstitutionId;
              return (
                <Pressable
                  onPress={() => {
                    setSelectedInstitutionId(item.id);
                    setInstitutionModalOpen(false);
                  }}
                  style={({ pressed }) => ({
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.colors.border,
                    backgroundColor: selected
                      ? theme.colors.card
                      : pressed
                        ? theme.colors.card
                        : theme.colors.bg,
                  })}
                >
                  <T style={{ fontWeight: "700", color: theme.colors.text }}>{label}</T>
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <View style={{ padding: 16 }}>
                <T style={{ color: theme.colors.muted }}>
                  {t("participants:form.institutionEmpty", "Nenhuma instituição disponível.")}
                </T>
              </View>
            }
          />
        </View>
      </Modal>
    </Screen>
  );
}