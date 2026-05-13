import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Footprints,
  Pencil,
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
import { TestExportActions } from "../../../components/exports/TestExportActions";
import { useAuth } from "../../../contexts/AuthContext";
import { apiJson } from "../../../lib/api/client";
import { routes } from "../../../navigation/routes";
import type { Role } from "../../../types/auth";
import type { IvcfSession, Participant, Sl30sSession, TwoMstSession } from "../../../types/participant";
import { getParticipantById } from "../services/participants";
import { ActSedentarySection } from "../../questionnaires/components/ActSedentarySection";
import { FesiSection } from "../../questionnaires/components/FesiSection";
import {
  fesiTone,
  ivcfTone,
  QuestionnaireStatusCard,
} from "../../questionnaires/components/QuestionnaireStatusCard";

type OpenedTest = "2MST" | "SL30S" | "IVCF20" | "FESI" | "ACT_SEDENTARY" | null;
type MetricsFilterMode = "session" | "date";

/** Mesmo conjunto de papéis que acessam a lista de participantes no router. */
const PARTICIPANT_AREA_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "GESTOR", "SUPERVISOR", "AVALIADOR"];

function formatDisplayValue(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return "—";
  return value;
}

function formatShortDate(value?: string | null, locale = "pt-BR") {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatOptionalNumber(value?: number | null, decimals = 1) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return Number(value).toFixed(decimals);
}

function DetailItem({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <Card className="h-full p-3 shadow-sm">
      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </div>
      <div className="mt-1.5 text-sm font-semibold text-slate-800">{formatDisplayValue(value)}</div>
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
  const { t } = useTranslation("modules");
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
              labelFormatter={(label) => t("participantDetail.sessionLabel", { session: label })}
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

function IvcfBadge({
  value,
  emptyLabel,
}: {
  value?: Participant["ivcfClass"];
  emptyLabel: string;
}) {
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
      {value || emptyLabel}
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
  const { t } = useTranslation("modules");
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
              {t("participantDetail.ivcf20.subtitle")}
            </p>
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
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                  {t("participantDetail.lastSession")}
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
                  {t("participantDetail.sessionInFocus")}
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
                  {t("participantDetail.totalScore")}
                </p>
                <div className="mt-2 text-3xl font-black text-slate-900">
                  {selectedData?.scoreTotal ?? "—"}
                </div>
                <p className="mt-2 text-sm text-slate-500">{t("participantDetail.selectedSessionHint")}</p>
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
                  {t("participantDetail.overallClassification")}
                </p>

                <div className="mt-3">
                  <IvcfBadge value={selectedData?.classification} emptyLabel={t("participantDetail.unclassified")} />
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
                {t("participantDetail.ivcf20.sessionHistoryTitle")}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {t("participantDetail.ivcf20.sessionHistorySubtitle")}
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
                      {t("participantDetail.sessionLabel", { session: session.sessao })}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">{session.date}</div>
                      </div>

                      <IvcfBadge value={session.classification} emptyLabel={t("participantDetail.unclassified")} />
                    </div>

                    <div className="mt-4 flex items-end justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                          {t("participantDetail.score")}
                        </div>
                        <div className="mt-1 text-2xl font-black text-blue-700">
                          {session.scoreTotal}
                        </div>
                      </div>

                      {isActive ? (
                        <span className="rounded-full bg-blue-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                          {t("participantDetail.inFocus")}
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
                  {t("participantDetail.ivcf20.blockClassificationTitle")}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {t("participantDetail.sessionDotDate", {
                    session: selectedData?.sessao ?? "—",
                    date: selectedData?.date ?? "—",
                  })}
                </p>
              </div>

              <IvcfBadge value={selectedData?.classification} emptyLabel={t("participantDetail.unclassified")} />
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
                {t("participantDetail.ivcf20.noBlocks")}
              </div>
            )}
          </Card>
        </div>
      </Card>
    </section>
  );
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
  const { t } = useTranslation("modules");
  const isDefined = strategy && strategy !== "Indefinida";

  const tone = isDefined
    ? {
        wrap: "border-blue-200 bg-blue-50",
        icon: "border-blue-100 bg-white text-blue-700",
        title: "text-blue-700",
        value: "text-blue-800",
        sub: t("participantDetail.strategy.definedSub"),
      }
    : {
        wrap: "border-slate-200 bg-slate-100",
        icon: "border-slate-200 bg-white text-slate-500",
        title: "text-slate-500",
        value: "text-slate-700",
        sub: t("participantDetail.strategy.undefinedSub"),
      };

  return (
    <StatusCard
      label={t("participantDetail.strategy.label")}
      value={strategy ?? "—"}
      subtitle={tone.sub}
      tone={tone}
    />
  );
}

function GodaCard({ value }: { value?: Sl30sSession["goda"] }) {
  const { t } = useTranslation("modules");
  const isDefined = value && value !== "—";

  const tone = isDefined
    ? {
        wrap: "border-blue-200 bg-blue-50",
        icon: "border-blue-100 bg-white text-blue-700",
        title: "text-blue-700",
        value: "text-blue-800",
        sub: t("participantDetail.goda.definedSub"),
      }
    : {
        wrap: "border-slate-200 bg-slate-100",
        icon: "border-slate-200 bg-white text-slate-500",
        title: "text-slate-500",
        value: "text-slate-700",
        sub: t("participantDetail.goda.undefinedSub"),
      };

  return (
    <StatusCard
      label={t("participantDetail.goda.label")}
      value={value ?? "—"}
      subtitle={tone.sub}
      tone={tone}
    />
  );
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
  const { t } = useTranslation("modules");
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
    ? t("participantDetail.rikliJones.percentile", {
        value: percentileLabel,
        ageBin: ageBin ? ` • ${ageBin}` : "",
      })
    : zScoreLabel
      ? t("participantDetail.rikliJones.zscore", {
          value: zScoreLabel,
          ageBin: ageBin ? ` • ${ageBin}` : "",
        })
      : ageBin
        ? t("participantDetail.rikliJones.ageBin", { ageBin })
        : t("participantDetail.rikliJones.defaultSubtitle");

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
  const { t } = useTranslation("modules");
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
            {t("participantDetail.active")}
          </span>
        ) : null}
      </div>
    </button>
  );
}

