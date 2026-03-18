import { Activity, ClipboardList, Repeat, Users, Waves } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppHeader } from "../../../../components/layout/AppHeader";
import { StatCard } from "../../../../components/ui/StatCard";
import {
  monthlyDataUTT,
  participantUTTList,
  statsDataUTT,
} from "../mocks";

export function TestUTTPage() {
  return (
    <div>
      <AppHeader
        title="UTT - Visão Geral"
        subtitle="Resumo geral do Up on the Toes Test com todos os participantes."
      />

      <div className="space-y-6 p-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          <StatCard
            title="Participantes Totais"
            value={statsDataUTT.participantes}
            icon={Users}
            subtitle="Participantes com UTT"
          />
          <StatCard
            title="Coletas no Mês"
            value={statsDataUTT.coletasMes}
            icon={ClipboardList}
            subtitle="Sessões recentes"
          />
          <StatCard
            title="Repetições Médias"
            value={statsDataUTT.repsMedias}
            icon={Repeat}
            subtitle="Repetições por teste"
          />
          <StatCard
            title="Amplitude Média"
            value={`${statsDataUTT.amplitudeMedia}°`}
            icon={Waves}
            subtitle="Amplitude angular"
          />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
          <h2 className="mb-6 text-lg font-bold text-slate-900">
            Volume de Coletas
          </h2>
          <div className="h-[380px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={monthlyDataUTT}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e2e8f0"
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                />
                <Tooltip
                  cursor={{ fill: "#f8fafc" }}
                  contentStyle={{
                    borderRadius: 12,
                    border: "none",
                    boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                  }}
                />
                <Bar
                  dataKey="coletas"
                  radius={[6, 6, 0, 0]}
                  barSize={40}
                  fill="#2563eb"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
          <h2 className="mb-6 text-lg font-bold text-slate-900">
            Participantes com UTT
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-6 py-4">Participante</th>
                  <th className="px-6 py-4">Sessões</th>
                  <th className="px-6 py-4">Última Data</th>
                  <th className="px-6 py-4">Reps Última</th>
                  <th className="px-6 py-4">Amplitude Média</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {participantUTTList.map((item) => (
                  <tr key={item.participantId}>
                    <td className="px-6 py-4 font-medium text-slate-800">
                      {item.participantName}
                    </td>
                    <td className="px-6 py-4 text-slate-500">{item.sessoes}</td>
                    <td className="px-6 py-4 text-slate-500">{item.ultimaData}</td>
                    <td className="px-6 py-4 text-slate-500">
                      {item.repsUltima}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {item.amplitudeMediaUltima}°
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}