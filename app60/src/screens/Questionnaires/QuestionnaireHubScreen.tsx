import React from "react";
import { View } from "react-native";
import { Screen, T } from "../../components/Themed";
import { ThemedButton } from "../../components/ThemedButton";
import { Routes } from "../../navigation/routes";

export function QuestionnaireHubScreen({ navigation }: any) {
  return (
    <Screen>
      <T style={{ fontSize: 22, fontWeight: "900", marginTop: 18 }}>Questionários</T>

      <View style={{ height: 14 }} />

      <ThemedButton
        title="IVCF-20"
        onPress={() =>
          navigation.navigate(Routes.ParticipantPick, {
            nextRoute: Routes.IVCF20,
            testTitle: "IVCF-20",
            testKey: "ivcf20",
          })
        }
      />

      <View style={{ height: 12 }} />

      <ThemedButton title="Voltar" variant="secondary" onPress={() => navigation.goBack()} />
    </Screen>
  );
}