export function ParticipantDetailPage() {
  const { t, i18n } = useTranslation("modules");
  const { user } = useAuth();
  const { id = "" } = useParams();
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [relatedNames, setRelatedNames] = useState<Record<string, string>>({});

  const [openedTest, setOpenedTest] = useState<OpenedTest>(null);
  const [selectedTwoMstSession, setSelectedTwoMstSession] = useState<number>(1);
  const [selectedSl30sSession, setSelectedSl30sSession] = useState<number>(1);
  const [selectedIvcfSession, setSelectedIvcfSession] = useState<number>(1);
  const [selectedFesiSession, setSelectedFesiSession] = useState<number>(1);
  const [selectedActSedentarySession, setSelectedActSedentarySession] = useState<number>(1);
  const [twoMstMetricRange, setTwoMstMetricRange] = useState<{ from: number | null; to: number | null }>({
    from: null,
    to: null,
  });
  const [sl30sMetricRange, setSl30sMetricRange] = useState<{ from: number | null; to: number | null }>({
    from: null,
    to: null,
  });
  const [twoMstMetricFilterMode, setTwoMstMetricFilterMode] = useState<MetricsFilterMode>("session");
  const [sl30sMetricFilterMode, setSl30sMetricFilterMode] = useState<MetricsFilterMode>("session");
  const [twoMstFilterOpen, setTwoMstFilterOpen] = useState(false);
  const [sl30sFilterOpen, setSl30sFilterOpen] = useState(false);

  const mainExportRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setIsLoading(true);
        setError(null);

        const data = await getParticipantById(id);
        if (mounted) {
          setParticipant(data);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Erro ao carregar participante.");
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
  }, [id]);

  useEffect(() => {
    let mounted = true;

    async function loadRelatedNames() {
      if (!participant) return;

      const ids = Array.from(
        new Set(
          [participant.createdByUserId]
            .filter(Boolean)
            .map((value) => String(value)),
        ),
      );

      if (!ids.length) {
        if (mounted) setRelatedNames({});
        return;
      }

      let rows: Array<{ id: string; full_name: string }> = [];
      try {
        const q = ids.map(encodeURIComponent).join(",");
        rows = await apiJson<Array<{ id: string; full_name: string }>>(
          `/api/participants/meta/user-names?ids=${q}`
        );
      } catch {
        if (!mounted) return;
        setRelatedNames({});
        return;
      }

      if (!mounted) return;

      const nextNames: Record<string, string> = {};
      for (const row of rows ?? []) {
        if (row.id) {
          nextNames[row.id] = row.full_name?.trim() || row.id;
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
  const fesiSessions = useMemo(() => participant?.tests?.fesiSessions ?? [], [participant]);
  const actSedentarySessions = useMemo(
    () => participant?.tests?.actSedentarySessions ?? [],
    [participant],
  );

  const twoMstSessionIds = useMemo(() => twoMstSessions.map((s) => s.sessao), [twoMstSessions]);
  const sl30sSessionIds = useMemo(() => sl30sSessions.map((s) => s.sessao), [sl30sSessions]);

  useEffect(() => {
    setTwoMstMetricRange((current) => {
      if (!twoMstSessionIds.length) return { from: null, to: null };
      if (current.from === null && current.to === null) {
        return { from: twoMstSessionIds[0], to: twoMstSessionIds[twoMstSessionIds.length - 1] };
      }
      const set = new Set(twoMstSessionIds);
      const fromOk = current.from !== null && set.has(current.from);
      const toOk = current.to !== null && set.has(current.to);
      if (!fromOk && !toOk) return { from: null, to: null };
      return { from: fromOk ? current.from : null, to: toOk ? current.to : null };
    });
  }, [twoMstSessionIds]);

  useEffect(() => {
    setSl30sMetricRange((current) => {
      if (!sl30sSessionIds.length) return { from: null, to: null };
      if (current.from === null && current.to === null) {
        return { from: sl30sSessionIds[0], to: sl30sSessionIds[sl30sSessionIds.length - 1] };
      }
      const set = new Set(sl30sSessionIds);
      const fromOk = current.from !== null && set.has(current.from);
      const toOk = current.to !== null && set.has(current.to);
      if (!fromOk && !toOk) return { from: null, to: null };
      return { from: fromOk ? current.from : null, to: toOk ? current.to : null };
    });
  }, [sl30sSessionIds]);

  function resolveOrderedSessionsForMetricFilter(
    sessions: Array<{ sessao: number; date?: string | null }>,
    mode: MetricsFilterMode
  ) {
    if (mode === "session") return [...sessions].sort((a, b) => a.sessao - b.sessao);

    return [...sessions].sort((a, b) => {
      const ta = a.date ? new Date(a.date).getTime() : Number.POSITIVE_INFINITY;
      const tb = b.date ? new Date(b.date).getTime() : Number.POSITIVE_INFINITY;
      const da = Number.isNaN(ta) ? Number.POSITIVE_INFINITY : ta;
      const db = Number.isNaN(tb) ? Number.POSITIVE_INFINITY : tb;
      if (da !== db) return da - db;
      return a.sessao - b.sessao;
    });
  }

  function filterSessionsByOrderedEndpoints<T extends { sessao: number }>(
    sessions: T[],
    ordered: Array<{ sessao: number }>,
    range: { from: number | null; to: number | null }
  ) {
    const { from, to } = range;
    if (from === null || to === null) return sessions;
    if (!ordered.length) return sessions;

    const idxFrom = ordered.findIndex((s) => s.sessao === from);
    const idxTo = ordered.findIndex((s) => s.sessao === to);
    if (idxFrom < 0 || idxTo < 0) return sessions;

    const start = Math.min(idxFrom, idxTo);
    const end = Math.max(idxFrom, idxTo);
    const allowed = new Set(ordered.slice(start, end + 1).map((s) => s.sessao));
    return sessions.filter((s) => allowed.has(s.sessao));
  }

  const filteredTwoMstSessionsForMetrics = useMemo(() => {
    const ordered = resolveOrderedSessionsForMetricFilter(twoMstSessions, twoMstMetricFilterMode);
    return filterSessionsByOrderedEndpoints(twoMstSessions, ordered, twoMstMetricRange);
  }, [twoMstSessions, twoMstMetricFilterMode, twoMstMetricRange]);

  const filteredSl30sSessionsForMetrics = useMemo(() => {
    const ordered = resolveOrderedSessionsForMetricFilter(sl30sSessions, sl30sMetricFilterMode);
    return filterSessionsByOrderedEndpoints(sl30sSessions, ordered, sl30sMetricRange);
  }, [sl30sSessions, sl30sMetricFilterMode, sl30sMetricRange]);

  function clearMetricRange(test: "2mst" | "sl30s") {
    if (test === "2mst") setTwoMstMetricRange({ from: null, to: null });
    else setSl30sMetricRange({ from: null, to: null });
  }

  function SessionsMetricFilter({
    test,
    sessions,
    range,
    mode,
    onChangeMode,
    isOpen,
    onToggleOpen,
  }: {
    test: "2mst" | "sl30s";
    sessions: Array<{ sessao: number; date?: string | null }>;
    range: { from: number | null; to: number | null };
    mode: MetricsFilterMode;
    onChangeMode: (mode: MetricsFilterMode) => void;
    isOpen: boolean;
    onToggleOpen: (next: boolean) => void;
  }) {
    const orderedSessions = resolveOrderedSessionsForMetricFilter(sessions, mode);
    const ordered = orderedSessions.map((s) => s.sessao);
    const hasRange = range.from !== null && range.to !== null;
    if (!ordered.length) return null;

    const activeLocale = i18n.resolvedLanguage ?? i18n.language ?? "pt-BR";
    const formatTickLabel = (sessionId: number) => {
      if (mode !== "date") return t("participantDetail.sessionLabel", { session: sessionId });
      const meta = orderedSessions.find((s) => s.sessao === sessionId);
      const label = formatShortDate(meta?.date ?? null, activeLocale);
      return label === "—" ? t("participantDetail.sessionLabel", { session: sessionId }) : label;
    };

    const rangeLabel = hasRange
      ? mode === "date"
        ? (() => {
            const fromMeta = sessions.find((s) => s.sessao === range.from);
            const toMeta = sessions.find((s) => s.sessao === range.to);
            const fromLabel = formatShortDate(fromMeta?.date ?? null, activeLocale);
            const toLabel = formatShortDate(toMeta?.date ?? null, activeLocale);
            return `${fromLabel} → ${toLabel}`;
          })()
        : t("participantDetail.metricsFilter.rangeLabel", {
            from: range.from,
            to: range.to,
          })
      : t("participantDetail.metricsFilter.allSessions");

    const fromValue = hasRange ? range.from! : ordered[0];
    const toValue = hasRange ? range.to! : ordered[ordered.length - 1];

    const fromIdx = Math.max(0, ordered.indexOf(fromValue));
    const toIdx = Math.max(0, ordered.indexOf(toValue));
    const startIdx = Math.min(fromIdx, toIdx);
    const endIdx = Math.max(fromIdx, toIdx);

    const setRange = (nextFrom: number, nextTo: number) => {
      if (test === "2mst") setTwoMstMetricRange({ from: nextFrom, to: nextTo });
      else setSl30sMetricRange({ from: nextFrom, to: nextTo });
    };

    const tickPercent = (idx: number) =>
      ordered.length <= 1 ? 50 : (idx / (ordered.length - 1)) * 100;

    return (
      <div className="flex items-start gap-3">
        <div className="pt-1">
          <button
            type="button"
            onClick={() => onToggleOpen(!isOpen)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            {t("participantDetail.metricsFilter.button")}
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-700">{rangeLabel}</div>
          {isOpen ? (
            <Card className="mt-3 p-4 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                    {t("participantDetail.metricsFilter.title")}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{t("participantDetail.metricsFilter.hint")}</div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onChangeMode("session")}
                    className={[
                      "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                      mode === "session"
                        ? "border-blue-200 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    {t("participantDetail.metricsFilter.bySession")}
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeMode("date")}
                    className={[
                      "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                      mode === "date"
                        ? "border-blue-200 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    {t("participantDetail.metricsFilter.byDate")}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => clearMetricRange(test)}
                  className="w-fit rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  {t("participantDetail.metricsFilter.clear")}
                </button>
              </div>

              <div className="mt-4">
                <div className="relative px-1 pt-3 pb-12">
                  <div className="pointer-events-none absolute inset-x-1 top-1/2 h-1 -translate-y-1/2 rounded-full bg-slate-200" />

                  {ordered.map((sessionId, idx) => {
                    const inRange = idx >= startIdx && idx <= endIdx;
                    return (
                      <div
                        key={`tick-${sessionId}-${idx}`}
                        className="pointer-events-none absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
                        style={{ left: `${tickPercent(idx)}%` }}
                      >
                        <div
                          className={`w-px rounded-full ${inRange ? "h-3 bg-blue-600" : "h-2 bg-slate-400"}`}
                        />
                      </div>
                    );
                  })}

                  <div
                    className="pointer-events-none absolute top-1/2 z-10 h-0.5 -translate-y-1/2 rounded-full bg-blue-500"
                    style={{
                      left: `${tickPercent(startIdx)}%`,
                      width: `${Math.max(0, tickPercent(endIdx) - tickPercent(startIdx))}%`,
                    }}
                  />

                  <input
                    type="range"
                    min={0}
                    max={ordered.length - 1}
                    step={1}
                    value={startIdx}
                    onChange={(e) => {
                      const nextStartIdx = Number(e.target.value);
                      const nextFrom = ordered[Math.min(nextStartIdx, endIdx)];
                      const nextTo = ordered[endIdx];
                      setRange(nextFrom, nextTo);
                    }}
                    className="dual-range-input absolute inset-x-0 top-1/2 z-20 w-full -translate-y-1/2 accent-blue-600 dark:accent-blue-200"
                  />
                  <input
                    type="range"
                    min={0}
                    max={ordered.length - 1}
                    step={1}
                    value={endIdx}
                    onChange={(e) => {
                      const nextEndIdx = Number(e.target.value);
                      const nextFrom = ordered[startIdx];
                      const nextTo = ordered[Math.max(nextEndIdx, startIdx)];
                      setRange(nextFrom, nextTo);
                    }}
                    className="dual-range-input absolute inset-x-0 top-1/2 z-30 w-full -translate-y-1/2 accent-blue-600 dark:accent-blue-200"
                  />

                  {ordered.map((sessionId, idx) => {
                    const isEndpoint = idx === startIdx || idx === endIdx;
                    return (
                      <span
                        key={`label-${sessionId}-${idx}`}
                        className={[
                          "absolute top-full mt-3 max-w-[4.75rem] -translate-x-1/2 text-center text-[10px] font-semibold leading-tight",
                          isEndpoint ? "text-blue-700" : "text-slate-500",
                        ].join(" ")}
                        style={{ left: `${tickPercent(idx)}%` }}
                      >
                        {formatTickLabel(sessionId)}
                      </span>
                    );
                  })}
                </div>
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    );
  }

  const selectedTwoMstSignal =
    participant?.tests?.twoMstSignals?.[selectedTwoMstSession] ?? [];
  const selectedSl30sSignal =
    participant?.tests?.sl30sSignals?.[selectedSl30sSession] ?? [];

  const lastTwoMstSession = twoMstSessions[twoMstSessions.length - 1];
  const lastSl30sSession = sl30sSessions[sl30sSessions.length - 1];
  const lastIvcfSession = ivcfSessions[ivcfSessions.length - 1];
  const lastFesiSession = fesiSessions[fesiSessions.length - 1];
  const lastActSedentarySession = actSedentarySessions[actSedentarySessions.length - 1];

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

  useEffect(() => {
    if (lastFesiSession?.sessao) {
      setSelectedFesiSession(lastFesiSession.sessao);
    }
  }, [lastFesiSession?.sessao]);

  useEffect(() => {
    if (lastActSedentarySession?.sessao) {
      setSelectedActSedentarySession(lastActSedentarySession.sessao);
    }
  }, [lastActSedentarySession?.sessao]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100">
        <AppHeader title={t("participantDetail.headerTitle")} subtitle={t("participantDetail.loadingSubtitle")} />
        <main className="px-6 py-8">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="text-sm text-slate-500">{t("participantDetail.loadingBody")}</div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-100">
        <AppHeader title={t("participantDetail.headerTitle")} subtitle={t("participantDetail.errorSubtitle")} />
        <main className="px-6 py-8">
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 shadow-sm">
            <p className="font-semibold text-red-700">{t("participantDetail.errorTitle")}</p>
            <p className="mt-1 text-sm text-red-600">{error}</p>
          </div>
        </main>
      </div>
    );
  }

  if (!participant) {
    return (
      <div className="min-h-screen bg-slate-100">
        <AppHeader title={t("participantDetail.headerTitle")} subtitle={t("participantDetail.notFoundSubtitle")} />
        <main className="px-6 py-8">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="text-sm text-slate-500">{t("participantDetail.notFoundBody")}</div>
          </div>
        </main>
      </div>
    );
  }

  const cityState = [participant.city, participant.state].filter(Boolean).join(" / ") || "—";
  const createdByName = participant.createdByUserId
    ? relatedNames[participant.createdByUserId] ?? participant.createdByUserId
    : "—";

  const has2Mst = Boolean(participant.tests?.has2MST && twoMstSessions.length);
  const hasSl30s = Boolean(participant.tests?.hasSL30S && sl30sSessions.length);
  const hasIvcf = Boolean(participant.tests?.hasIVCF20 && ivcfSessions.length);
  const hasFesi = Boolean(participant.tests?.hasFESI && fesiSessions.length);
  const hasActSedentary = Boolean(
    participant.tests?.hasActSedentary && actSedentarySessions.length,
  );

  const showIvcfDetails = openedTest === "IVCF20" && hasIvcf;
  const showFesiDetails = openedTest === "FESI" && hasFesi;
  const showActSedentaryDetails = openedTest === "ACT_SEDENTARY" && hasActSedentary;
  const show2MstDetails = openedTest === "2MST" && has2Mst;
  const showSl30sDetails = openedTest === "SL30S" && hasSl30s;

  function scrollToQuestionnaireSection(sectionId: string) {
    window.setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);
  }

  function handleQuestionnaireCardClick(
    testKey: Extract<OpenedTest, "IVCF20" | "FESI" | "ACT_SEDENTARY">,
    sectionId: string,
    enabled: boolean,
  ) {
    if (!enabled) return;

    const isOpening = openedTest !== testKey;
    setOpenedTest(isOpening ? testKey : null);

    if (isOpening) {
      scrollToQuestionnaireSection(sectionId);
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

  const activeLocale = i18n.resolvedLanguage ?? i18n.language ?? "pt-BR";
  const dobLabel = formatShortDate(participant.dob ?? null, activeLocale);
  const nat = String(participant.nationality ?? "BR")
    .trim()
    .toUpperCase();
  const identityLabel =
    nat === "BR" ? t("participantDetail.fields.cpf") : t("participantDetail.fields.identity");

  const canEditParticipant =
    !isDemoParticipant && !!user && PARTICIPANT_AREA_ROLES.includes(user.role);

  return (
    <div className="min-h-screen bg-slate-100">
      <AppHeader
        title={participant.name}
        subtitle={
          isDemoParticipant
            ? t("participantDetail.demoSubtitle")
            : has2Mst || hasSl30s || hasIvcf || hasFesi || hasActSedentary
              ? t("participantDetail.subtitleWithTests")
              : t("participantDetail.subtitle")
        }
      />

      <main ref={mainExportRef} className="space-y-6 px-6 py-8">
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              to={routes.participants}
              data-export="exclude"
              className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900"
            >
              <ArrowLeft size={16} />
              {t("participantDetail.backToParticipants")}
            </Link>

            {canEditParticipant ? (
              <Link
                to={routes.participantEdit(participant.id)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
              >
                <Pencil size={14} className="text-slate-500" aria-hidden />
                {t("participantDetail.editParticipant")}
              </Link>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-black tracking-tight text-slate-900">{participant.name}</h1>

            {isDemoParticipant ? (
              <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-700">
                {t("participantDetail.exampleBadge")}
              </span>
            ) : null}
          </div>
        </section>

        <section>
          <Card className="p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <UserRound size={18} className="text-blue-700" />
              <h2 className="text-lg font-black text-slate-900">{t("participantDetail.personalInfoTitle")}</h2>
            </div>

            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
              <DetailItem label={t("participantDetail.fields.nationality")} value={nat} />
              <DetailItem label={identityLabel} value={participant.cpf} />
              <DetailItem label={t("participantDetail.fields.birthDate")} value={dobLabel} />
              <DetailItem
                label={t("participantDetail.fields.ageSex")}
                value={`${
                  participant.age
                    ? t("participantDetail.ageYears", { count: participant.age, years: participant.age })
                    : "—"
                } • ${participant.sex}`}
              />
              <DetailItem label={t("participantDetail.fields.cityState")} value={cityState} />
              <DetailItem label={t("participantDetail.fields.createdBy")} value={createdByName} />
            </div>
          </Card>
        </section>

        <section>
          <Card className="p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <ClipboardList size={18} className="text-blue-700" />
              <h2 className="text-lg font-black text-slate-900">{t("participantDetail.questionnairesTitle")}</h2>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <QuestionnaireStatusCard
                title={t("questionnaires.instruments.ivcf20.shortTitle")}
                score={participant.ivcfScore}
                badge={participant.ivcfClass ?? null}
                date={lastIvcfSession?.date}
                emptyLabel={t("participantDetail.noProcessedCollection")}
                tone={ivcfTone(participant.ivcfClass)}
                collected={hasIvcf}
                onClick={
                  hasIvcf
                    ? () => handleQuestionnaireCardClick("IVCF20", "ivcf20-section", hasIvcf)
                    : undefined
                }
              />

              <QuestionnaireStatusCard
                title={t("questionnaires.instruments.fesi.shortTitle")}
                score={participant.fesiScore}
                badge={participant.fesiClass ?? null}
                date={lastFesiSession?.date}
                emptyLabel={t("participantDetail.noProcessedCollection")}
                tone={fesiTone(participant.fesiClass)}
                collected={hasFesi}
                onClick={
                  hasFesi
                    ? () => handleQuestionnaireCardClick("FESI", "fesi-section", hasFesi)
                    : undefined
                }
              />

              <QuestionnaireStatusCard
                title={t("questionnaires.instruments.actSedentary.shortTitle")}
                score={participant.actSedentaryLabel ?? "—"}
                badge={lastActSedentarySession?.summary.activityKey ?? null}
                date={lastActSedentarySession?.date}
                emptyLabel={t("participantDetail.noProcessedCollection")}
                tone="info"
                collected={hasActSedentary}
                onClick={
                  hasActSedentary
                    ? () =>
                        handleQuestionnaireCardClick(
                          "ACT_SEDENTARY",
                          "act-sedentary-section",
                          hasActSedentary,
                        )
                    : undefined
                }
              />
            </div>
          </Card>
        </section>

        {showIvcfDetails ? (
          <Ivcf20Section
            sessions={ivcfSessions}
            selectedSession={selectedIvcfSession}
            onSelectSession={setSelectedIvcfSession}
          />
        ) : null}

        {showFesiDetails ? (
          <FesiSection
            sessions={fesiSessions}
            selectedSession={selectedFesiSession}
            onSelectSession={setSelectedFesiSession}
          />
        ) : null}

        {showActSedentaryDetails ? (
          <ActSedentarySection
            sessions={actSedentarySessions}
            selectedSession={selectedActSedentarySession}
            onSelectSession={setSelectedActSedentarySession}
          />
        ) : null}

        <section>
          <Card className="p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <UserRound size={18} className="text-blue-700" />
              <h2 className="text-lg font-black text-slate-900">{t("participantDetail.tests.title")}</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <TestCard
                title="2MST"
                description={
                  has2Mst
                    ? isDemoParticipant
                      ? t("participantDetail.tests.2mst.demoDescription")
                      : t("participantDetail.tests.2mst.description")
                    : t("participantDetail.tests.noData")
                }
                active={has2Mst}
                onClick={
                  has2Mst
                    ? () => setOpenedTest((prev) => (prev === "2MST" ? null : "2MST"))
                    : undefined
                }
              />

              <TestCard
                title={t("participantDetail.tests.sl30s.shortTitle")}
                description={
                  hasSl30s
                    ? t("participantDetail.tests.sl30s.description")
                    : t("participantDetail.tests.noData")
                }
                active={hasSl30s}
                onClick={
                  hasSl30s
                    ? () => setOpenedTest((prev) => (prev === "SL30S" ? null : "SL30S"))
                    : undefined
                }
              />

              <TestCard title="UTT" description={t("participantDetail.tests.noData")} />
              <TestCard title="TUG" description={t("participantDetail.tests.noData")} />
              <TestCard title="LOS" description={t("participantDetail.tests.noData")} />
            </div>
          </Card>
        </section>

        {show2MstDetails ? (
          <>
            <div>
              <section className="flex items-center gap-2">
                <Footprints size={18} className="text-blue-700" />
                <h2 className="text-xl font-black text-slate-900">{t("participantDetail.tests.2mst.sectionTitle")}</h2>
              </section>

              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <Card className="p-5 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                        {t("participantDetail.lastSession")}
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
                      {t("participantDetail.repetitions")}
                    </p>
                    <div className="mt-2 text-3xl font-black text-slate-900">
                      {lastTwoMstSession?.repeticoes ?? "—"}
                    </div>
                    <p className="mt-2 text-sm text-slate-500">{t("participantDetail.tests.2mst.duration")}</p>
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
                      {t("participantDetail.cadence")}
                    </p>
                    <div className="mt-2 text-3xl font-black text-slate-900">
                      {lastTwoMstSession?.cadencia ?? "—"}
                    </div>
                    <p className="mt-2 text-sm text-slate-500">{t("participantDetail.units.cyclesPerMin")}</p>
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
                    <p className="mt-2 text-sm text-slate-500">{t("participantDetail.units.degPerSec")}</p>
                  </div>
                  <div className="rounded-2xl border border-violet-100 bg-violet-50 p-3 text-violet-700">
                    <Activity size={20} />
                  </div>
                </div>
              </Card>

                <StrategyCard strategy={lastTwoMstSession?.strategy} />
              </section>

              <section>
                <SessionsMetricFilter
                  test="2mst"
                  sessions={twoMstSessions}
                  range={twoMstMetricRange}
                  mode={twoMstMetricFilterMode}
                  onChangeMode={setTwoMstMetricFilterMode}
                  isOpen={twoMstFilterOpen}
                  onToggleOpen={setTwoMstFilterOpen}
                />
              </section>

              <section className="mt-4">
                <Card className="p-6 shadow-sm">
                <div className="mb-5 flex items-center gap-2">
                  <Activity size={18} className="text-emerald-600" />
                  <h2 className="text-lg font-black text-slate-900">
                    {t("participantDetail.tests.2mst.repsEvolutionTitle")}
                  </h2>
                </div>

                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={filteredTwoMstSessionsForMetrics}
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
                        labelFormatter={(label) => t("participantDetail.sessionLabel", { session: label })}
                      />
                      <Line
                        type="monotone"
                        dataKey="repeticoes"
                        stroke="var(--chart-primary)"
                        strokeWidth={3}
                        dot={{ r: 4, fill: "var(--chart-primary)" }}
                        activeDot={{ r: 7 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                </Card>
              </section>

            <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <TinyMetricChart
                title={t("participantDetail.cadence")}
                data={filteredTwoMstSessionsForMetrics}
                dataKey="cadencia"
                unit={t("participantDetail.units.cyclesPerMin")}
                color="#f59e0b"
              />
              <TinyMetricChart
                title={t("participantDetail.tests.2mst.metrics.meanAngularVelocityFull")}
                data={filteredTwoMstSessionsForMetrics}
                dataKey="velAngularMedia"
                unit={t("participantDetail.units.degPerSec")}
                color="#8b5cf6"
              />
              <TinyMetricChart
                title={t("participantDetail.tests.2mst.metrics.cvVelocity")}
                data={filteredTwoMstSessionsForMetrics}
                dataKey="cvVelocidade"
                unit="%"
                color="#ec4899"
              />
              <TinyMetricChart
                title={t("participantDetail.tests.2mst.metrics.meanCycleTime")}
                data={filteredTwoMstSessionsForMetrics}
                dataKey="tempoMedioCiclo"
                unit="s"
                color="var(--chart-tertiary)"
              />
              <TinyMetricChart
                title={t("participantDetail.tests.2mst.metrics.cvCycleTime")}
                data={filteredTwoMstSessionsForMetrics}
                dataKey="cvTempoCiclo"
                unit="%"
                color="#14b8a6"
              />
              <TinyMetricChart
                title={t("participantDetail.tests.2mst.metrics.maxVelocity")}
                data={filteredTwoMstSessionsForMetrics}
                dataKey="velMaxima"
                unit={t("participantDetail.units.degPerSec")}
                color="#ef4444"
              />
              <TinyMetricChart
                title={t("participantDetail.tests.2mst.metrics.minVelocity")}
                data={filteredTwoMstSessionsForMetrics}
                dataKey="velMinima"
                unit={t("participantDetail.units.degPerSec")}
                color="#6366f1"
              />
            </section>

              <section className="mt-4">
                <Card className="p-6 shadow-sm">
                <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-2">
                    <Activity size={18} className="text-rose-600" />
                    <h2 className="text-lg font-black text-slate-900">
                      {t("participantDetail.tests.2mst.timeseriesGyroXTitle")}
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
                          {t("participantDetail.tests.2mst.sessionOptionCycles", {
                            session: session.sessao,
                            cycles: session.repeticoes,
                          })}
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
                      <LineChart data={selectedTwoMstSignal} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
                        <CartesianGrid stroke="#dbeafe" strokeDasharray="2 2" />

                        <XAxis
                          dataKey="time"
                          type="number"
                          scale="linear"
                          domain={["dataMin", "dataMax"]}
                          tick={{ fill: "#64748b", fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(value) => `${Number(value).toFixed(1)}`}
                        />

                        <YAxis
                          type="number"
                          domain={["auto", "auto"]}
                          tick={{ fill: "#64748b", fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                          width={52}
                        />

                        <Tooltip
                          contentStyle={{
                            borderRadius: 12,
                            border: "1px solid #e2e8f0",
                            boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
                          }}
                          labelFormatter={(value) => `${Number(value).toFixed(2)} s`}
                          formatter={(value, name) => {
                            if (name === "value") return [`${value} °/s`, t("participantDetail.signal")];
                            if (name === "phonePeak") return [`${value} °/s`, t("participantDetail.tests.2mst.phonePeaks")];
                            if (name === "predPeak") return [`${value} °/s`, t("participantDetail.tests.2mst.calibratedPeaks")];
                            return [String(value), String(name)];
                          }}
                        />

                        <Line
                          type="linear"
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
                            stroke: "var(--chart-primary)",
                            strokeWidth: 2,
                          }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="mt-3 flex justify-between text-xs text-slate-400">
                  <span>{twoMstSignalStart}s</span>
                  <span>{t("participantDetail.timeSeconds")}</span>
                  <span>{twoMstSignalEnd}s</span>
                </div>
                </Card>
              </section>
            </div>

            <TestExportActions
              participantId={participant.id}
              participantName={participant.name}
              testLabelForFile="2MST"
              rawTestType="MARCHA"
              sessions={twoMstSessions}
              defaultSessionNumber={selectedTwoMstSession}
              metricRange={twoMstMetricRange}
              exportRef={mainExportRef}
            />
          </>
        ) : null}

        {showSl30sDetails ? (
          <>
            <div>
              <section className="flex items-center gap-2">
                <Activity size={18} className="text-blue-700" />
                <h2 className="text-xl font-black text-slate-900">{t("participantDetail.tests.sl30s.sectionTitle")}</h2>
              </section>

              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <Card className="p-5 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                        {t("participantDetail.lastSession")}
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
                      {t("participantDetail.repetitions")}
                    </p>
                    <div className="mt-2 text-3xl font-black text-slate-900">
                      {lastSl30sSession?.repeticoes ?? "—"}
                    </div>
                    <p className="mt-2 text-sm text-slate-500">{t("participantDetail.tests.sl30s.duration")}</p>
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
                      {t("participantDetail.tests.sl30s.metrics.meanPower")}
                    </p>
                    <div className="mt-2 text-3xl font-black text-slate-900">
                      {lastSl30sSession?.potenciaMedia ?? "—"}
                    </div>
                    <p className="mt-2 text-sm text-slate-500">{t("participantDetail.units.watts")}</p>
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
                <SessionsMetricFilter
                  test="sl30s"
                  sessions={sl30sSessions}
                  range={sl30sMetricRange}
                  mode={sl30sMetricFilterMode}
                  onChangeMode={setSl30sMetricFilterMode}
                  isOpen={sl30sFilterOpen}
                  onToggleOpen={setSl30sFilterOpen}
                />
              </section>

              <section className="mt-4">
                <Card className="p-6 shadow-sm">
                <div className="mb-5 flex items-center gap-2">
                  <Activity size={18} className="text-emerald-600" />
                  <h2 className="text-lg font-black text-slate-900">
                    {t("participantDetail.tests.sl30s.repsEvolutionTitle")}
                  </h2>
                </div>

                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={filteredSl30sSessionsForMetrics}
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
                        labelFormatter={(label) => t("participantDetail.sessionLabel", { session: label })}
                      />
                      <Line
                        type="monotone"
                        dataKey="repeticoes"
                        stroke="var(--chart-primary)"
                        strokeWidth={3}
                        dot={{ r: 4, fill: "var(--chart-primary)" }}
                        activeDot={{ r: 7 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                </Card>
              </section>

            <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <TinyMetricChart
                title={t("participantDetail.tests.sl30s.metrics.meanPower")}
                data={filteredSl30sSessionsForMetrics}
                dataKey="potenciaMedia"
                unit={t("participantDetail.units.watts")}
                color="#8b5cf6"
              />
              <TinyMetricChart
                title={t("participantDetail.tests.sl30s.metrics.totalWork")}
                data={filteredSl30sSessionsForMetrics}
                dataKey="trabalhoTotal"
                unit={t("participantDetail.units.joules")}
                color="#14b8a6"
              />
              <TinyMetricChart
                title={t("participantDetail.tests.sl30s.metrics.workPerRep")}
                data={filteredSl30sSessionsForMetrics}
                dataKey="trabalhoPorRep"
                unit={t("participantDetail.units.joules")}
                color="#f59e0b"
              />
              <TinyMetricChart
                title={t("participantDetail.tests.sl30s.metrics.meanCycleTime")}
                data={filteredSl30sSessionsForMetrics}
                dataKey="tempoMedioCiclo"
                unit="s"
                color="var(--chart-tertiary)"
              />
              <TinyMetricChart
                title={t("participantDetail.tests.sl30s.metrics.meanStandTime")}
                data={filteredSl30sSessionsForMetrics}
                dataKey="tempoMedioLevantar"
                unit="s"
                color="#22c55e"
              />
              <TinyMetricChart
                title={t("participantDetail.tests.sl30s.metrics.meanSitTime")}
                data={filteredSl30sSessionsForMetrics}
                dataKey="tempoMedioSentar"
                unit="s"
                color="#ef4444"
              />
              <TinyMetricChart
                title={t("participantDetail.tests.sl30s.metrics.meanFrequency")}
                data={filteredSl30sSessionsForMetrics}
                dataKey="frequenciaMedia"
                unit={t("participantDetail.units.hz")}
                color="var(--chart-secondary)"
              />
              <TinyMetricChart
                title={t("participantDetail.tests.sl30s.metrics.cvCycleTime")}
                data={filteredSl30sSessionsForMetrics}
                dataKey="cvTempoCiclo"
                unit="%"
                color="#ec4899"
              />
              <TinyMetricChart
                title={t("participantDetail.tests.sl30s.metrics.signalAmplitude")}
                data={filteredSl30sSessionsForMetrics}
                dataKey="amplitudeSinal"
                unit={t("participantDetail.units.degrees")}
                color="#6366f1"
              />
              <TinyMetricChart
                title={t("participantDetail.tests.sl30s.metrics.velFlexStand")}
                data={filteredSl30sSessionsForMetrics}
                dataKey="velFlexLevantar"
                unit={t("participantDetail.units.degPerSec")}
                color="#16a34a"
              />
              <TinyMetricChart
                title={t("participantDetail.tests.sl30s.metrics.velExtStand")}
                data={filteredSl30sSessionsForMetrics}
                dataKey="velExtLevantar"
                unit={t("participantDetail.units.degPerSec")}
                color="#0891b2"
              />
              <TinyMetricChart
                title={t("participantDetail.tests.sl30s.metrics.velFlexSit")}
                data={filteredSl30sSessionsForMetrics}
                dataKey="velFlexSentar"
                unit={t("participantDetail.units.degPerSec")}
                color="#f97316"
              />
              <TinyMetricChart
                title={t("participantDetail.tests.sl30s.metrics.velExtSit")}
                data={filteredSl30sSessionsForMetrics}
                dataKey="velExtSentar"
                unit={t("participantDetail.units.degPerSec")}
                color="#7c3aed"
              />
            </section>

              <section className="mt-4">
                <Card className="p-6 shadow-sm">
                <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-2">
                    <Activity size={18} className="text-emerald-700" />
                    <h2 className="text-lg font-black text-slate-900">
                      {t("participantDetail.tests.sl30s.timeseriesTrunkAngleTitle")}
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
                          {t("participantDetail.tests.sl30s.sessionOptionReps", {
                            session: session.sessao,
                            reps: session.repeticoes,
                          })}
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
                            if (name === "value") return [`${value} °`, t("participantDetail.signal")];
                            if (name === "peak") return [`${value} °`, t("participantDetail.peaks")];
                            if (name === "valley") return [`${value} °`, t("participantDetail.valleys")];
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
                  <span>{t("participantDetail.timeSeconds")}</span>
                  <span>{sl30sSignalEnd}s</span>
                </div>
                </Card>
              </section>
            </div>

            <TestExportActions
              participantId={participant.id}
              participantName={participant.name}
              testLabelForFile="SL30S"
              rawTestType="SL30S"
              sessions={sl30sSessions}
              defaultSessionNumber={selectedSl30sSession}
              metricRange={sl30sMetricRange}
              exportRef={mainExportRef}
            />
          </>
        ) : null}
      </main>
    </div>
  );
}
