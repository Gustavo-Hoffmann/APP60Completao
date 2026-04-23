export const MOBILE_LANGUAGE_STORAGE_KEY = "app60-language";

export const SUPPORTED_LANGUAGES = ["pt-BR", "en-GB"] as const;

export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: AppLanguage = "pt-BR";

export function normalizeLanguage(input?: string | null): AppLanguage {
  if (!input) return DEFAULT_LANGUAGE;
  const value = input.toLowerCase();
  if (value.startsWith("en")) return "en-GB";
  return "pt-BR";
}
