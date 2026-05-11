import { ClipboardList, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppHeader } from "../../../components/layout/AppHeader";
import { StatCard } from "../../../components/ui/StatCard";
import type { Participant } from "../../../types/participant";
import { listParticipants } from "../../participants/services/participants";
import {
  QuestionnaireInstrumentTabs,
  type QuestionnaireInstrumentKey,
} from "../components/QuestionnaireInstrumentTabs";
import { formatDailyFromWeekly } from "../utils/formatters";

export function QuestionnairesPage() {
  const { t } = useTranslation("modules");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [instrument, setInstrument] = useState<QuestionnaireInstrumentKey>("ivcf20");

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const data = await listParticipants();
        if (!mounted) return;
        setParticipants(data.filter((participant) => participant.id !== "example-maria-silva"));
      } catch {
        if (!mounted) return;
        setParticipants([]);
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const filteredParticipants = useMemo(() => {
    if (instrument === "ivcf20") {
      return participants.filter((participant) => participant.tests?.hasIVCF20);
    }

    if (instrument === "fesi") {
      return participants.filter((participant) => participant.tests?.hasFESI);
    }

    return participants.filter((participant) => participant.tests?.hasActSedentary);
  }, [instrument, participants]);

  const stats = useMemo(() => {
    if (instrument === "ivcf20") {
      return {
        evaluated: filteredParticipants.length,
        secondary: filteredParticipants.filter((participant) => participant.ivcfClass === "Frágil")
          .length,
        tertiary: filteredParticipants.filter((participant) => participant.ivcfClass === "Pré-Frágil")
          .length,
        secondaryLabel: t("questionnaires.stats.fragile"),
        tertiaryLabel: t("questionnaires.stats.preFragile"),
      };
    }

    if (instrument === "fesi") {
      return {
        evaluated: filteredParticipants.length,
        secondary: filteredParticipants.filter((participant) => participant.fesiClass === "Alta")
          .length,
        tertiary: filteredParticipants.filter((participant) => participant.fesiClass === "Moderada")
          .length,
        secondaryLabel: t("questionnaires.instruments.fesi.stats.highConcern"),
        tertiaryLabel: t("questionnaires.instruments.fesi.stats.moderateConcern"),
      };
    }

    return {
      evaluated: filteredParticipants.length,
      secondary: filteredParticipants.filter((participant) =>
        String(participant.actSedentaryLabel ?? "").toLowerCase().includes("sedent"),
      ).length,
      tertiary: filteredParticipants.filter((participant) => participant.actSedentaryLabel).length,
      secondaryLabel: t("questionnaires.instruments.actSedentary.stats.sedentaryProfile"),
      tertiaryLabel: t("questionnaires.instruments.actSedentary.stats.withProfile"),
    };
  }, [filteredParticipants, instrument, t]);

  const hasParticipants = filteredParticipants.length > 0;

  return (
    <div>
      <AppHeader title={t("questionnaires.title")} subtitle={t("questionnaires.subtitle")} />

      <div className="space-y-6 p-6">
        <QuestionnaireInstrumentTabs value={instrument} onChange={setInstrument} />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <StatCard
            title={t("questionnaires.stats.evaluated")}
            value={stats.evaluated}
            icon={Users}
            subtitle={t(`questionnaires.instruments.${instrument}.statsSubtitle`)}
          />
          <StatCard
            title={stats.secondaryLabel}
            value={stats.secondary}
            icon={ClipboardList}
            subtitle={t(`questionnaires.instruments.${instrument}.shortTitle`)}
          />
          <StatCard
            title={stats.tertiaryLabel}
            value={stats.tertiary}
            icon={ClipboardList}
            subtitle={t(`questionnaires.instruments.${instrument}.shortTitle`)}
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-6 py-4">{t("questionnaires.table.participant")}</th>
                {instrument === "ivcf20" ? (
                  <>
                    <th className="px-6 py-4">{t("questionnaires.table.score")}</th>
                    <th className="px-6 py-4">{t("questionnaires.table.classification")}</th>
                  </>
                ) : null}
                {instrument === "fesi" ? (
                  <>
                    <th className="px-6 py-4">{t("questionnaires.instruments.fesi.table.score")}</th>
                    <th className="px-6 py-4">{t("questionnaires.instruments.fesi.table.mean")}</th>
                    <th className="px-6 py-4">{t("questionnaires.table.classification")}</th>
                  </>
                ) : null}
                {instrument === "actSedentary" ? (
                  <>
                    <th className="px-6 py-4">
                      {t("questionnaires.instruments.actSedentary.table.profile")}
                    </th>
                    <th className="px-6 py-4">
                      {t("questionnaires.instruments.actSedentary.table.moderate")}
                    </th>
                    <th className="px-6 py-4">
                      {t("questionnaires.instruments.actSedentary.table.sedentary")}
                    </th>
                  </>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {hasParticipants ? (
                filteredParticipants.map((participant) => {
                  const latestAct =
                    participant.tests?.actSedentarySessions?.[
                      (participant.tests?.actSedentarySessions?.length ?? 1) - 1
                    ];

                  return (
                    <tr key={participant.id}>
                      <td className="px-6 py-4 font-medium text-slate-800">{participant.name}</td>

                      {instrument === "ivcf20" ? (
                        <>
                          <td className="px-6 py-4 text-slate-500">{participant.ivcfScore ?? "—"}</td>
                          <td className="px-6 py-4 text-slate-500">{participant.ivcfClass ?? "—"}</td>
                        </>
                      ) : null}

                      {instrument === "fesi" ? (
                        <>
                          <td className="px-6 py-4 text-slate-500">{participant.fesiScore ?? "—"}</td>
                          <td className="px-6 py-4 text-slate-500">
                            {participant.fesiMeanScore != null
                              ? participant.fesiMeanScore.toFixed(2)
                              : "—"}
                          </td>
                          <td className="px-6 py-4 text-slate-500">{participant.fesiClass ?? "—"}</td>
                        </>
                      ) : null}

                      {instrument === "actSedentary" ? (
                        <>
                          <td className="px-6 py-4 text-slate-500">
                            {participant.actSedentaryLabel ?? "—"}
                          </td>
                          <td className="px-6 py-4 text-slate-500">
                            {formatDailyFromWeekly(latestAct?.summary.modMinWeek)}
                          </td>
                          <td className="px-6 py-4 text-slate-500">
                            {formatDailyFromWeekly(latestAct?.summary.sedentaryMinWeek)}
                          </td>
                        </>
                      ) : null}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    className="px-6 py-6 text-slate-500"
                    colSpan={instrument === "ivcf20" ? 3 : 4}
                  >
                    {t("questionnaires.table.empty")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
