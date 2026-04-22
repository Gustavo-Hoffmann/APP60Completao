export const WEB_LANGUAGE_STORAGE_KEY = "app60web-language";

export const SUPPORTED_LANGUAGES = ["pt-BR", "en-GB"] as const;

export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: AppLanguage = "pt-BR";
