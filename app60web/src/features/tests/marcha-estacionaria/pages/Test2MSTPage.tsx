import { Activity, ClipboardList, Users } from "lucide-react";
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
import { AppHeader } from "../../../../components/layout/AppHeader";
import { StatCard } from "../../../../components/ui/StatCard";
import type { Participant } from "../../../../types/participant";
import { listParticipants } from "../../../participants/services/participants";
import { summarize2Mst } from "../../lib/overview";

export function Test2MSTPage() {
  const [participants, setParticipants] = useState<Participant[]>([]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const data = await listParticipants();
      if (!mounted) return;
      setParticipants(data.filter((participant) => participant.id !== "example-maria-silva"));
    }
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const { stats, monthly, list } = useMemo(() => summarize2Mst(participants), [participants]);

  return (
    <div>
      <AppHeader
        title="2MST - Visão Geral"
        subtitle="Resumo geral do teste de marcha estacionária com todos os participantes."
      />

      <div className="space-y-6 p-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <StatCard
            title="Participantes Totais"
            value={stats.participantes}
            icon={Users}
            subtitle="Participantes com cadastro"
          />
          <StatCard
            title="Coletas no Mês"
            value={stats.coletasMes}
            icon={ClipboardList}
            subtitle="Coletas recentes do 2MST"
          />
          <StatCard
            title="Coletas Totais"
            value={stats.coletasTotal}
            icon={Activity}
            subtitle="Histórico acumulado"
          />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
          <h2 className="mb-6 text-lg font-bold text-slate-900">
            Volume de Coletas
          </h2>
          <div className="h-[380px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                <Tooltip cursor={{ fill: "#f8fafc" }} contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }} />
                <Bar dataKey="coletas" radius={[6, 6, 0, 0]} barSize={40} fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
          <h2 className="mb-6 text-lg font-bold text-slate-900">
            Participantes com 2MST
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-6 py-4">Participante</th>
                  <th className="px-6 py-4">Sessões</th>
                  <th className="px-6 py-4">Última Data</th>
                  <th className="px-6 py-4">Última Repetição</th>
                  <th className="px-6 py-4">Última Cadência</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((item) => (
                  <tr key={item.participantId}>
                    <td className="px-6 py-4 font-medium text-slate-800">
                      {item.participantName}
                    </td>
                    <td className="px-6 py-4 text-slate-500">{item.sessoes}</td>
                    <td className="px-6 py-4 text-slate-500">{item.ultimaData}</td>
                    <td className="px-6 py-4 text-slate-500">{item.repeticoesUltima}</td>
                    <td className="px-6 py-4 text-slate-500">{item.cadenciaUltima}</td>
                  </tr>
                ))}
                {list.length === 0 ? (
                  <tr>
                    <td className="px-6 py-6 text-slate-500" colSpan={5}>
                      Ainda não existem dados reais de 2MST vinculados aos participantes.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}