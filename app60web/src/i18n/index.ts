import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import ptAuth from "./locales/pt-BR/auth.json";
import ptCommon from "./locales/pt-BR/common.json";
import ptDashboard from "./locales/pt-BR/dashboard.json";
import ptModules from "./locales/pt-BR/modules.json";
import ptNavigation from "./locales/pt-BR/navigation.json";
import enAuth from "./locales/en-GB/auth.json";
import enCommon from "./locales/en-GB/common.json";
import enDashboard from "./locales/en-GB/dashboard.json";
import enModules from "./locales/en-GB/modules.json";
import enNavigation from "./locales/en-GB/navigation.json";
import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  WEB_LANGUAGE_STORAGE_KEY,
  type AppLanguage,
} from "./settings";

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    compatibilityJSON: "v4",
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
    defaultNS: "common",
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: WEB_LANGUAGE_STORAGE_KEY,
      caches: ["localStorage"],
    },
    resources: {
      "pt-BR": {
        common: ptCommon,
        auth: ptAuth,
        navigation: ptNavigation,
        dashboard: ptDashboard,
        modules: ptModules,
      },
      "en-GB": {
        common: enCommon,
        auth: enAuth,
        navigation: enNavigation,
        dashboard: enDashboard,
        modules: enModules,
      },
    },
  });

export async function changeAppLanguage(language: AppLanguage) {
  await i18n.changeLanguage(language);
}

export default i18n;
