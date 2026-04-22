import { useTranslation } from "react-i18next";
import { changeAppLanguage } from "../i18n";
import type { AppLanguage } from "../i18n/settings";

const OPTIONS: Array<{ language: AppLanguage; flag: string; labelKey: string; titleKey: string }> = [
  { language: "pt-BR", flag: "🇧🇷", labelKey: "common:language.pt", titleKey: "common:language.switchToPt" },
  { language: "en-GB", flag: "🇬🇧", labelKey: "common:language.en", titleKey: "common:language.switchToEn" },
];

type Props = {
  compact?: boolean;
};

export function LanguageSwitcher({ compact = false }: Props) {
  const { i18n, t } = useTranslation();
  const active = i18n.resolvedLanguage ?? i18n.language;

  return (
    <div className="flex items-center gap-2">
      {OPTIONS.map((item) => {
        const selected = active.startsWith(item.language.slice(0, 2));
        return (
          <button
            key={item.language}
            type="button"
            onClick={() => void changeAppLanguage(item.language)}
            title={t(item.titleKey)}
            className={[
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition",
              selected
                ? "border-brand-500 bg-brand-500 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
              compact ? "px-2 py-1" : "",
            ].join(" ")}
          >
            <span>{item.flag}</span>
            <span>{t(item.labelKey)}</span>
          </button>
        );
      })}
    </div>
  );
}
