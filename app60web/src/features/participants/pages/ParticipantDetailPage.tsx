import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Footprints,
  UserRound,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppHeader } from "../../../components/layout/AppHeader";
import { Card } from "../../../components/ui/Card";
import { routes } from "../../../navigation/routes";
import type { Participant, TwoMstSession } from "../../../types/participant";
import { getParticipantById } from "../services/participants";

function DetailItem({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <Card className="p-4 shadow-sm">
      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-slate-800">{value || "—"}</div>
    </Card>
  );
}

function TinyMetricChart({
  title,
  data,
  dataKey,
  unit,
  color,
}: {
  title: string;
  data: TwoMstSession[];
  dataKey: keyof TwoMstSession;
  unit: string;
  color: string;
}) {
  return (
    <Card className="p-4 shadow-sm">
      <div className="mb-3 flex items-end justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
          {title}
        </p>
        <span className="text-xs text-slate-400">{unit}</span>
      </div>

      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 3" />
            <XAxis
              dataKey="sessao"
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "#f8fafc" }}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #e2e8f0",
                boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
              }}
              formatter={(value) => [`${value}`, title]}
              labelFormatter={(label) => `Sessão ${label}`}
            />
            <Bar dataKey={dataKey as string} radius={[8, 8, 0, 0]}>
              {data.map((entry) => (
                <Cell key={`${title}-${entry.sessao}`} fill={color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function IvcfBadge({ value }: { value?: Participant["ivcfClass"] }) {
  const styles =
    value === "Frágil"
      ? "bg-red-100 text-red-700 border-red-200"
      : value === "Pré-Frágil"
        ? "bg-amber-100 text-amber-700 border-amber-200"
        : "bg-emerald-100 text-emerald-700 border-emerald-200";

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${styles}`}>
      {value || "Sem classificação"}
    </span>
  );
}

function IvcfCard({
  score,
  ivcfClass,
}: {
  score?: number;
  ivcfClass?: Participant["ivcfClass"];
}) {
  const tone =
    ivcfClass === "Frágil"
      ? {
          wrap: "border-red-200 bg-red-50/70",
          title: "text-red-700",
          value: "text-red-700",
        }
      : ivcfClass === "Pré-Frágil"
        ? {
            wrap: "border-amber-200 bg-amber-50/70",
            title: "text-amber-700",
            value: "text-amber-700",
          }
        : {
            wrap: "border-emerald-200 bg-emerald-50/70",
            title: "text-emerald-700",
            value: "text-emerald-700",
          };

  return (
    <Card className={`min-w-[240px] p-5 shadow-sm ${tone.wrap}`}>
      <div className={`text-xs font-bold uppercase tracking-[0.18em] ${tone.title}`}>
        Status clínico
      </div>
      <div className="mt-3 flex items-center justify-between gap-4">
        <div>
          <div className="text-sm text-slate-500">IVCF-20</div>
          <div className={`mt-2 text-3xl font-black ${tone.value}`}>{score ?? "—"}</div>
        </div>
        <IvcfBadge value={ivcfClass} />
      </div>
    </Card>
  );
}

function TestCard({
  title,
  description,
  active = false,
  onClick,
}: {
  title: string;
  description: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-2xl border p-5 text-left transition-all",
        "hover:-translate-y-0.5 hover:shadow-md",
        active
          ? "border-blue-300 bg-blue-50/70"
          : "border-slate-200 bg-slate-50 text-slate-400",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-black text-slate-900">{title}</div>
          <p className="mt-2 text-sm text-slate-500">{description}</p>
        </div>
        {active ? (
          <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-blue-700">
            Ativo
          </span>
        ) : null}
      </div>
    </button>
  );
}

export function ParticipantDetailPage() {
  const { id = "" } = useParams();
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<number>(1);
  const [openedTest, setOpenedTest] = useState<"2MST" | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getParticipantById(id);
        if (!mounted) return;
        setParticipant(data);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Erro ao carregar participante.");
      } finally {
        if (!mounted) return;
        setIsLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [id]);

  const sessions = useMemo(() => participant?.tests?.twoMstSessions ?? [], [participant]);
  const selectedSignal = participant?.tests?.twoMstSignals?.[selectedSession] ?? [];
  const lastSession = sessions[sessions.length - 1];
  const isDemoParticipant = participant?.id === "example-maria-silva";
  const signalStart = selectedSignal[0]?.time ?? "0.0";
  const signalEnd = selectedSignal[selectedSignal.length - 1]?.time ?? "0.0";

  useEffect(() => {
    if (lastSession?.sessao) {
      setSelectedSession(lastSession.sessao);
    }
  }, [lastSession?.sessao]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100">
        <AppHeader title="Participante" subtitle="Carregando dados do participante..." />
        <main className="px-6 py-8">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="text-sm text-slate-500">Carregando participante...</div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-100">
        <AppHeader title="Participante" subtitle="Erro ao carregar os dados." />
        <main className="px-6 py-8">
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 shadow-sm">
            <p className="font-semibold text-red-700">Erro ao carregar participante</p>
            <p className="mt-1 text-sm text-red-600">{error}</p>
          </div>
        </main>
      </div>
    );
  }

  if (!participant) {
    return (
      <div className="min-h-screen bg-slate-100">
        <AppHeader title="Participante" subtitle="Registro não encontrado." />
        <main className="px-6 py-8">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="text-sm text-slate-500">Participante não encontrado.</div>
          </div>
        </main>
      </div>
    );
  }

  const cityState = [participant.city, participant.state].filter(Boolean).join(" / ") || "—";
  const has2Mst = Boolean(participant.tests?.has2MST && sessions.length);
  const show2MstDetails = openedTest === "2MST" && has2Mst;

  return (
    <div className="min-h-screen bg-slate-100">
      <AppHeader
        title={participant.name}
        subtitle={
          isDemoParticipant
            ? "Perfil mockado para demo com marcha estacionária e métricas biomecânicas."
            : has2Mst
              ? "Dados detalhados do participante e testes processados."
              : "Dados detalhados do participante."
        }
      />

      <main className="space-y-6 px-6 py-8">
        <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link
              to={routes.participants}
              className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900"
            >
              <ArrowLeft size={16} />
              Voltar para participantes
            </Link>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-black tracking-tight text-slate-900">
                {participant.name}
              </h1>
              {isDemoParticipant ? (
                <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-700">
                  Sujeito exemplo
                </span>
              ) : null}
            </div>
          </div>

          <IvcfCard score={participant.ivcfScore} ivcfClass={participant.ivcfClass} />
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DetailItem label="CPF" value={participant.cpf} />
          <DetailItem label="Idade" value={participant.age ? `${participant.age} anos` : "—"} />
          <DetailItem label="Sexo" value={participant.sex} />
          <DetailItem label="Cidade / Estado" value={cityState} />
          <DetailItem label="Data de nascimento" value={participant.dob} />
          <DetailItem label="Criado por" value={participant.createdByUserId} />
          <DetailItem label="Professor" value={participant.professorId} />
          <DetailItem label="Aluno dono" value={participant.studentId} />
        </section>

        {participant.blocks ? (
          <section>
            <Card className="p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-2">
                <ClipboardList size={18} className="text-blue-700" />
                <h2 className="text-lg font-black text-slate-900">Notas por bloco</h2>
              </div>

              <div className="grid gap-3 md:grid-cols-5">
                {Object.entries(participant.blocks).map(([block, score]) => (
                  <div
                    key={block}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                  >
                    <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      {block}
                    </div>
                    <div className="mt-2 text-2xl font-black text-blue-700">{score}</div>
                  </div>
                ))}
              </div>
            </Card>
          </section>
        ) : null}

        <section>
          <Card className="p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <UserRound size={18} className="text-blue-700" />
              <h2 className="text-lg font-black text-slate-900">Testes realizados</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <TestCard
                title="2MST"
                description={
                  has2Mst
                    ? isDemoParticipant
                      ? "Clique para abrir os dados de demonstração da marcha estacionária."
                      : "Clique para abrir os dados processados da marcha estacionária."
                    : "Sem dados detalhados no momento."
                }
                active={has2Mst}
                onClick={
                  has2Mst
                    ? () => setOpenedTest((prev) => (prev === "2MST" ? null : "2MST"))
                    : undefined
                }
              />

              <TestCard title="SL-30s" description="Sem dados detalhados no momento." />
              <TestCard title="UTT" description="Sem dados detalhados no momento." />
              <TestCard title="TUG" description="Sem dados detalhados no momento." />
              <TestCard title="LOS" description="Sem dados detalhados no momento." />
            </div>
          </Card>
        </section>

        {show2MstDetails ? (
          <>
            <section className="flex items-center gap-2">
              <Footprints size={18} className="text-blue-700" />
              <h2 className="text-xl font-black text-slate-900">2MST — Marcha estacionária</h2>
            </section>

            <section className="grid gap-4 md:grid-cols-4">
              <Card className="p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                      Última sessão
                    </p>
                    <div className="mt-2 text-3xl font-black text-slate-900">
                      {lastSession?.sessao ?? "—"}
                    </div>
                    <p className="mt-2 text-sm text-slate-500">{lastSession?.date ?? "—"}</p>
                  </div>
                  <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3 text-blue-700">
                    <CalendarDays size={20} />
                  </div>
                </div>
              </Card>

              <Card className="p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                      Repetições
                    </p>
                    <div className="mt-2 text-3xl font-black text-slate-900">
                      {lastSession?.repeticoes ?? "—"}
                    </div>
                    <p className="mt-2 text-sm text-slate-500">2 minutos</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-emerald-700">
                    <Activity size={20} />
                  </div>
                </div>
              </Card>

              <Card className="p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                      Cadência
                    </p>
                    <div className="mt-2 text-3xl font-black text-slate-900">
                      {lastSession?.cadencia ?? "—"}
                    </div>
                    <p className="mt-2 text-sm text-slate-500">ciclos/min</p>
                  </div>
                  <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3 text-amber-700">
                    <BarChart3 size={20} />
                  </div>
                </div>
              </Card>

              <Card className="p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                      Vel. angular média
                    </p>
                    <div className="mt-2 text-3xl font-black text-slate-900">
                      {lastSession?.velAngularMedia ?? "—"}
                    </div>
                    <p className="mt-2 text-sm text-slate-500">°/s</p>
                  </div>
                  <div className="rounded-2xl border border-violet-100 bg-violet-50 p-3 text-violet-700">
                    <Activity size={20} />
                  </div>
                </div>
              </Card>
            </section>

            <section>
              <Card className="p-6 shadow-sm">
                <div className="mb-5 flex items-center gap-2">
                  <Activity size={18} className="text-emerald-600" />
                  <h2 className="text-lg font-black text-slate-900">
                    2MST — evolução de repetições
                  </h2>
                </div>

                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sessions} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 3" />
                      <XAxis
                        dataKey="sessao"
                        tick={{ fill: "#64748b", fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value) => `S${value}`}
                      />
                      <YAxis
                        tick={{ fill: "#64748b", fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 12,
                          border: "1px solid #e2e8f0",
                          boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
                        }}
                        labelFormatter={(label) => `Sessão ${label}`}
                      />
                      <Line
                        type="monotone"
                        dataKey="repeticoes"
                        stroke="#2563eb"
                        strokeWidth={3}
                        dot={{ r: 4, fill: "#2563eb" }}
                        activeDot={{ r: 7 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <TinyMetricChart
                title="Cadência"
                data={sessions}
                dataKey="cadencia"
                unit="ciclos/min"
                color="#f59e0b"
              />
              <TinyMetricChart
                title="Velocidade angular média"
                data={sessions}
                dataKey="velAngularMedia"
                unit="°/s"
                color="#8b5cf6"
              />
              <TinyMetricChart
                title="CV velocidade"
                data={sessions}
                dataKey="cvVelocidade"
                unit="%"
                color="#ec4899"
              />
              <TinyMetricChart
                title="Tempo médio ciclo"
                data={sessions}
                dataKey="tempoMedioCiclo"
                unit="s"
                color="#3b82f6"
              />
              <TinyMetricChart
                title="CV tempo ciclo"
                data={sessions}
                dataKey="cvTempoCiclo"
                unit="%"
                color="#14b8a6"
              />
              <TinyMetricChart
                title="Velocidade máxima"
                data={sessions}
                dataKey="velMaxima"
                unit="°/s"
                color="#ef4444"
              />
              <TinyMetricChart
                title="Velocidade mínima"
                data={sessions}
                dataKey="velMinima"
                unit="°/s"
                color="#6366f1"
              />
            </section>

            <section>
              <Card className="p-6 shadow-sm">
                <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-2">
                    <Activity size={18} className="text-rose-600" />
                    <h2 className="text-lg font-black text-slate-900">
                      Série temporal — Giroscópio X
                    </h2>
                  </div>

                  <div className="relative w-full md:w-auto">
                    <select
                      value={selectedSession}
                      onChange={(e) => setSelectedSession(Number(e.target.value))}
                      className="w-full appearance-none rounded-2xl border border-slate-200 bg-white py-3 pl-4 pr-10 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 md:min-w-[220px]"
                    >
                      {sessions.map((session) => (
                        <option key={session.sessao} value={session.sessao}>
                          Sessão {session.sessao} — {session.repeticoes} ciclos
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={16}
                      className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                  </div>
                </div>

                <div className="rounded-3xl border border-blue-100 bg-blue-50/40 p-3">
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={selectedSignal}>
                        <CartesianGrid stroke="#dbeafe" strokeDasharray="2 2" />
                        <XAxis
                          dataKey="time"
                          tick={{ fill: "#64748b", fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                          minTickGap={30}
                        />
                        <YAxis hide />
                        <Tooltip
                          contentStyle={{
                            borderRadius: 12,
                            border: "1px solid #e2e8f0",
                            boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
                          }}
                          labelFormatter={(value) => `${value}s`}
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="#dc2626"
                          strokeWidth={2}
                          dot={false}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="mt-3 flex justify-between text-xs text-slate-400">
                  <span>{signalStart}s</span>
                  <span>Tempo (s)</span>
                  <span>{signalEnd}s</span>
                </div>
              </Card>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}