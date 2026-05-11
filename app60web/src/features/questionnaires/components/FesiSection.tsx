import { Activity, ChevronDown, ClipboardList } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Card } from "../../../components/ui/Card";
import type { FesiSession } from "../../../types/participant";

function fesiScoreColor(score: number) {
  if (score <= 1) return "text-emerald-700";
  if (score === 2) return "text-blue-700";
  if (score === 3) return "text-amber-700";
  return "text-red-700";
}

export function FesiSection({
  sessions,
  selectedSession,
  onSelectSession,
}: {
  sessions: FesiSession[];
  selectedSession: number;
  onSelectSession: (session: number) => void;
}) {
  const { t } = useTranslation("modules");
  const lastSession = sessions[sessions.length - 1];
  const selectedData =
    sessions.find((session) => session.sessao === selectedSession) ?? lastSession;
  const orderedSessions = [...sessions].sort((a, b) => b.sessao - a.sessao);

  return (
    <section id="fesi-section" className="scroll-mt-24">
      <Card className="p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <ClipboardList size={18} className="text-blue-700" />
              <h2 className="text-lg font-black text-slate-900">
                {t("questionnaires.instruments.fesi.shortTitle")}
              </h2>
            </div>
            <p className="text-sm text-slate-500">{t("participantDetail.fesi.subtitle")}</p>
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
                      {t("participantDetail.sessionOptionPoints", {
                        session: session.sessao,
                        points: session.scoreTotal,
                      })}
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

          <Card className="p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              {t("participantDetail.totalScore")}
            </p>
            <div className="mt-2 text-3xl font-black text-slate-900">
              {selectedData?.scoreTotal ?? "—"}
            </div>
          </Card>

          <Card className="p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              {t("participantDetail.fesi.meanScore")}
            </p>
            <div className="mt-2 text-3xl font-black text-slate-900">
              {selectedData?.meanScore != null ? selectedData.meanScore.toFixed(2) : "—"}
            </div>
          </Card>

          <Card className="p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              {t("participantDetail.overallClassification")}
            </p>
            <div className="mt-3 text-lg font-black text-slate-900">
              {selectedData?.classification ?? t("participantDetail.unclassified")}
            </div>
            <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50 p-3 text-blue-700">
              <Activity size={20} />
            </div>
          </Card>
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">
            {t("participantDetail.fesi.itemsTitle")}
          </h3>
          {selectedData?.items?.length ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {selectedData.items.map((item) => (
                <div
                  key={`${selectedData.sessao}-${item.key}`}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                >
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    {t("participantDetail.fesi.itemLabel", { number: item.number })}
                  </div>
                  <div className={`mt-2 text-2xl font-black ${fesiScoreColor(item.score)}`}>
                    {item.score}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
              {t("participantDetail.fesi.noItems")}
            </div>
          )}
        </div>
      </Card>
    </section>
  );
}
