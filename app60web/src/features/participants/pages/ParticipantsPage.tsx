import { BarChart3, Search, UserPlus, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppHeader } from "../../../components/layout/AppHeader";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { useAuth } from "../../../contexts/AuthContext";
import { routes } from "../../../navigation/routes";
import type { Participant } from "../../../types/participant";
import { listParticipants } from "../services/participants";

function getIvcfBadgeStyles(ivcfClass?: Participant["ivcfClass"]) {
  if (ivcfClass === "Frágil") {
    return "border-red-200 bg-red-100 text-red-700";
  }
  if (ivcfClass === "Pré-Frágil") {
    return "border-amber-200 bg-amber-100 text-amber-700";
  }
  if (ivcfClass === "Robusto") {
    return "border-emerald-200 bg-emerald-100 text-emerald-700";
  }
  return "border-slate-200 bg-slate-100 text-slate-500";
}

function getIvcfPanelStyles(ivcfClass?: Participant["ivcfClass"]) {
  if (ivcfClass === "Frágil") {
    return "border-red-200 bg-red-50/80";
  }
  if (ivcfClass === "Pré-Frágil") {
    return "border-amber-200 bg-amber-50/80";
  }
  if (ivcfClass === "Robusto") {
    return "border-emerald-200 bg-emerald-50/80";
  }
  return "border-slate-200 bg-slate-50";
}

