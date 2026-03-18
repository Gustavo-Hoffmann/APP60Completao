import { ClipboardList, Users } from "lucide-react";
import { AppHeader } from "../../../components/layout/AppHeader";
import { StatCard } from "../../../components/ui/StatCard";
import { participantsMock } from "../../../mocks/participants";

export function QuestionnairesPage() {
  const total = participantsMock.length;
  const fragile = participantsMock.filter((p) => p.ivcfClass === "Frágil").length;
  const preFragile = participantsMock.filter((p) => p.ivcfClass === "Pré-Frágil").length;

  return (
    <div>
      <AppHeader
        title="Questionários"
        subtitle="Visão geral dos instrumentos aplicados."
      />

      <div className="space-y-6 p-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <StatCard
            title="Participantes Avaliados"
            value={total}
            icon={Users}
            subtitle="Base com questionários"
          />
          <StatCard
            title="Frágeis"
            value={fragile}
            icon={ClipboardList}
            subtitle="IVCF-20"
          />
          <StatCard
            title="Pré-Frágeis"
            value={preFragile}
            icon={ClipboardList}
            subtitle="IVCF-20"
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-6 py-4">Participante</th>
                <th className="px-6 py-4">Pontuação</th>
                <th className="px-6 py-4">Classificação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {participantsMock.map((participant) => (
                <tr key={participant.id}>
                  <td className="px-6 py-4 font-medium text-slate-800">
                    {participant.name}
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {participant.ivcfScore ?? "-"}
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {participant.ivcfClass ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}