import { ClipboardList, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppHeader } from "../../../components/layout/AppHeader";
import { StatCard } from "../../../components/ui/StatCard";
import type { Participant } from "../../../types/participant";
import { listParticipants } from "../../participants/services/participants";

export function QuestionnairesPage() {
  const { t } = useTranslation("modules");
  const [participants, setParticipants] = useState<Participant[]>([]);

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

  const total = participants.length;
  const fragile = participants.filter((p) => p.ivcfClass === "Frágil").length;
  const preFragile = participants.filter((p) => p.ivcfClass === "Pré-Frágil").length;
  const hasParticipants = useMemo(() => participants.length > 0, [participants]);

  return (
    <div>
      <AppHeader
        title={t("questionnaires.title")}
        subtitle={t("questionnaires.subtitle")}
      />

      <div className="space-y-6 p-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <StatCard
            title={t("questionnaires.stats.evaluated")}
            value={total}
            icon={Users}
            subtitle={t("questionnaires.stats.evaluatedSub")}
          />
          <StatCard
            title={t("questionnaires.stats.fragile")}
            value={fragile}
            icon={ClipboardList}
            subtitle="IVCF-20"
          />
          <StatCard
            title={t("questionnaires.stats.preFragile")}
            value={preFragile}
            icon={ClipboardList}
            subtitle="IVCF-20"
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-6 py-4">{t("questionnaires.table.participant")}</th>
                <th className="px-6 py-4">{t("questionnaires.table.score")}</th>
                <th className="px-6 py-4">{t("questionnaires.table.classification")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {hasParticipants ? (
                participants.map((participant) => (
                  <tr key={participant.id}>
                    <td className="px-6 py-4 font-medium text-slate-800">
                      {participant.name}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {participant.ivcfScore ?? "-"}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {participant.ivcfClass ?? "-"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-6 py-6 text-slate-500" colSpan={3}>
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