function PremiumMetricCard({
  label,
  value,
  subtitle,
  icon: Icon,
}: {
  label: string;
  value: number;
  subtitle: string;
  icon: typeof UserRound;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
            {label}
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
          <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
        </div>

        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3 text-blue-700">
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

function IvcfDistributionCard({
  label,
  subtitle,
  robust,
  preFragile,
  fragile,
}: {
  label: string;
  subtitle: string;
  robust: number;
  preFragile: number;
  fragile: number;
}) {
  const data = [
    { name: "Robusto", value: robust, color: "#10b981" },
    { name: "Pré-frágil", value: preFragile, color: "#f59e0b" },
    { name: "Frágil", value: fragile, color: "#ef4444" },
  ];

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
            {label}
          </p>
          <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
        </div>

        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3 text-blue-700">
          <BarChart3 size={20} />
        </div>
      </div>

      <div className="mt-4 h-28">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <Tooltip
              cursor={{ fill: "rgba(59, 130, 246, 0.12)" }}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #e2e8f0",
                boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
              }}
              formatter={(value) => [`${value}`, "Participantes"]}
            />
            <Bar dataKey="value" radius={[10, 10, 0, 0]}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function ParticipantsPage() {
  const { t } = useTranslation("modules");
  const navigate = useNavigate();
  const { user } = useAuth();
  const canPersistParticipant = Boolean(
    user &&
      (user.role === "SUPER_ADMIN" ||
        user.role === "ADMIN" ||
        (Boolean(user.institution_id) &&
          (user.role === "GESTOR" || user.role === "SUPERVISOR" || user.role === "AVALIADOR"))),
  );
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setIsLoading(true);
        setError(null);
        const data = await listParticipants();
        if (mounted) {
          setParticipants(data);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : t("participants.loadErrorTitle"));
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [t]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return participants;

    return participants.filter((participant) => {
      const cityState = [participant.city, participant.state].filter(Boolean).join(" / ");

      return [participant.name, participant.nationality, participant.cpf, cityState]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [participants, search]);

  const stats = useMemo(() => {
    const totalCollections = participants.reduce((acc, participant) => {
      const tests = participant.tests;
      if (!tests) return acc;
      return (
        acc +
        (tests.twoMstSessions?.length ?? 0) +
        (tests.sl30sSessions?.length ?? 0) +
        (tests.ivcfSessions?.length ?? 0)
      );
    }, 0);

    return {
      totalCollections,
      ivcfRobust: participants.filter((participant) => participant.ivcfClass === "Robusto").length,
      ivcfPreFragile: participants.filter((participant) => participant.ivcfClass === "Pré-Frágil").length,
      ivcfFragile: participants.filter((participant) => participant.ivcfClass === "Frágil").length,
    };
  }, [participants]);

  return (
    <div className="min-h-screen bg-slate-100">
      <AppHeader
        title={t("participants.title")}
        subtitle={t("participants.subtitle")}
      />

      <main className="space-y-6 px-6 py-8">
        <section className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between xl:w-auto">
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={() => navigate(routes.participantCreate)}
              variant={canPersistParticipant ? "primary" : "secondary"}
              title={!canPersistParticipant ? t("participants.createDisabledTitle") : undefined}
              disabled={!canPersistParticipant}
            >
              <span className="inline-flex items-center gap-2">
                <UserPlus size={16} />
                {t("participants.createButton")}
              </span>
            </Button>
          </div>

          <div className="relative w-full max-w-md">
            <Search
              size={18}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder={t("participants.searchPlaceholder")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <PremiumMetricCard
            label={t("participants.stats.totalCollections")}
            value={stats.totalCollections}
            subtitle={t("participants.stats.totalCollectionsSub")}
            icon={UserRound}
          />
          <IvcfDistributionCard
            label={t("participants.stats.ivcfDistribution")}
            subtitle={t("participants.stats.ivcfDistributionSub")}
            robust={stats.ivcfRobust}
            preFragile={stats.ivcfPreFragile}
            fragile={stats.ivcfFragile}
          />
        </section>

        <section>
          {isLoading ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="text-slate-500">{t("participants.loading")}</div>
            </div>
          ) : error ? (
            <div className="rounded-3xl border border-red-200 bg-red-50 p-6 shadow-sm">
              <p className="font-semibold text-red-700">{t("participants.loadErrorTitle")}</p>
              <p className="mt-1 text-sm text-red-600">{error}</p>
            </div>
          ) : (
            <Card className="overflow-hidden rounded-3xl border border-blue-200 bg-blue-50/60 shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-white">
                    <tr className="border-b border-slate-200 text-left text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                      <th className="px-6 py-5">{t("participants.table.name")}</th>
                      <th className="px-6 py-5">{t("participants.table.identity")}</th>
                      <th className="px-6 py-5">{t("participants.table.age")}</th>
                      <th className="px-6 py-5">{t("participants.table.sex")}</th>
                      <th className="px-6 py-5">{t("participants.table.city")}</th>
                      <th className="px-6 py-5">{t("participants.table.ivcf")}</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filtered.map((participant, index) => {
                      const cityState =
                        [participant.city, participant.state].filter(Boolean).join(" / ") || "—";

                      const isExample = participant.id === "example-maria-silva";

                      return (
                        <tr
                          key={participant.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => navigate(routes.participantDetail(participant.id))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              navigate(routes.participantDetail(participant.id));
                            }
                          }}
                          className={[
                            "cursor-pointer border-t border-blue-100/80 transition-colors hover:bg-blue-50/70",
                            isExample ? "bg-slate-50/70" : "bg-white",
                            index === 0 ? "border-t-0" : "",
                          ].join(" ")}
                        >
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              <span className="font-semibold text-blue-800">
                                {participant.name}
                              </span>

                              {isExample ? (
                                <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-blue-700">
                                  {t("participants.table.example")}
                                </span>
                              ) : null}
                            </div>
                          </td>

                          <td className="px-6 py-5 text-slate-600">{participant.cpf || "—"}</td>
                          <td className="px-6 py-5 text-slate-600">{participant.age || "—"}</td>
                          <td className="px-6 py-5 text-slate-600">{participant.sex || "—"}</td>
                          <td className="px-6 py-5 text-slate-600">{cityState}</td>
                          <td className="px-6 py-5">
                            {participant.ivcfClass ? (
                              <div
                                className={[
                                  "flex w-fit flex-col gap-2 rounded-2xl border px-4 py-3",
                                  getIvcfPanelStyles(participant.ivcfClass),
                                ].join(" ")}
                              >
                                <div className="text-sm font-black text-slate-900">
                                  {participant.ivcfScore ?? "—"} {t("participants.table.points")}
                                </div>
                                <span
                                  className={[
                                    "inline-flex w-fit rounded-full border px-3 py-1 text-xs font-bold",
                                    getIvcfBadgeStyles(participant.ivcfClass),
                                  ].join(" ")}
                                >
                                  {participant.ivcfClass}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400">{t("participants.table.noCollection")}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-10 text-center">
                          <p className="font-semibold text-slate-700">
                            {t("participants.emptyTitle")}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            {t("participants.emptySubtitle")}
                          </p>
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </section>
      </main>
    </div>
  );
}