import { Activity, BarChart3, ClipboardList, Loader2, Trophy, TrendingUp, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppHeader } from "../../../components/layout/AppHeader";
import { StatCard } from "../../../components/ui/StatCard";
import { apiJson } from "../../../lib/api/client";
import { useAuth } from "../../../contexts/AuthContext";

type DashboardSummary = {
  year: number;
  participantsTotal: number;
  collectionsTotal: number;
  collectionsMonth: number;
  collectionsByMonth: Array<{ month: number; count: number }>;
  topTest: { testType: string; count: number } | null;
  ivcf: { robusto: number; preFragil: number; fragil: number };
  institutionsTotal?: number;
  usersTotal?: number;
  topInstitutionByUsers?: { id: string; name: string; acronym: string; count: number } | null;
  topInstitutionByCollections?: { id: string; name: string; acronym: string; count: number } | null;
  collectionsCumulativeByDay?: Array<{ day: string; total: number }>;
};

function monthLabel(month: number) {
  const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return labels[month - 1] ?? String(month);
}

/** Série cumulativa com origem em 1º de jan (total 0) para a linha partir do zero até o primeiro dia com dados. */
function cumulativeSeriesWithOrigin(year: number, rows: Array<{ day: string; total: number }>) {
  const y0 = `${year}-01-01`;
  const origin = { day: y0, total: 0 };
  if (!rows.length) return [origin];

  const sorted = [...rows].sort((a, b) => a.day.localeCompare(b.day));
  const first = sorted[0];
  if (first.day > y0) return [origin, ...sorted];
  if (first.day === y0 && first.total > 0) return [origin, ...sorted];
  return sorted;
}

