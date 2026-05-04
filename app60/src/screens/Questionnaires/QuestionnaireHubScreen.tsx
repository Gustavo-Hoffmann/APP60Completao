import React from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Screen, T } from "../../components/Themed";
import { ThemedButton } from "../../components/ThemedButton";
import { Routes } from "../../navigation/routes";
import { useAuth } from "../../contexts/AuthContext";
import { getGuestParticipant } from "../../services/participants";

export function QuestionnaireHubScreen({ navigation }: any) {
  const { isGuest } = useAuth();
  const { t } = useTranslation(["questionnaires", "common"]);

  const openIvcf20 = () => {
    if (isGuest) {
      const guestParticipant = getGuestParticipant();
      navigation.navigate(Routes.IVCF20, {
        participant: guestParticipant,
        participantId: guestParticipant.id,
        testKey: "ivcf20",
      });
      return;
    }

    navigation.navigate(Routes.ParticipantPick, {
      nextRoute: Routes.IVCF20,
      testTitle: t("questionnaires:hub.openIvcf20"),
      testKey: "ivcf20",
    });
  };

  const openActivitySedentary = () => {
    if (isGuest) {
      const guestParticipant = getGuestParticipant();
      navigation.navigate(Routes.PhysicalActivitySedentary, {
        participant: guestParticipant,
        participantId: guestParticipant.id,
        testKey: "activity_sedentary",
      });
      return;
    }

    navigation.navigate(Routes.ParticipantPick, {
      nextRoute: Routes.PhysicalActivitySedentary,
      testTitle: t("questionnaires:hub.openActivitySedentary"),
      testKey: "activity_sedentary",
    });
  };

  const openFesI = () => {
    if (isGuest) {
      const guestParticipant = getGuestParticipant();
      navigation.navigate(Routes.FESI, {
        participant: guestParticipant,
        participantId: guestParticipant.id,
        testKey: "fesi",
      });
      return;
    }

    navigation.navigate(Routes.ParticipantPick, {
      nextRoute: Routes.FESI,
      testTitle: t("questionnaires:hub.openFesI"),
      testKey: "fesi",
    });
  };

  return (
    <Screen>
      <T style={{ fontSize: 22, fontWeight: "900", marginTop: 18 }}>
        {t("questionnaires:hub.title")}
      </T>

      <View style={{ height: 14 }} />

      <ThemedButton title={t("questionnaires:hub.openIvcf20")} onPress={openIvcf20} />

      <View style={{ height: 12 }} />

      <ThemedButton title={t("questionnaires:hub.openFesI")} onPress={openFesI} />

      <View style={{ height: 12 }} />

      <ThemedButton
        title={t("questionnaires:hub.openActivitySedentary")}
        onPress={openActivitySedentary}
      />

      <View style={{ height: 12 }} />

      <ThemedButton
        title={t("common:actions.back")}
        variant="secondary"
        onPress={() => navigation.goBack()}
      />
    </Screen>
  );
}
