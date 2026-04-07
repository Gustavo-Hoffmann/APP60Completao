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
import { supabase } from "../../../lib/supabase/client";
import { routes } from "../../../navigation/routes";
import type { IvcfSession, Participant, Sl30sSession, TwoMstSession } from "../../../types/participant";
import { getParticipantById } from "../services/participants";

type OpenedTest = "2MST" | "SL30S" | "IVCF20" | null;

function formatDisplayValue(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return "—";
  return value;
}

function formatOptionalNumber(value?: number | null, decimals = 1) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return Number(value).toFixed(decimals);
}

function DetailItem({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <Card className="p-4 shadow-sm">
      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-slate-800">{formatDisplayValue(value)}</div>
    </Card>
  );
}

function TinyMetricChart<T extends { sessao: number }>({
  title,
  data,
  dataKey,
  unit,
  color,
}: {
  title: string;
  data: T[];
  dataKey: string;
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
              cursor={{ fill: "rgba(59, 130, 246, 0.14)" }}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #e2e8f0",
                boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
              }}
              formatter={(value) => [`${value}`, title]}
              labelFormatter={(label) => `Sessão ${label}`}
            />
            <Bar dataKey={dataKey} radius={[8, 8, 0, 0]}>
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
        : value === "Robusto"
          ? "bg-emerald-100 text-emerald-700 border-emerald-200"
          : "bg-slate-100 text-slate-600 border-slate-200";

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${styles}`}>
      {value || "Sem classificação"}
    </span>
  );
}


function Ivcf20Section({
  sessions,
  selectedSession,
  onSelectSession,
}: {
  sessions: IvcfSession[];
  selectedSession: number;
  onSelectSession: (session: number) => void;
}) {
  const lastSession = sessions[sessions.length - 1];
  const selectedData =
    sessions.find((session) => session.sessao === selectedSession) ?? lastSession;
  const selectedBlocks = Object.entries(selectedData?.blocks ?? {});
  const orderedSessions = [...sessions].sort((a, b) => b.sessao - a.sessao);

  return (
    <section id="ivcf20-section" className="scroll-mt-24">
      <Card className="p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <ClipboardList size={18} className="text-blue-700" />
              <h2 className="text-lg font-black text-slate-900">IVCF-20</h2>
            </div>
            <p className="text-sm text-slate-500">
              Histórico e classificação por blocos da sessão selecionada.
            </p>
          </div>

          {sessions.length > 1 ? (
            <label className="block min-w-[260px]">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                Sessão selecionada
              </span>

              <div className="relative">
                <select
                  value={selectedData?.sessao ?? selectedSession}
                  onChange={(e) => onSelectSession(Number(e.target.value))}
                  className="h-12 w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 pr-10 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                >
                  {orderedSessions.map((session) => (
                    <option key={session.sessao} value={session.sessao}>
                      Sessão {session.sessao} — {session.scoreTotal} pontos
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
                  Sessão em foco
                </p>
                <div className="mt-2 text-3xl font-black text-slate-900">
                  {selectedData?.sessao ?? "—"}
                </div>
                <p className="mt-2 text-sm text-slate-500">{selectedData?.date ?? "—"}</p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-slate-700">
                <ClipboardList size={20} />
              </div>
            </div>
          </Card>

          <Card className="p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                  Pontuação total
                </p>
                <div className="mt-2 text-3xl font-black text-slate-900">
                  {selectedData?.scoreTotal ?? "—"}
                </div>
                <p className="mt-2 text-sm text-slate-500">Sessão selecionada</p>
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3 text-blue-700">
                <BarChart3 size={20} />
              </div>
            </div>
          </Card>

          <Card className="p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                  Classificação geral
                </p>

                <div className="mt-3">
                  <IvcfBadge value={selectedData?.classification} />
                </div>
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3 text-blue-700">
                <Activity size={20} />
              </div>
            </div>
          </Card>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[1.05fr_1.95fr]">
          <Card className="p-5 shadow-sm">
            <div className="mb-4">
              <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">
                Histórico de sessões
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Sessões clicáveis para trocar o foco. Sem gráfico de barra feioso.
              </p>
            </div>

            <div className="space-y-3">
              {orderedSessions.map((session) => {
                const isActive = session.sessao === selectedData?.sessao;

                return (
                  <button
                    key={session.sessao}
                    type="button"
                    onClick={() => onSelectSession(session.sessao)}
                    className={[
                      "w-full rounded-2xl border px-4 py-4 text-left transition",
                      isActive
                        ? "border-blue-300 bg-blue-50 shadow-sm"
                        : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-black text-slate-900">
                          Sessão {session.sessao}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">{session.date}</div>
                      </div>

                      <IvcfBadge value={session.classification} />
                    </div>

                    <div className="mt-4 flex items-end justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                          Pontuação
                        </div>
                        <div className="mt-1 text-2xl font-black text-blue-700">
                          {session.scoreTotal}
                        </div>
                      </div>

                      {isActive ? (
                        <span className="rounded-full bg-blue-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                          Em foco
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card className="p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">
                  Classificação por blocos
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Sessão {selectedData?.sessao ?? "—"} • {selectedData?.date ?? "—"}
                </p>
              </div>

              <IvcfBadge value={selectedData?.classification} />
            </div>

            {selectedBlocks.length ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {selectedBlocks.map(([block, score]) => (
                  <div
                    key={`${selectedData?.sessao ?? "s"}-${block}`}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                  >
                    <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      {block}
                    </div>
                    <div className="mt-2 text-2xl font-black text-blue-700">{score}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                Nenhum bloco detalhado foi encontrado nesta sessão.
              </div>
            )}
          </Card>
        </div>
      </Card>
    </section>
  );
}

function IvcfCard({
  score,
  ivcfClass,
  date,
  onClick,
}: {
  score?: number;
  ivcfClass?: Participant["ivcfClass"];
  date?: string;
  onClick?: () => void;
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
        : ivcfClass === "Robusto"
          ? {
              wrap: "border-emerald-200 bg-emerald-50/70",
              title: "text-emerald-700",
              value: "text-emerald-700",
            }
          : {
              wrap: "border-slate-200 bg-slate-50",
              title: "text-slate-500",
              value: "text-slate-700",
            };

  const content = (
    <>
      <div className={`text-xs font-bold uppercase tracking-[0.18em] ${tone.title}`}>
        Status clínico
      </div>
      <div className="mt-3 flex items-center justify-between gap-4">
        <div>
          <div className="text-sm text-slate-500">Último IVCF-20</div>
          <div className={`mt-2 text-3xl font-black ${tone.value}`}>{score ?? "—"}</div>
          <div className="mt-2 text-sm text-slate-500">{date ?? "Sem coleta processada"}</div>
        </div>
        <IvcfBadge value={ivcfClass} />
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="text-left"
      >
        <Card
          className={`min-w-[240px] p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${tone.wrap}`}
        >
          {content}
        </Card>
      </button>
    );
  }

  return <Card className={`min-w-[240px] p-5 shadow-sm ${tone.wrap}`}>{content}</Card>;
}

type StatusTone = {
  wrap: string;
  icon: string;
  title: string;
  value: string;
  sub: string;
};

function StatusCard({
  label,
  value,
  subtitle,
  tone,
}: {
  label: string;
  value?: string | number | null;
  subtitle: string;
  tone: StatusTone;
}) {
  return (
    <Card className={`p-5 shadow-sm ${tone.wrap}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={`text-xs font-bold uppercase tracking-[0.18em] ${tone.title}`}>
            {label}
          </p>
          <div className={`mt-2 text-xl font-black leading-tight ${tone.value}`}>
            {formatDisplayValue(value)}
          </div>
          <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
        </div>

        <div className={`rounded-2xl border p-3 ${tone.icon}`}>
          <BarChart3 size={20} />
        </div>
      </div>
    </Card>
  );
}