export function DashboardPage() {
  const { user } = useAuth();
  const { t } = useTranslation(["dashboard"]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const year = new Date().getFullYear();
        const summary = await apiJson<DashboardSummary>(`/api/dashboard/summary?year=${year}`);
        setData(summary ?? null);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : t("dashboard:errorTitle"));
        setData(null);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const cumulativeChartData = useMemo(() => {
    if (!data) return [];
    return cumulativeSeriesWithOrigin(data.year, data.collectionsCumulativeByDay ?? []);
  }, [data]);

  const chartData = useMemo(() => {
    const year = data?.year ?? new Date().getFullYear();
    const byMonth = new Map<number, number>();
    for (const row of data?.collectionsByMonth ?? []) {
      byMonth.set(row.month, row.count);
    }
    return Array.from({ length: 12 }, (_, idx) => {
      const month = idx + 1;
      return {
        year,
        month,
        label: t(`dashboard:monthsShort.${month - 1}`, { defaultValue: monthLabel(month) }),
        coletas: byMonth.get(month) ?? 0,
      };
    });
  }, [data, t]);

  const headerTitle =
    user?.role === "GESTOR"
      ? user.institution_name ?? t("dashboard:myInstitution")
      : t("dashboard:title");
  const headerSubtitle = user?.role === "GESTOR" ? undefined : t("dashboard:subtitle");
  const isAdminDashboard = user?.role === "SUPER_ADMIN" || user?.role === "ADMIN";

  const testLabel = (testType: string) => {
    const normalized = (testType ?? "").toUpperCase();
    return t(`dashboard:tests.${normalized}`, { defaultValue: normalized || "—" });
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <AppHeader title={headerTitle} subtitle={headerSubtitle} />

      <main className="space-y-6 p-6">
        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500">
              <Loader2 size={18} className="animate-spin" />
              {t("dashboard:loading")}
            </div>
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 shadow-sm">
            <div className="text-sm font-semibold text-red-700">{t("dashboard:errorTitle")}</div>
            <div className="mt-1 text-sm text-red-600">{error}</div>
          </div>
        ) : !data ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            {t("dashboard:noData")}
          </div>
        ) : (
          <>
            <section className={`grid grid-cols-1 gap-6 ${isAdminDashboard ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
              <StatCard
                title={t("dashboard:stats.participantsTotal")}
                value={data.participantsTotal}
                icon={Users}
                subtitle={t("dashboard:stats.participantsSubtitle")}
              />
              <StatCard
                title={t("dashboard:stats.collectionsTotal")}
                value={data.collectionsTotal}
                icon={Activity}
                subtitle={t("dashboard:stats.collectionsTotalSubtitle")}
              />
              <StatCard
                title={t("dashboard:stats.collectionsMonth")}
                value={data.collectionsMonth}
                icon={ClipboardList}
                subtitle={t("dashboard:stats.collectionsMonthSubtitle")}
              />
              {isAdminDashboard ? (
                <StatCard
                  title={t("dashboard:stats.institutionsTotal")}
                  value={data.institutionsTotal ?? 0}
                  icon={BarChart3}
                  subtitle={t("dashboard:stats.institutionsSubtitle")}
                />
              ) : null}
            </section>

            {isAdminDashboard ? (
              <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <StatCard
                  title={t("dashboard:stats.usersTotal")}
                  value={data.usersTotal ?? 0}
                  icon={Users}
                  subtitle={t("dashboard:stats.usersSubtitle")}
                />
                <StatCard
                  title={t("dashboard:stats.topInstitutionUsers")}
                  value={data.topInstitutionByUsers?.count ?? 0}
                  icon={Trophy}
                  subtitle={
                    data.topInstitutionByUsers
                      ? `${data.topInstitutionByUsers.name} • ${data.topInstitutionByUsers.acronym}`
                      : t("dashboard:stats.topInstitutionFallback")
                  }
                />
                <StatCard
                  title={t("dashboard:stats.topInstitutionCollections")}
                  value={data.topInstitutionByCollections?.count ?? 0}
                  icon={TrendingUp}
                  subtitle={
                    data.topInstitutionByCollections
                      ? `${data.topInstitutionByCollections.name} • ${data.topInstitutionByCollections.acronym}`
                      : t("dashboard:stats.topInstitutionFallback")
                  }
                />
              </section>
            ) : null}

            {isAdminDashboard ? (
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <TrendingUp size={16} className="chart-section-icon text-blue-600" />
                  {t("dashboard:cumulativeCollections", { year: data.year })}
                </div>

                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={cumulativeChartData}
                      margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="cumulativeAreaFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--chart-area-stop-top)" stopOpacity={1} />
                          <stop offset="100%" stopColor="var(--chart-area-stop-bottom)" stopOpacity={1} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 12 }}
                        minTickGap={28}
                        tickFormatter={(v) => String(v).slice(5)}
                      />
                      <YAxis allowDecimals={false} domain={[0, "auto"]} tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value) => [`${value}`, t("dashboard:collectionsTooltip")]}
                        labelFormatter={(label) => t("dashboard:dateLabel", { date: label })}
                      />
                      <Area
                        type="monotone"
                        dataKey="total"
                        stroke="transparent"
                        fill="url(#cumulativeAreaFill)"
                        isAnimationActive={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="total"
                        stroke="var(--chart-primary)"
                        strokeWidth={3}
                        dot={false}
                        activeDot={{ r: 6, fill: "var(--chart-primary)" }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </section>
            ) : null}

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <BarChart3 size={16} className="chart-section-icon text-blue-600" />
                {t("dashboard:monthlyCollections", { year: data.year })}
              </div>

              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} interval={0} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value) => [`${value}`, t("dashboard:collectionsTooltip")]} />
                    <Bar dataKey="coletas" fill="var(--chart-primary)" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="text-sm font-semibold text-slate-700">{t("dashboard:topTest")}</div>
                  <div className="mt-2 flex items-baseline justify-between gap-4">
                    <div className="text-lg font-bold text-slate-900">
                      {data.topTest ? testLabel(data.topTest.testType) : "—"}
                    </div>
                    <div className="text-2xl font-black text-blue-700">
                      {data.topTest ? data.topTest.count : 0}
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{t("dashboard:topTestSubtitle")}</div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="text-sm font-semibold text-slate-700">{t("dashboard:ivcfTitle")}</div>
                  <div className="mt-3 h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={[
                          { label: t("dashboard:ivcfLabels.robusto"), value: data.ivcf.robusto },
                          { label: t("dashboard:ivcfLabels.pre"), value: data.ivcf.preFragil },
                          { label: t("dashboard:ivcfLabels.fragil"), value: data.ivcf.fragil },
                        ]}
                        margin={{ top: 8, right: 0, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" tick={{ fontSize: 12 }} interval={0} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(value) => [`${value}`, t("dashboard:ivcfTooltip")]} />
                        <Bar dataKey="value" fill="var(--chart-secondary)" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    {t("dashboard:ivcfFootnote")}
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}