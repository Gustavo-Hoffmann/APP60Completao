import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import i18n, { type LanguageDetectorAsyncModule } from "i18next";
import { initReactI18next } from "react-i18next";
import ptAuth from "./locales/pt-BR/auth.json";
import ptCommon from "./locales/pt-BR/common.json";
import ptErrors from "./locales/pt-BR/errors.json";
import ptHome from "./locales/pt-BR/home.json";
import ptNavigation from "./locales/pt-BR/navigation.json";
import ptParticipants from "./locales/pt-BR/participants.json";
import ptQuestionnaires from "./locales/pt-BR/questionnaires.json";
import ptSettings from "./locales/pt-BR/settings.json";
import ptTests from "./locales/pt-BR/tests.json";
import enAuth from "./locales/en-GB/auth.json";
import enCommon from "./locales/en-GB/common.json";
import enErrors from "./locales/en-GB/errors.json";
import enHome from "./locales/en-GB/home.json";
import enNavigation from "./locales/en-GB/navigation.json";
import enParticipants from "./locales/en-GB/participants.json";
import enQuestionnaires from "./locales/en-GB/questionnaires.json";
import enSettings from "./locales/en-GB/settings.json";
import enTests from "./locales/en-GB/tests.json";
import {
  DEFAULT_LANGUAGE,
  MOBILE_LANGUAGE_STORAGE_KEY,
  SUPPORTED_LANGUAGES,
  normalizeLanguage,
  type AppLanguage,
} from "./settings";

const detector: LanguageDetectorAsyncModule = {
  type: "languageDetector",
  async: true,
  init: () => undefined,
  detect: async () => {
    const saved = await AsyncStorage.getItem(MOBILE_LANGUAGE_STORAGE_KEY);
    if (saved) {
      return normalizeLanguage(saved);
    }

    const locale = Localization.getLocales()[0]?.languageTag ?? DEFAULT_LANGUAGE;
    return normalizeLanguage(locale);
  },
  cacheUserLanguage: async (lng) => {
    await AsyncStorage.setItem(MOBILE_LANGUAGE_STORAGE_KEY, normalizeLanguage(lng));
  },
};

void i18n.use(detector).use(initReactI18next).init({
  compatibilityJSON: "v4",
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
  defaultNS: "common",
  interpolation: { escapeValue: false },
  resources: {
    "pt-BR": {
      common: ptCommon,
      auth: ptAuth,
      navigation: ptNavigation,
      home: ptHome,
      settings: ptSettings,
      tests: ptTests,
      participants: ptParticipants,
      questionnaires: ptQuestionnaires,
      errors: ptErrors,
    },
    "en-GB": {
      common: enCommon,
      auth: enAuth,
      navigation: enNavigation,
      home: enHome,
      settings: enSettings,
      tests: enTests,
      participants: enParticipants,
      questionnaires: enQuestionnaires,
      errors: enErrors,
    },
  },
});

export function getCurrentLanguage(): AppLanguage {
  return normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);
}

export async function changeAppLanguage(language: AppLanguage) {
  await i18n.changeLanguage(language);
}

export default i18n;