function StrategyCard({ strategy }: { strategy?: TwoMstSession["strategy"] }) {
  const isDefined = strategy && strategy !== "Indefinida";

  const tone = isDefined
    ? {
        wrap: "border-blue-200 bg-blue-50",
        icon: "border-blue-100 bg-white text-blue-700",
        title: "text-blue-700",
        value: "text-blue-800",
        sub: "Estratégia identificada",
      }
    : {
        wrap: "border-slate-200 bg-slate-100",
        icon: "border-slate-200 bg-white text-slate-500",
        title: "text-slate-500",
        value: "text-slate-700",
        sub: "Estratégia não definida",
      };

  return (
    <StatusCard
      label="Estratégia"
      value={strategy ?? "—"}
      subtitle={tone.sub}
      tone={tone}
    />
  );
}

function GodaCard({ value }: { value?: Sl30sSession["goda"] }) {
  const isDefined = value && value !== "—";

  const tone = isDefined
    ? {
        wrap: "border-blue-200 bg-blue-50",
        icon: "border-blue-100 bg-white text-blue-700",
        title: "text-blue-700",
        value: "text-blue-800",
        sub: "Padrão temporal identificado",
      }
    : {
        wrap: "border-slate-200 bg-slate-100",
        icon: "border-slate-200 bg-white text-slate-500",
        title: "text-slate-500",
        value: "text-slate-700",
        sub: "Sem classificação disponível",
      };

  return <StatusCard label="Classificação Goda" value={value ?? "—"} subtitle={tone.sub} tone={tone} />;
}

