import { ChevronDown, ClipboardList, Moon, PersonStanding, Sofa } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Card } from "../../../components/ui/Card";
import type { ActSedentarySession } from "../../../types/participant";
import { formatDailyFromWeekly, formatMinutesTotal } from "../utils/formatters";

export function ActSedentarySection({
  sessions,
  selectedSession,
  onSelectSession,
}: {
  sessions: ActSedentarySession[];
  selectedSession: number;
  onSelectSession: (session: number) => void;
}) {
  const { t } = useTranslation("modules");
  const lastSession = sessions[sessions.length - 1];
  const selectedData =
    sessions.find((session) => session.sessao === selectedSession) ?? lastSession;
  const orderedSessions = [...sessions].sort((a, b) => b.sessao - a.sessao);
  const summary = selectedData?.summary;

  const metrics = [
    {
      key: "sleep",
      label: t("participantDetail.actSedentary.metrics.sleep"),
      value: formatDailyFromWeekly(summary?.sleepMinWeek),
      week: formatMinutesTotal(summary?.sleepMinWeek),
      icon: Moon,
    },
    {
      key: "moderate",
      label: t("participantDetail.actSedentary.metrics.moderate"),
      value: formatDailyFromWeekly(summary?.modMinWeek),
      week: formatMinutesTotal(summary?.modMinWeek),
      icon: PersonStanding,
    },
    {
      key: "vigorous",
      label: t("participantDetail.actSedentary.metrics.vigorous"),
      value: formatDailyFromWeekly(summary?.vigMinWeek),
      week: formatMinutesTotal(summary?.vigMinWeek),
      icon: PersonStanding,
    },
    {
      key: "sedentary",
      label: t("participantDetail.actSedentary.metrics.sedentary"),
      value: formatDailyFromWeekly(summary?.sedentaryMinWeek),
      week: formatMinutesTotal(summary?.sedentaryMinWeek),
      icon: Sofa,
    },
  ];

  return (
    <section id="act-sedentary-section" className="scroll-mt-24">
      <Card className="p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <ClipboardList size={18} className="text-blue-700" />
              <h2 className="text-lg font-black text-slate-900">
                {t("questionnaires.instruments.actSedentary.shortTitle")}
              </h2>
            </div>
            <p className="text-sm text-slate-500">{t("participantDetail.actSedentary.subtitle")}</p>
          </div>

          {sessions.length > 1 ? (
            <label className="block min-w-[260px]">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                {t("participantDetail.ivcf20.selectedSession")}
              </span>
              <div className="relative">
                <select
                  value={selectedData?.sessao ?? selectedSession}
                  onChange={(e) => onSelectSession(Number(e.target.value))}
                  className="h-12 w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 pr-10 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                >
                  {orderedSessions.map((session) => (
                    <option key={session.sessao} value={session.sessao}>
                      {t("participantDetail.sessionLabel", { session: session.sessao })}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={18}
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                />
              </div>
            </label>
          ) : null}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              {t("participantDetail.lastSession")}
            </p>
            <div className="mt-2 text-3xl font-black text-slate-900">{lastSession?.sessao ?? "—"}</div>
            <p className="mt-2 text-sm text-slate-500">{lastSession?.date ?? "—"}</p>
          </Card>

          <Card className="p-5 shadow-sm md:col-span-3">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              {t("participantDetail.actSedentary.activityProfile")}
            </p>
            <div className="mt-2 text-2xl font-black text-slate-900">
              {summary?.activityLabel ?? t("participantDetail.unclassified")}
            </div>
          </Card>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => {
            const Icon = metric.icon;

            return (
              <Card key={metric.key} className="p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                      {metric.label}
                    </p>
                    <div className="mt-2 text-2xl font-black text-slate-900">{metric.value}</div>
                    <p className="mt-2 text-sm text-slate-500">
                      {t("participantDetail.actSedentary.perWeek", { value: metric.week })}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3 text-blue-700">
                    <Icon size={20} />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </Card>
    </section>
  );
}
