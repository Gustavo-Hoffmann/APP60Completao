import { useTranslation } from "react-i18next";

import type { FesiClassification, IvcfClassification } from "../../../types/participant";

type QuestionnaireStatusCardProps = {
  title: string;
  score?: string | number | null;
  badge?: string | null;
  date?: string | null;
  emptyLabel: string;
  tone?: "neutral" | "good" | "warn" | "bad" | "info";
  collected?: boolean;
  onClick?: () => void;
};

function toneClasses(tone: QuestionnaireStatusCardProps["tone"]) {
  if (tone === "good") {
    return {
      wrap: "border-emerald-200 bg-emerald-50/70",
      title: "text-emerald-700",
      value: "text-emerald-700",
    };
  }

  if (tone === "warn") {
    return {
      wrap: "border-amber-200 bg-amber-50/70",
      title: "text-amber-700",
      value: "text-amber-700",
    };
  }

  if (tone === "bad") {
    return {
      wrap: "border-red-200 bg-red-50/70",
      title: "text-red-700",
      value: "text-red-700",
    };
  }

  if (tone === "info") {
    return {
      wrap: "border-blue-200 bg-blue-50/70",
      title: "text-blue-700",
      value: "text-blue-700",
    };
  }

  return {
    wrap: "border-slate-200 bg-slate-50",
    title: "text-slate-500",
    value: "text-slate-700",
  };
}

export function ivcfTone(value?: IvcfClassification): QuestionnaireStatusCardProps["tone"] {
  if (value === "Frágil") return "bad";
  if (value === "Pré-Frágil") return "warn";
  if (value === "Robusto") return "good";
  return "neutral";
}

export function fesiTone(value?: FesiClassification): QuestionnaireStatusCardProps["tone"] {
  if (value === "Alta") return "bad";
  if (value === "Moderada") return "warn";
  if (value === "Baixa") return "good";
  return "neutral";
}

export function QuestionnaireStatusCard({
  title,
  score,
  badge,
  date,
  emptyLabel,
  tone = "neutral",
  collected = false,
  onClick,
}: QuestionnaireStatusCardProps) {
  const { t } = useTranslation("modules");
  const styles = toneClasses(tone);
  const shellClass = [
    "block w-full rounded-2xl border p-5 text-left shadow-sm transition",
    collected ? "border-blue-300 bg-blue-50/70" : styles.wrap,
    onClick ? "hover:-translate-y-0.5 hover:shadow-md" : "",
  ].join(" ");
  const titleClass = collected ? "text-slate-900" : styles.title;

  const content = (
    <>
      <div className={`text-xs font-bold uppercase tracking-[0.18em] ${titleClass}`}>
        {title}
      </div>
      <div className="mt-3 flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-slate-500">{t("participantDetail.score")}</div>
          <div className={`mt-2 text-3xl font-black ${styles.value}`}>{score ?? "—"}</div>
          <div className="mt-2 text-sm text-slate-500">{date ?? emptyLabel}</div>
        </div>

        {badge ? (
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-700">
            {badge}
          </span>
        ) : null}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={shellClass}>
        {content}
      </button>
    );
  }

  return <div className={shellClass}>{content}</div>;
}