function RikliJonesCard({
  value,
  percentile,
  zScore,
  ageBin,
}: {
  value?: Sl30sSession["rikliJones"];
  percentile?: number | null;
  zScore?: number | null;
  ageBin?: string;
}) {
  const tone =
    value === "Acima da média"
      ? {
          wrap: "border-emerald-200 bg-emerald-50",
          icon: "border-emerald-100 bg-white text-emerald-700",
          title: "text-emerald-700",
          value: "text-emerald-800",
        }
      : value === "Na média"
        ? {
            wrap: "border-blue-200 bg-blue-50",
            icon: "border-blue-100 bg-white text-blue-700",
            title: "text-blue-700",
            value: "text-blue-800",
          }
        : value === "Abaixo da média"
          ? {
              wrap: "border-amber-200 bg-amber-50",
              icon: "border-amber-100 bg-white text-amber-700",
              title: "text-amber-700",
              value: "text-amber-800",
            }
          : {
              wrap: "border-slate-200 bg-slate-100",
              icon: "border-slate-200 bg-white text-slate-500",
              title: "text-slate-500",
              value: "text-slate-700",
            };

  const percentileLabel = formatOptionalNumber(percentile, 1);
  const zScoreLabel = formatOptionalNumber(zScore, 2);

  const subtitle = percentileLabel
    ? `Percentil ${percentileLabel}${ageBin ? ` • ${ageBin}` : ""}`
    : zScoreLabel
      ? `z = ${zScoreLabel}${ageBin ? ` • ${ageBin}` : ""}`
      : ageBin
        ? `Faixa etária ${ageBin}`
        : "Comparação normativa";

  return (
    <StatusCard
      label="Rikli-Jones"
      value={value ?? "—"}
      subtitle={subtitle}
      tone={{
        ...tone,
        sub: subtitle,
      }}
    />
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
  const [relatedNames, setRelatedNames] = useState<Record<string, string>>({});

  const [openedTest, setOpenedTest] = useState<OpenedTest>(null);
  const [selectedTwoMstSession, setSelectedTwoMstSession] = useState<number>(1);
  const [selectedSl30sSession, setSelectedSl30sSession] = useState<number>(1);
  const [selectedIvcfSession, setSelectedIvcfSession] = useState<number>(1);

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

  useEffect(() => {
    let mounted = true;

    async function loadRelatedNames() {
      if (!participant) return;

      const ids = Array.from(
        new Set(
          [participant.createdByUserId, participant.professorId, participant.studentId]
            .filter(Boolean)
            .map((value) => String(value)),
        ),
      );

      if (!ids.length) {
        if (mounted) setRelatedNames({});
        return;
      }

      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", ids);

      if (!mounted) return;
      if (profileError) {
        setRelatedNames({});
        return;
      }

      const nextNames: Record<string, string> = {};
      for (const row of data ?? []) {
        const item = row as { id?: string; name?: string | null };
        if (item.id) {
          nextNames[item.id] = item.name?.trim() || item.id;
        }
      }
      setRelatedNames(nextNames);
    }

    void loadRelatedNames();

    return () => {
      mounted = false;
    };
  }, [participant]);

  const twoMstSessions = useMemo(() => participant?.tests?.twoMstSessions ?? [], [participant]);
  const sl30sSessions = useMemo(() => participant?.tests?.sl30sSessions ?? [], [participant]);
  const ivcfSessions = useMemo(() => participant?.tests?.ivcfSessions ?? [], [participant]);

  const selectedTwoMstSignal =
    participant?.tests?.twoMstSignals?.[selectedTwoMstSession] ?? [];
  const selectedSl30sSignal =
    participant?.tests?.sl30sSignals?.[selectedSl30sSession] ?? [];

  const lastTwoMstSession = twoMstSessions[twoMstSessions.length - 1];
  const lastSl30sSession = sl30sSessions[sl30sSessions.length - 1];
  const lastIvcfSession = ivcfSessions[ivcfSessions.length - 1];

  const isDemoParticipant = participant?.id === "example-maria-silva";

  useEffect(() => {
    if (lastTwoMstSession?.sessao) {
      setSelectedTwoMstSession(lastTwoMstSession.sessao);
    }
  }, [lastTwoMstSession?.sessao]);

  useEffect(() => {
    if (lastSl30sSession?.sessao) {
      setSelectedSl30sSession(lastSl30sSession.sessao);
    }
  }, [lastSl30sSession?.sessao]);

  useEffect(() => {
    if (lastIvcfSession?.sessao) {
      setSelectedIvcfSession(lastIvcfSession.sessao);
    }
  }, [lastIvcfSession?.sessao]);

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
  const createdByName = relatedNames[participant.createdByUserId] ?? participant.createdByUserId;
  const professorName = participant.professorId
    ? (relatedNames[participant.professorId] ?? participant.professorId)
    : null;
  const studentName = participant.studentId
    ? (relatedNames[participant.studentId] ?? participant.studentId)
    : null;

  const has2Mst = Boolean(participant.tests?.has2MST && twoMstSessions.length);
  const hasSl30s = Boolean(participant.tests?.hasSL30S && sl30sSessions.length);
  const hasIvcf = Boolean(participant.tests?.hasIVCF20 && ivcfSessions.length);

  const showIvcfDetails = openedTest === "IVCF20" && hasIvcf;
  const show2MstDetails = openedTest === "2MST" && has2Mst;
  const showSl30sDetails = openedTest === "SL30S" && hasSl30s;

  function handleIvcfCardClick() {
    if (!hasIvcf) return;

    const isOpening = openedTest !== "IVCF20";
    setOpenedTest(isOpening ? "IVCF20" : null);

    if (isOpening) {
      window.setTimeout(() => {
        document.getElementById("ivcf20-section")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 80);
    }
  }

  const twoMstSignalStart = selectedTwoMstSignal.length
    ? selectedTwoMstSignal[0].time.toFixed(1)
    : "0.0";
  const twoMstSignalEnd = selectedTwoMstSignal.length
    ? selectedTwoMstSignal[selectedTwoMstSignal.length - 1].time.toFixed(1)
    : "0.0";

  const sl30sSignalStart = selectedSl30sSignal.length
    ? selectedSl30sSignal[0].time.toFixed(1)
    : "0.0";
  const sl30sSignalEnd = selectedSl30sSignal.length
    ? selectedSl30sSignal[selectedSl30sSignal.length - 1].time.toFixed(1)
    : "0.0";

  return (
    <div className="min-h-screen bg-slate-100">
      <AppHeader
        title={participant.name}
        subtitle={
          isDemoParticipant
            ? "Perfil mockado para demo com marcha estacionária e métricas biomecânicas."
            : has2Mst || hasSl30s || hasIvcf
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

          <IvcfCard
            score={participant.ivcfScore}
            ivcfClass={participant.ivcfClass}
            date={lastIvcfSession?.date}
            onClick={hasIvcf ? handleIvcfCardClick : undefined}
          />
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DetailItem label="CPF" value={participant.cpf} />
          <DetailItem label="Idade" value={participant.age ? `${participant.age} anos` : "—"} />
          <DetailItem label="Sexo" value={participant.sex} />
          <DetailItem label="Cidade / Estado" value={cityState} />
          <DetailItem label="Data de nascimento" value={participant.dob} />
          <DetailItem label="Criado por" value={createdByName} />
          <DetailItem label="Professor" value={professorName} />
          <DetailItem label="Aluno/Pesquisador" value={studentName} />
        </section>

        {showIvcfDetails ? (
          <Ivcf20Section
            sessions={ivcfSessions}
            selectedSession={selectedIvcfSession}
            onSelectSession={setSelectedIvcfSession}
          />
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

              <TestCard
                title="SL-30s"
                description={
                  hasSl30s
                    ? "Clique para abrir os dados processados do sentar e levantar."
                    : "Sem dados detalhados no momento."
                }
                active={hasSl30s}
                onClick={
                  hasSl30s
                    ? () => setOpenedTest((prev) => (prev === "SL30S" ? null : "SL30S"))
                    : undefined
                }
              />

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

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <Card className="p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                      Última sessão
                    </p>
                    <div className="mt-2 text-3xl font-black text-slate-900">
                      {lastTwoMstSession?.sessao ?? "—"}
                    </div>
                    <p className="mt-2 text-sm text-slate-500">{lastTwoMstSession?.date ?? "—"}</p>
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
                      {lastTwoMstSession?.repeticoes ?? "—"}
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
                      {lastTwoMstSession?.cadencia ?? "—"}
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
                      {lastTwoMstSession?.velAngularMedia ?? "—"}
                    </div>
                    <p className="mt-2 text-sm text-slate-500">°/s</p>
                  </div>
                  <div className="rounded-2xl border border-violet-100 bg-violet-50 p-3 text-violet-700">
                    <Activity size={20} />
                  </div>
                </div>
              </Card>

              <StrategyCard strategy={lastTwoMstSession?.strategy} />
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
                    <LineChart
                      data={twoMstSessions}
                      margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                    >
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
                data={twoMstSessions}
                dataKey="cadencia"
                unit="ciclos/min"
                color="#f59e0b"
              />
              <TinyMetricChart
                title="Velocidade angular média"
                data={twoMstSessions}
                dataKey="velAngularMedia"
                unit="°/s"
                color="#8b5cf6"
              />
              <TinyMetricChart
                title="CV velocidade"
                data={twoMstSessions}
                dataKey="cvVelocidade"
                unit="%"
                color="#ec4899"
              />
              <TinyMetricChart
                title="Tempo médio ciclo"
                data={twoMstSessions}
                dataKey="tempoMedioCiclo"
                unit="s"
                color="#3b82f6"
              />
              <TinyMetricChart
                title="CV tempo ciclo"
                data={twoMstSessions}
                dataKey="cvTempoCiclo"
                unit="%"
                color="#14b8a6"
              />
              <TinyMetricChart
                title="Velocidade máxima"
                data={twoMstSessions}
                dataKey="velMaxima"
                unit="°/s"
                color="#ef4444"
              />
              <TinyMetricChart
                title="Velocidade mínima"
                data={twoMstSessions}
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
                      value={selectedTwoMstSession}
                      onChange={(e) => setSelectedTwoMstSession(Number(e.target.value))}
                      className="w-full appearance-none rounded-2xl border border-slate-200 bg-white py-3 pl-4 pr-10 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 md:min-w-[220px]"
                    >
                      {twoMstSessions.map((session) => (
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
                      <LineChart data={selectedTwoMstSignal}>
                        <CartesianGrid stroke="#dbeafe" strokeDasharray="2 2" />

                        <XAxis
                          dataKey="time"
                          type="number"
                          domain={["dataMin", "dataMax"]}
                          tick={{ fill: "#64748b", fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(value) => `${Number(value).toFixed(1)}`}
                        />

                        <YAxis
                          tick={{ fill: "#64748b", fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                          width={48}
                        />

                        <Tooltip
                          contentStyle={{
                            borderRadius: 12,
                            border: "1px solid #e2e8f0",
                            boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
                          }}
                          labelFormatter={(value) => `${Number(value).toFixed(2)} s`}
                          formatter={(value, name) => {
                            if (name === "value") return [`${value} °/s`, "Sinal"];
                            if (name === "phonePeak") return [`${value} °/s`, "Picos phone"];
                            if (name === "predPeak") return [`${value} °/s`, "Picos calibrados"];
                            return [String(value), String(name)];
                          }}
                        />

                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="#ff4d8d"
                          strokeWidth={2.8}
                          dot={false}
                          isAnimationActive={false}
                        />

                        <Line
                          type="linear"
                          dataKey="phonePeak"
                          stroke="transparent"
                          connectNulls={false}
                          isAnimationActive={false}
                          activeDot={false}
                          dot={{
                            r: 3,
                            fill: "#111827",
                            stroke: "#ffffff",
                            strokeWidth: 1.2,
                          }}
                        />

                        <Line
                          type="linear"
                          dataKey="predPeak"
                          stroke="transparent"
                          connectNulls={false}
                          isAnimationActive={false}
                          activeDot={false}
                          dot={{
                            r: 4,
                            fill: "#ffffff",
                            stroke: "#2563eb",
                            strokeWidth: 2,
                          }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="mt-3 flex justify-between text-xs text-slate-400">
                  <span>{twoMstSignalStart}s</span>
                  <span>Tempo (s)</span>
                  <span>{twoMstSignalEnd}s</span>
                </div>
              </Card>
            </section>
          </>
        ) : null}

        {showSl30sDetails ? (
          <>
            <section className="flex items-center gap-2">
              <Activity size={18} className="text-blue-700" />
              <h2 className="text-xl font-black text-slate-900">SL-30s — Sentar e levantar</h2>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <Card className="p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                      Última sessão
                    </p>
                    <div className="mt-2 text-3xl font-black text-slate-900">
                      {lastSl30sSession?.sessao ?? "—"}
                    </div>
                    <p className="mt-2 text-sm text-slate-500">{lastSl30sSession?.date ?? "—"}</p>
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
                      {lastSl30sSession?.repeticoes ?? "—"}
                    </div>
                    <p className="mt-2 text-sm text-slate-500">30 segundos</p>
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
                      Potência média
                    </p>
                    <div className="mt-2 text-3xl font-black text-slate-900">
                      {lastSl30sSession?.potenciaMedia ?? "—"}
                    </div>
                    <p className="mt-2 text-sm text-slate-500">W</p>
                  </div>
                  <div className="rounded-2xl border border-violet-100 bg-violet-50 p-3 text-violet-700">
                    <BarChart3 size={20} />
                  </div>
                </div>
              </Card>

              <RikliJonesCard
                value={lastSl30sSession?.rikliJones}
                percentile={lastSl30sSession?.percentile}
                zScore={lastSl30sSession?.zScore}
                ageBin={lastSl30sSession?.ageBin}
              />

              <GodaCard value={lastSl30sSession?.goda} />
            </section>

            <section>
              <Card className="p-6 shadow-sm">
                <div className="mb-5 flex items-center gap-2">
                  <Activity size={18} className="text-emerald-600" />
                  <h2 className="text-lg font-black text-slate-900">
                    SL-30s — evolução de repetições
                  </h2>
                </div>

                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={sl30sSessions}
                      margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                    >
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
                title="Potência média"
                data={sl30sSessions}
                dataKey="potenciaMedia"
                unit="W"
                color="#8b5cf6"
              />
              <TinyMetricChart
                title="Trabalho total"
                data={sl30sSessions}
                dataKey="trabalhoTotal"
                unit="J"
                color="#14b8a6"
              />
              <TinyMetricChart
                title="Trabalho por repetição"
                data={sl30sSessions}
                dataKey="trabalhoPorRep"
                unit="J"
                color="#f59e0b"
              />
              <TinyMetricChart
                title="Tempo médio ciclo"
                data={sl30sSessions}
                dataKey="tempoMedioCiclo"
                unit="s"
                color="#3b82f6"
              />
              <TinyMetricChart
                title="Tempo médio levantar"
                data={sl30sSessions}
                dataKey="tempoMedioLevantar"
                unit="s"
                color="#22c55e"
              />
              <TinyMetricChart
                title="Tempo médio sentar"
                data={sl30sSessions}
                dataKey="tempoMedioSentar"
                unit="s"
                color="#ef4444"
              />
              <TinyMetricChart
                title="Frequência média"
                data={sl30sSessions}
                dataKey="frequenciaMedia"
                unit="Hz"
                color="#0ea5e9"
              />
              <TinyMetricChart
                title="CV tempo ciclo"
                data={sl30sSessions}
                dataKey="cvTempoCiclo"
                unit="%"
                color="#ec4899"
              />
              <TinyMetricChart
                title="Amplitude do sinal"
                data={sl30sSessions}
                dataKey="amplitudeSinal"
                unit="°"
                color="#6366f1"
              />
              <TinyMetricChart
                title="Vel. flexão levantar"
                data={sl30sSessions}
                dataKey="velFlexLevantar"
                unit="°/s"
                color="#16a34a"
              />
              <TinyMetricChart
                title="Vel. extensão levantar"
                data={sl30sSessions}
                dataKey="velExtLevantar"
                unit="°/s"
                color="#0891b2"
              />
              <TinyMetricChart
                title="Vel. flexão sentar"
                data={sl30sSessions}
                dataKey="velFlexSentar"
                unit="°/s"
                color="#f97316"
              />
              <TinyMetricChart
                title="Vel. extensão sentar"
                data={sl30sSessions}
                dataKey="velExtSentar"
                unit="°/s"
                color="#7c3aed"
              />
            </section>

            <section>
              <Card className="p-6 shadow-sm">
                <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-2">
                    <Activity size={18} className="text-emerald-700" />
                    <h2 className="text-lg font-black text-slate-900">
                      Série temporal — Ângulo do tronco
                    </h2>
                  </div>

                  <div className="relative w-full md:w-auto">
                    <select
                      value={selectedSl30sSession}
                      onChange={(e) => setSelectedSl30sSession(Number(e.target.value))}
                      className="w-full appearance-none rounded-2xl border border-slate-200 bg-white py-3 pl-4 pr-10 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 md:min-w-[220px]"
                    >
                      {sl30sSessions.map((session) => (
                        <option key={session.sessao} value={session.sessao}>
                          Sessão {session.sessao} — {session.repeticoes} repetições
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
                      <LineChart data={selectedSl30sSignal}>
                        <CartesianGrid stroke="#dbeafe" strokeDasharray="2 2" />

                        <XAxis
                          dataKey="time"
                          type="number"
                          domain={["dataMin", "dataMax"]}
                          tick={{ fill: "#64748b", fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(value) => `${Number(value).toFixed(1)}`}
                        />

                        <YAxis
                          tick={{ fill: "#64748b", fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                          width={48}
                        />

                        <Tooltip
                          contentStyle={{
                            borderRadius: 12,
                            border: "1px solid #e2e8f0",
                            boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
                          }}
                          labelFormatter={(value) => `${Number(value).toFixed(2)} s`}
                          formatter={(value, name) => {
                            if (name === "value") return [`${value} °`, "Sinal"];
                            if (name === "peak") return [`${value} °`, "Picos"];
                            if (name === "valley") return [`${value} °`, "Vales"];
                            return [String(value), String(name)];
                          }}
                        />

                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="#ff4d8d"
                          strokeWidth={2.8}
                          dot={false}
                          isAnimationActive={false}
                        />

                        <Line
                          type="linear"
                          dataKey="peak"
                          stroke="transparent"
                          connectNulls={false}
                          isAnimationActive={false}
                          activeDot={false}
                          dot={{
                            r: 3,
                            fill: "#111827",
                            stroke: "#ffffff",
                            strokeWidth: 1.2,
                          }}
                        />

                        <Line
                          type="linear"
                          dataKey="valley"
                          stroke="transparent"
                          connectNulls={false}
                          isAnimationActive={false}
                          activeDot={false}
                          dot={{
                            r: 4,
                            fill: "#ffffff",
                            stroke: "#111827",
                            strokeWidth: 2,
                          }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="mt-3 flex justify-between text-xs text-slate-400">
                  <span>{sl30sSignalStart}s</span>
                  <span>Tempo (s)</span>
                  <span>{sl30sSignalEnd}s</span>
                </div>
              </Card>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}