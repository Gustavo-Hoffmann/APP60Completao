import React from "react";
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
  Theme as NavigationTheme,
} from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { useTranslation } from "react-i18next";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { Routes } from "./routes";

import { LoginScreen } from "../screens/Auth/LoginScreen";

import { HomeScreen } from "../screens/Home/HomeScreen";
import { SettingsScreen } from "../screens/Home/SettingsScreen";

import { QuestionnaireHubScreen } from "../screens/Questionnaires/QuestionnaireHubScreen";
import { IVCF20Screen } from "../screens/Questionnaires/IVCF20Screen";
import { IVCF20ResultScreen } from "../screens/Questionnaires/IVCF20ResultScreen";

import { ParticipantFormScreen } from "../screens/Participants/ParticipantFormScreen";
import ParticipantPickScreen from "../screens/Participants/ParticipantPickScreen";

import SentarLevantar from "../features/tests/sentar-levantar";
import SentarLevantarResultScreen from "../features/tests/sentar-levantar/ResultScreen";
import ElevacaoCalcanhares from "../features/tests/elevacao-calcanhares";
import ElevacaoCalcanharesResultScreen from "../features/tests/elevacao-calcanhares/ResultScreen";
import LimiteEstabilidade from "../features/tests/limite-estabilidade";
import LimiteEstabilidadeResultScreen from "../features/tests/limite-estabilidade/ResultScreen";
import MarchaEstacionaria from "../features/tests/marcha-estacionaria";
import MarchaEstacionariaResultScreen from "../features/tests/marcha-estacionaria/ResultScreen";
import TUG from "../features/tests/tug";
import TUGResultScreen from "../features/tests/tug/ResultScreen";

const Stack = createStackNavigator();

export function NavigationRoot() {
  const { theme } = useTheme();
  const { isAuthenticated, loading } = useAuth();
  const { t } = useTranslation("navigation");

  if (loading) return null;

  const navigationTheme: NavigationTheme = {
    ...(theme.mode === "dark" ? DarkTheme : DefaultTheme),
    colors: {
      ...(theme.mode === "dark" ? DarkTheme.colors : DefaultTheme.colors),
      background: theme.colors.bg,
      card: theme.colors.bg,
      text: theme.colors.text,
      border: theme.colors.border,
      primary: theme.colors.primary,
      notification: theme.colors.primary,
    },
  };

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        screenOptions={{
          headerShown: true,
          headerTintColor: theme.colors.text,
          headerStyle: {
            backgroundColor: theme.colors.bg,
            shadowOpacity: 0,
            elevation: 0,
          },
          headerTitleStyle: {
            color: theme.colors.text,
          },
          cardStyle: {
            backgroundColor: theme.colors.bg,
          },
        }}
      >
        {!isAuthenticated ? (
          <Stack.Screen
            name={Routes.Login}
            component={LoginScreen}
            options={{ headerShown: false }}
          />
        ) : (
          <>
            <Stack.Screen
              name={Routes.Home}
              component={HomeScreen}
              options={{ headerShown: false }}
            />

            <Stack.Screen
              name={Routes.Settings}
              component={SettingsScreen}
              options={{ title: t("titles.settings") }}
            />

            <Stack.Screen
              name={Routes.QuestionnaireHub}
              component={QuestionnaireHubScreen}
              options={{ title: t("titles.questionnaires") }}
            />
            <Stack.Screen
              name={Routes.IVCF20}
              component={IVCF20Screen}
              options={{ title: t("titles.ivcf20") }}
            />
            <Stack.Screen
              name={Routes.IVCF20Result}
              component={IVCF20ResultScreen}
              options={{ title: t("titles.ivcf20Result") }}
            />

            <Stack.Screen
              name={Routes.ParticipantForm}
              component={ParticipantFormScreen}
              options={{ title: t("titles.participant") }}
            />
            <Stack.Screen
              name={Routes.ParticipantPick}
              component={ParticipantPickScreen}
              options={{ title: t("titles.pickParticipant") }}
            />

            <Stack.Screen
              name={Routes.Test_SentarLevantar}
              component={SentarLevantar}
              options={{ title: t("titles.testSl") }}
            />
            <Stack.Screen
              name={Routes.Test_SentarLevantar_Result}
              component={SentarLevantarResultScreen}
              options={{ title: t("titles.testSlResult") }}
            />

            <Stack.Screen
              name={Routes.Test_ElevacaoCalcanhares}
              component={ElevacaoCalcanhares}
              options={{ title: t("titles.testEc") }}
            />
            <Stack.Screen
              name={Routes.Test_ElevacaoCalcanhares_Result}
              component={ElevacaoCalcanharesResultScreen}
              options={{ title: t("titles.testEcResult") }}
            />

            <Stack.Screen
              name={Routes.Test_LimiteEstabilidade}
              component={LimiteEstabilidade}
              options={{ title: t("titles.testLe") }}
            />
            <Stack.Screen
              name={Routes.Test_LimiteEstabilidade_Result}
              component={LimiteEstabilidadeResultScreen}
              options={{ title: t("titles.testLeResult") }}
            />

            <Stack.Screen
              name={Routes.Test_MarchaEstacionaria}
              component={MarchaEstacionaria}
              options={{ title: t("titles.testMe") }}
            />
            <Stack.Screen
              name={Routes.Test_MarchaEstacionaria_Result}
              component={MarchaEstacionariaResultScreen}
              options={{ title: t("titles.testMeResult") }}
            />

            <Stack.Screen
              name={Routes.Test_TUG}
              component={TUG}
              options={{ title: t("titles.testTug") }}
            />
            <Stack.Screen
              name={Routes.Test_TUG_Result}
              component={TUGResultScreen}
              options={{ title: t("titles.testTugResult") }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}