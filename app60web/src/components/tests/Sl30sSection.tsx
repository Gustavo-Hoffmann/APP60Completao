import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  CalendarDays,
  ChevronDown,
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

import { Card } from "../ui/Card";
import type { Participant, Sl30sSession } from "../../types/participant";

type SignalPoint = {
  time: number;
  value: number;
  peak: number | null;
  valley: number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toFiniteNumber(value: unknown): number | null {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

function toNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => toFiniteNumber(item))
    .filter((item): item is number => item != null);
}

function toIndexSet(value: unknown): Set<number> {
  return new Set(
    toNumberArray(value)
      .map((item) => Math.round(item))
      .filter((item) => item >= 0),
  );
}

function normalizePointArray(value: unknown[]): SignalPoint[] {
  return value
    .map((item) => {
      if (!isRecord(item)) return null;

      const time = toFiniteNumber(item.time ?? item.t ?? item.x);
      const signalValue = toFiniteNumber(
        item.value ?? item.signal ?? item.signal_deg ?? item.y,
      );

      if (time == null || signalValue == null) return null;

      const peakValue = toFiniteNumber(item.peak);
      const valleyValue = toFiniteNumber(item.valley);

      return {
        time,
        value: signalValue,
        peak: peakValue,
        valley: valleyValue,
      } satisfies SignalPoint;
    })
    .filter((item): item is SignalPoint => item != null)
    .sort((a, b) => a.time - b.time);
}

function normalizeIndexedPlot(value: Record<string, unknown>): SignalPoint[] {
  const time = toNumberArray(
    value.t_s ?? value.time ?? value.times ?? value.x ?? value.timestamps,
  );
  const signal = toNumberArray(
    value.signal_deg ?? value.signal ?? value.value ?? value.values ?? value.y,
  );

  if (!time.length || !signal.length) return [];

  const size = Math.min(time.length, signal.length);
  const peakSet = toIndexSet(value.peak_indices ?? value.peaks ?? value.peakIndexes);
  const valleySet = toIndexSet(
    value.valley_indices ?? value.valleys ?? value.valleyIndexes,
  );

  return Array.from({ length: size }, (_, index) => ({
    time: time[index],
    value: signal[index],
    peak: peakSet.has(index) ? signal[index] : null,
    valley: valleySet.has(index) ? signal[index] : null,
  }));
}

function normalizeSignalPayload(value: unknown, depth = 0): SignalPoint[] {
  if (depth > 4 || value == null) return [];

  if (Array.isArray(value)) {
    const points = normalizePointArray(value);
    if (points.length) return points;

    for (const item of value) {
      const nested = normalizeSignalPayload(item, depth + 1);
      if (nested.length) return nested;
    }

    return [];
  }

  if (!isRecord(value)) return [];

  for (const key of ["plot", "data", "series", "signal", "payload"]) {
    if (key in value) {
      const nested = normalizeSignalPayload(value[key], depth + 1);
      if (nested.length) return nested;
    }
  }

  const indexed = normalizeIndexedPlot(value);
  if (indexed.length) return indexed;

  const singlePoint = normalizePointArray([value]);
  if (singlePoint.length) return singlePoint;

  return [];
}

function extractSignalForSession(signals: unknown, sessionNumber: number): SignalPoint[] {
  if (signals == null) return [];

  const candidates: unknown[] = [];

  if (Array.isArray(signals)) {
    candidates.push(signals[sessionNumber]);
    candidates.push(signals[sessionNumber - 1]);

    const bySession = signals.find((item) => {
      if (!isRecord(item)) return false;
      const itemSession = toFiniteNumber(
        item.sessao ?? item.session ?? item.session_number ?? item.sessionNumber,
      );
      return itemSession === sessionNumber;
    });

    if (bySession !== undefined) candidates.push(bySession);
  }

  if (isRecord(signals)) {
    candidates.push(signals[sessionNumber]);
    candidates.push(signals[String(sessionNumber)]);

    const nestedSessions = signals.sessions;
    if (Array.isArray(nestedSessions) || isRecord(nestedSessions)) {
      candidates.push(nestedSessions);
    }
  }

  candidates.push(signals);

  for (const candidate of candidates) {
    const normalized = normalizeSignalPayload(candidate);
    if (normalized.length) return normalized;
  }

  return [];
}

