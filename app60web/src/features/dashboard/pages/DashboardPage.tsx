import { Activity, BarChart3, ClipboardList, Loader2, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
  const labels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return labels[month - 1] ?? String(month);
}

function testLabel(testType: string) {
  const t = (testType ?? "").toUpperCase();
  if (t === "MARCHA") return "Marcha estacionária";
  if (t === "SL30S") return "Sentar e levantar (30s)";
  if (t === "IVCF20") return "IVCF-20";
  if (t === "TUG") return "TUG";
  if (t === "LOS") return "LOS";
  if (t === "UTT") return "UTT";
  return t || "—";
}

export function DashboardPage() {
  const { user } = useAuth();
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
        setError(err instanceof Error ? err.message : "Erro ao carregar dashboard.");
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
        label: monthLabel(month),
        coletas: byMonth.get(month) ?? 0,
      };
    });
  }, [data]);

  const headerTitle =
    user?.role === "GESTOR"
      ? user.institution_name ?? "Minha instituição"
      : "Dashboard";
  const headerSubtitle = user?.role === "GESTOR" ? undefined : "Visão geral operacional do sistema.";

  return (
    <div className="min-h-screen bg-slate-100">
      <AppHeader title={headerTitle} subtitle={headerSubtitle} />

      <main className="space-y-6 p-6">
        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500">
              <Loader2 size={18} className="animate-spin" />
              Carregando dashboard...
            </div>
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 shadow-sm">
            <div className="text-sm font-semibold text-red-700">Erro</div>
            <div className="mt-1 text-sm text-red-600">{error}</div>
          </div>
        ) : !data ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            Não foi possível carregar os dados.
          </div>
        ) : (
          <>
            <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <StatCard
                title="Participantes Totais"
                value={data.participantsTotal}
                icon={Users}
                subtitle="Base ativa vinculada"
              />
              <StatCard
                title="Coletas Totais"
                value={data.collectionsTotal}
                icon={Activity}
                subtitle="Acumulado"
              />
              <StatCard
                title="Coletas no Mês"
                value={data.collectionsMonth}
                icon={ClipboardList}
                subtitle="Mês atual"
              />
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <BarChart3 size={16} className="text-blue-600" />
                Coletas mensais ({data.year})
              </div>

              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} interval={0} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value) => [`${value}`, "Coletas"]} />
                    <Bar dataKey="coletas" fill="#2563eb" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="text-sm font-semibold text-slate-700">Teste com mais coletas</div>
                  <div className="mt-2 flex items-baseline justify-between gap-4">
                    <div className="text-lg font-bold text-slate-900">
                      {data.topTest ? testLabel(data.topTest.testType) : "—"}
                    </div>
                    <div className="text-2xl font-black text-blue-700">
                      {data.topTest ? data.topTest.count : 0}
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">Quantidade de coletas (total)</div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="text-sm font-semibold text-slate-700">IVCF</div>
                  <div className="mt-3 h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={[
                          { label: "Robusto", value: data.ivcf.robusto },
                          { label: "Pré", value: data.ivcf.preFragil },
                          { label: "Frágil", value: data.ivcf.fragil },
                        ]}
                        margin={{ top: 8, right: 0, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" tick={{ fontSize: 12 }} interval={0} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(value) => [`${value}`, "Participantes"]} />
                        <Bar dataKey="value" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    Última classificação IVCF-20 por participante (com coleta IVCF)
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