import { Activity, BarChart3, ClipboardList, Loader2, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
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
};

function monthLabel(month: number) {
  const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return labels[month - 1] ?? String(month);
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
            <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
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
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <BarChart3 size={16} className="text-blue-600" />
                {t("dashboard:monthlyCollections", { year: data.year })}
              </div>

              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} interval={0} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value) => [`${value}`, t("dashboard:collectionsTooltip")]} />
                    <Bar dataKey="coletas" fill="#2563eb" radius={[8, 8, 0, 0]} />
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
                        <Bar dataKey="value" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
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