function TinyMetricChart({
  title,
  data,
  dataKey,
  unit,
  color,
}: {
  title: string;
  data: Sl30sSession[];
  dataKey: keyof Sl30sSession;
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

function GodaCard({ value }: { value?: Sl30sSession["goda"] }) {
  const isDefined = value && value !== "—";

  const tone = isDefined
    ? {
        wrap: "border-blue-200 bg-blue-50",
        icon: "border-blue-100 bg-white text-blue-700",
        title: "text-blue-700",
        value: "text-blue-800",
        sub: "Perfil temporal identificado",
      }
    : {
        wrap: "border-slate-200 bg-slate-100",
        icon: "border-slate-200 bg-white text-slate-500",
        title: "text-slate-500",
        value: "text-slate-700",
        sub: "Perfil temporal indisponível",
      };

  return (
    <Card className={`p-5 shadow-sm ${tone.wrap}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-xs font-bold uppercase tracking-[0.18em] ${tone.title}`}>
            Goda
          </p>
          <div className={`mt-2 text-2xl font-black ${tone.value}`}>{value ?? "—"}</div>
          <p className="mt-2 text-sm text-slate-500">{tone.sub}</p>
        </div>
        <div className={`rounded-2xl border p-3 ${tone.icon}`}>
          <BarChart3 size={20} />
        </div>
      </div>
    </Card>
  );
}

function RikliJonesCard({
  value,
  percentile,
  zScore,
  ageBin,
  sex,
  normativeLower,
  normativeUpper,
}: {
  value?: Sl30sSession["rikliJones"];
  percentile?: number | null;
  zScore?: number | null;
  ageBin?: string;
  sex?: "Masculino" | "Feminino";
  normativeLower?: number | null;
  normativeUpper?: number | null;
}) {
  const tone =
    value === "Abaixo da média"
      ? {
          wrap: "border-red-200 bg-red-50",
          icon: "border-red-100 bg-white text-red-700",
          title: "text-red-700",
          value: "text-red-800",
        }
      : value === "Acima da média"
        ? {
            wrap: "border-emerald-200 bg-emerald-50",
            icon: "border-emerald-100 bg-white text-emerald-700",
            title: "text-emerald-700",
            value: "text-emerald-800",
          }
        : value === "Na média"
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

  const percentileText =
    percentile != null ? `Percentil ${percentile.toFixed(1)}` : "Percentil indisponível";

  const zText = zScore != null ? `z = ${zScore.toFixed(2)}` : "z indisponível";

  const referenceText =
    normativeLower != null && normativeUpper != null
      ? `Ref.: ${normativeLower}–${normativeUpper} rep`
      : "Sem faixa normativa";

  const demographicText = [sex, ageBin].filter(Boolean).join(" • ") || "Sem faixa etária/sexo";

  return (
    <Card className={`p-5 shadow-sm ${tone.wrap}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-xs font-bold uppercase tracking-[0.18em] ${tone.title}`}>
            Rikli-Jones
          </p>
          <div className={`mt-2 text-2xl font-black ${tone.value}`}>{value ?? "—"}</div>
          <p className="mt-2 text-sm text-slate-500">{percentileText}</p>
          <p className="mt-1 text-sm text-slate-500">{zText}</p>
          <p className="mt-1 text-sm text-slate-500">{demographicText}</p>
          <p className="mt-1 text-sm text-slate-500">{referenceText}</p>
        </div>
        <div className={`rounded-2xl border p-3 ${tone.icon}`}>
          <Activity size={20} />
        </div>
      </div>
    </Card>
  );
}

type Props = {
  participant: Participant;
};

export function Sl30sSection({ participant }: Props) {
  const sessions = useMemo(
    () => [...(participant.tests?.sl30sSessions ?? [])].sort((a, b) => a.sessao - b.sessao),
    [participant],
  );

  const [selectedSession, setSelectedSession] = useState<number>(1);

  const lastSession = sessions[sessions.length - 1];

  useEffect(() => {
    if (lastSession?.sessao) {
      setSelectedSession((current) => current || lastSession.sessao);
    }
  }, [lastSession?.sessao]);

  const selectedSessionData = useMemo(
    () =>
      sessions.find((session) => session.sessao === selectedSession) ??
      lastSession ??
      sessions[0],
    [lastSession, selectedSession, sessions],
  );

  const selectedSignal = useMemo(
    () => extractSignalForSession(participant.tests?.sl30sSignals as unknown, selectedSession),
    [participant.tests?.sl30sSignals, selectedSession],
  );

  const signalStart = selectedSignal.length ? selectedSignal[0].time.toFixed(1) : "0.0";
  const signalEnd = selectedSignal.length
    ? selectedSignal[selectedSignal.length - 1].time.toFixed(1)
    : "0.0";

  if (!sessions.length) return null;

  return (
    <>
      <section className="flex items-center gap-2">
        <Activity size={18} className="text-emerald-700" />
        <h2 className="text-xl font-black text-slate-900">SL-30s — Sentar e levantar</h2>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card className="p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                Sessão selecionada
              </p>
              <div className="mt-2 text-3xl font-black text-slate-900">
                {selectedSessionData?.sessao ?? "—"}
              </div>
              <p className="mt-2 text-sm text-slate-500">{selectedSessionData?.date ?? "—"}</p>
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
                {selectedSessionData?.repeticoes ?? "—"}
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
                {selectedSessionData?.potenciaMedia ?? "—"}
              </div>
              <p className="mt-2 text-sm text-slate-500">W</p>
            </div>
            <div className="rounded-2xl border border-violet-100 bg-violet-50 p-3 text-violet-700">
              <BarChart3 size={20} />
            </div>
          </div>
        </Card>

        <Card className="p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                Trabalho total
              </p>
              <div className="mt-2 text-3xl font-black text-slate-900">
                {selectedSessionData?.trabalhoTotal ?? "—"}
              </div>
              <p className="mt-2 text-sm text-slate-500">J</p>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3 text-amber-700">
              <Activity size={20} />
            </div>
          </div>
        </Card>

        <GodaCard value={selectedSessionData?.goda} />

        <RikliJonesCard
          value={selectedSessionData?.rikliJones}
          percentile={selectedSessionData?.percentile}
          zScore={selectedSessionData?.zScore}
          ageBin={selectedSessionData?.ageBin}
          sex={selectedSessionData?.sex}
          normativeLower={selectedSessionData?.normativeLower}
          normativeUpper={selectedSessionData?.normativeUpper}
        />
      </section>

      <section>
        <Card className="p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <Activity size={18} className="text-emerald-600" />
            <h2 className="text-lg font-black text-slate-900">SL-30s — evolução de repetições</h2>
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
                  stroke="#b91c1c"
                  strokeWidth={3}
                  dot={{ r: 4, fill: "#b91c1c" }}
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
          data={sessions}
          dataKey="potenciaMedia"
          unit="W"
          color="#8b5cf6"
        />
        <TinyMetricChart
          title="Trabalho total"
          data={sessions}
          dataKey="trabalhoTotal"
          unit="J"
          color="#2563eb"
        />
        <TinyMetricChart
          title="Trabalho por repetição"
          data={sessions}
          dataKey="trabalhoPorRep"
          unit="J"
          color="#0ea5e9"
        />
        <TinyMetricChart
          title="Tempo médio ciclo"
          data={sessions}
          dataKey="tempoMedioCiclo"
          unit="s"
          color="#f59e0b"
        />
        <TinyMetricChart
          title="Tempo médio levantar"
          data={sessions}
          dataKey="tempoMedioLevantar"
          unit="s"
          color="#ef4444"
        />
        <TinyMetricChart
          title="Tempo médio sentar"
          data={sessions}
          dataKey="tempoMedioSentar"
          unit="s"
          color="#14b8a6"
        />
        <TinyMetricChart
          title="Frequência média"
          data={sessions}
          dataKey="frequenciaMedia"
          unit="Hz"
          color="#6366f1"
        />
        <TinyMetricChart
          title="CV tempo ciclo"
          data={sessions}
          dataKey="cvTempoCiclo"
          unit="%"
          color="#ec4899"
        />
        <TinyMetricChart
          title="Amplitude do sinal"
          data={sessions}
          dataKey="amplitudeSinal"
          unit="°"
          color="#84cc16"
        />
        <TinyMetricChart
          title="Vel. flexão levantar"
          data={sessions}
          dataKey="velFlexLevantar"
          unit="°/s"
          color="#f97316"
        />
        <TinyMetricChart
          title="Vel. extensão levantar"
          data={sessions}
          dataKey="velExtLevantar"
          unit="°/s"
          color="#a855f7"
        />
        <TinyMetricChart
          title="Vel. extensão sentar"
          data={sessions}
          dataKey="velExtSentar"
          unit="°/s"
          color="#06b6d4"
        />
      </section>

      <section>
        <Card className="p-6 shadow-sm">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <Activity size={18} className="text-emerald-700" />
              <h2 className="text-lg font-black text-slate-900">Série temporal — Ângulo X</h2>
            </div>

            <div className="relative w-full md:w-auto">
              <select
                value={selectedSession}
                onChange={(e) => setSelectedSession(Number(e.target.value))}
                className="w-full appearance-none rounded-2xl border border-slate-200 bg-white py-3 pl-4 pr-10 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50 md:min-w-[240px]"
              >
                {sessions.map((session) => (
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

          <div className="rounded-3xl border border-red-100 bg-red-50/30 p-3">
            <div className="h-72">
              {selectedSignal.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={selectedSignal}>
                    <CartesianGrid stroke="#fecaca" strokeDasharray="2 2" />

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
                        if (name === "value") return [`${value} °`, "Sinal"];
                        if (name === "peak") return [`${value} °`, "Picos"];
                        if (name === "valley") return [`${value} °`, "Vales"];
                        return [String(value), String(name)];
                      }}
                    />

                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#b91c1c"
                      strokeWidth={2.5}
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
                        r: 4,
                        fill: "#111827",
                        stroke: "#ffffff",
                        strokeWidth: 1.5,
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
                        strokeWidth: 1.8,
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 text-center text-sm font-medium text-slate-500">
                  Sem sinal processado para a sessão {selectedSession}. Se o worker já rodou, o mapper do dashboard ainda não entregou o payload certo.
                </div>
              )}
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
  );
}