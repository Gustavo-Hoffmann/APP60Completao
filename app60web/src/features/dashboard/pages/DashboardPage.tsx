import { ClipboardList, Map, Users } from "lucide-react";
import { AppHeader } from "../../../components/layout/AppHeader";
import { StatCard } from "../../../components/ui/StatCard";
import { statsData } from "../../../mocks/stats";

export function DashboardPage() {
  return (
    <div>
      <AppHeader
        title="Dashboard"
        subtitle="Visão geral operacional do sistema."
      />

      <div className="space-y-6 p-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <StatCard
            title="Participantes Totais"
            value={statsData.participants}
            icon={Users}
            subtitle="Base geral cadastrada"
          />
          <StatCard
            title="Coletas no Mês"
            value={statsData.collectionsMonth}
            icon={ClipboardList}
            subtitle="Volume mensal atual"
          />
          <StatCard
            title="Estados Ativos"
            value={statsData.activeStates}
            icon={Map}
            subtitle="Cobertura atual"
          />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
          <h2 className="text-lg font-bold text-slate-900">Próximos passos</h2>
          <p className="mt-2 text-sm text-slate-500">
            Aqui entraremos com gráficos, mapa, filtros por papel e indicadores por teste.
          </p>
        </div>
      </div>
    </div>
  );
}