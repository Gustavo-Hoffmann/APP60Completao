import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  CalendarDays,
  ChevronDown,
  Footprints,
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
import type { Participant, TwoMstSession } from "../../types/participant";

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
    <Card className={`p-5 shadow-sm ${tone.wrap}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-xs font-bold uppercase tracking-[0.18em] ${tone.title}`}>
            Estratégia
          </p>
          <div className={`mt-2 text-2xl font-black ${tone.value}`}>{strategy ?? "—"}</div>
          <p className="mt-2 text-sm text-slate-500">{tone.sub}</p>
        </div>
        <div className={`rounded-2xl border p-3 ${tone.icon}`}>
          <BarChart3 size={20} />
        </div>
      </div>
    </Card>
  );
}

type Props = {
  participant: Participant;
};

export function TwoMstSection({ participant }: Props) {
  const sessions = useMemo(() => participant.tests?.twoMstSessions ?? [], [participant]);
  const [selectedSession, setSelectedSession] = useState<number>(1);

  const lastSession = sessions[sessions.length - 1];
  const selectedSignal = participant.tests?.twoMstSignals?.[selectedSession] ?? [];
  const signalStart = selectedSignal.length ? selectedSignal[0].time.toFixed(1) : "0.0";
  const signalEnd = selectedSignal.length
    ? selectedSignal[selectedSignal.length - 1].time.toFixed(1)
    : "0.0";

  useEffect(() => {
    if (lastSession?.sessao) {
      setSelectedSession(lastSession.sessao);
    }
  }, [lastSession?.sessao]);

  if (!sessions.length) return null;

  return (
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

        <StrategyCard strategy={lastSession?.strategy} />
      </section>

      <section>
        <Card className="p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <Activity size={18} className="text-emerald-600" />
            <h2 className="text-lg font-black text-slate-900">2MST — evolução de repetições</h2>
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
                    stroke="#dc2626"
                    strokeWidth={2}
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
            <span>{signalStart}s</span>
            <span>Tempo (s)</span>
            <span>{signalEnd}s</span>
          </div>
        </Card>
      </section>
    </>
  );
}