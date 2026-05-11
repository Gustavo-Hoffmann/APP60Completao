import { useTranslation } from "react-i18next";

export type QuestionnaireInstrumentKey = "ivcf20" | "fesi" | "actSedentary";

const INSTRUMENTS: QuestionnaireInstrumentKey[] = ["ivcf20", "fesi", "actSedentary"];

export function QuestionnaireInstrumentTabs({
  value,
  onChange,
}: {
  value: QuestionnaireInstrumentKey;
  onChange: (value: QuestionnaireInstrumentKey) => void;
}) {
  const { t } = useTranslation("modules");

  return (
    <div className="inline-flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1.5">
      {INSTRUMENTS.map((instrument) => {
        const active = instrument === value;

        return (
          <button
            key={instrument}
            type="button"
            onClick={() => onChange(instrument)}
            className={[
              "rounded-xl px-4 py-2 text-sm font-semibold transition",
              active
                ? "bg-white text-blue-700 shadow-sm"
                : "text-slate-600 hover:bg-white/70 hover:text-slate-900",
            ].join(" ")}
          >
            {t(`questionnaires.instruments.${instrument}.shortTitle`)}
          </button>
        );
      })}
    </div>
  );
}
