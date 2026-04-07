import { useEffect, useState } from "react";
import {
  ClipboardList,
  Map,
  Maximize2,
  Users,
  ArrowLeft,
} from "lucide-react";
import { AppHeader } from "../../../components/layout/AppHeader";
import { StatCard } from "../../../components/ui/StatCard";
import { statsData } from "../../../mocks/stats";

declare global {
  interface Window {
    google?: typeof google;
  }
}

const mapData: (string | number)[][] = [
  ["Estado", "Coletas"],
  ["BR-AC", 120],
  ["BR-AL", 250],
  ["BR-AP", 80],
  ["BR-AM", 300],
  ["BR-BA", 890],
  ["BR-CE", 600],
  ["BR-DF", 750],
  ["BR-ES", 400],
  ["BR-GO", 550],
  ["BR-MA", 350],
  ["BR-MT", 420],
  ["BR-MS", 380],
  ["BR-MG", 1100],
  ["BR-PA", 310],
  ["BR-PB", 280],
  ["BR-PR", 1200],
  ["BR-PE", 500],
  ["BR-PI", 220],
  ["BR-RJ", 950],
  ["BR-RN", 260],
  ["BR-RS", 880],
  ["BR-RO", 180],
  ["BR-RR", 90],
  ["BR-SC", 750],
  ["BR-SP", 1500],
  ["BR-SE", 150],
  ["BR-TO", 200],
];

const stateInfo: Record<string, { name: string; id: string }> = {
  "BR-AC": { name: "Acre", id: "AC" },
  "BR-AL": { name: "Alagoas", id: "AL" },
  "BR-AP": { name: "Amapá", id: "AP" },
  "BR-AM": { name: "Amazonas", id: "AM" },
  "BR-BA": { name: "Bahia", id: "BA" },
  "BR-CE": { name: "Ceará", id: "CE" },
  "BR-DF": { name: "Distrito Federal", id: "DF" },
  "BR-ES": { name: "Espírito Santo", id: "ES" },
  "BR-GO": { name: "Goiás", id: "GO" },
  "BR-MA": { name: "Maranhão", id: "MA" },
  "BR-MT": { name: "Mato Grosso", id: "MT" },
  "BR-MS": { name: "Mato Grosso do Sul", id: "MS" },
  "BR-MG": { name: "Minas Gerais", id: "MG" },
  "BR-PA": { name: "Pará", id: "PA" },
  "BR-PB": { name: "Paraíba", id: "PB" },
  "BR-PR": { name: "Paraná", id: "PR" },
  "BR-PE": { name: "Pernambuco", id: "PE" },
  "BR-PI": { name: "Piauí", id: "PI" },
  "BR-RJ": { name: "Rio de Janeiro", id: "RJ" },
  "BR-RN": { name: "Rio Grande do Norte", id: "RN" },
  "BR-RS": { name: "Rio Grande do Sul", id: "RS" },
  "BR-RO": { name: "Rondônia", id: "RO" },
  "BR-RR": { name: "Roraima", id: "RR" },
  "BR-SC": { name: "Santa Catarina", id: "SC" },
  "BR-SP": { name: "São Paulo", id: "SP" },
  "BR-SE": { name: "Sergipe", id: "SE" },
  "BR-TO": { name: "Tocantins", id: "TO" },
  default: { name: "Estado selecionado", id: "BR" },
};

const cityDataMock: Record<
  string,
  Array<{ name: string; coletas: number; status: "high" | "medium" | "low" }>
> = {
  PR: [
    { name: "Curitiba", coletas: 500, status: "high" },
    { name: "Araucária", coletas: 300, status: "medium" },
    { name: "Londrina", coletas: 200, status: "medium" },
    { name: "Maringá", coletas: 150, status: "low" },
    { name: "Ponta Grossa", coletas: 50, status: "low" },
  ],
  SP: [
    { name: "São Paulo", coletas: 400, status: "high" },
    { name: "Campinas", coletas: 200, status: "medium" },
    { name: "Santos", coletas: 100, status: "low" },
  ],
  SC: [
    { name: "Florianópolis", coletas: 150, status: "medium" },
    { name: "Joinville", coletas: 100, status: "low" },
  ],
};

type SelectedState = {
  name: string;
  id: string;
  coletas: number;
};

function GoogleGeoChart({
  onSelectState,
  isDark,
}: {
  onSelectState: (state: SelectedState) => void;
  isDark: boolean;
}) {
  const [chartLoaded, setChartLoaded] = useState(false);

  useEffect(() => {
    if (!window.google) {
      const script = document.createElement("script");
      script.src = "https://www.gstatic.com/charts/loader.js";
      script.onload = () => {
        if (window.google) {
          window.google.charts.load("current", { packages: ["geochart"] });
          window.google.charts.setOnLoadCallback(() => setChartLoaded(true));
        }
      };
      document.body.appendChild(script);
    } else {
      window.google.charts.load("current", { packages: ["geochart"] });
      window.google.charts.setOnLoadCallback(() => setChartLoaded(true));
    }
  }, []);

  useEffect(() => {
    if (!chartLoaded || !window.google) return;

    const drawChart = () => {
      const container = document.getElementById("google-map-container");
      if (!container || !window.google) return;

      const data = window.google.visualization.arrayToDataTable(mapData);

      const options = {
        region: "BR",
        resolution: "provinces",
        colorAxis: isDark
          ? { colors: ["#bfdbfe", "#172554"] }
          : { colors: ["#dbeafe", "#2563eb"] },
        backgroundColor: "transparent",
        datalessRegionColor: isDark ? "#0f172a" : "#f8fafc",
        defaultColor: isDark ? "#1e293b" : "#f1f5f9",
        legend: "none",
        tooltip: {
          textStyle: { color: isDark ? "#dbeafe" : "#334155" },
          showColorCode: true,
        },
        enableRegionInteractivity: true,
      };

      const chart = new window.google.visualization.GeoChart(container);

      window.google.visualization.events.addListener(chart, "select", () => {
        const selection = chart.getSelection();
        if (selection.length > 0) {
          const row = selection[0].row;
          const isoCode = String(mapData[row + 1][0]);
          const baseInfo = stateInfo[isoCode] || stateInfo.default;
          const stateDetails = {
            ...baseInfo,
            coletas: Number(mapData[row + 1][1]),
          };
          onSelectState(stateDetails);
        }
      });

      chart.draw(data, options);
    };

    drawChart();
    window.addEventListener("resize", drawChart);
    return () => window.removeEventListener("resize", drawChart);
  }, [chartLoaded, onSelectState, isDark]);

  return (
    <div
      className={[
        "relative flex h-[600px] w-full items-center justify-center rounded-2xl",
        isDark ? "bg-blue-400/25" : "bg-slate-50/60",
      ].join(" ")}
    >
      <div
        id="google-map-container"
        className="h-full w-full overflow-hidden rounded-2xl"
      />
      <div
        className={[
          "pointer-events-none absolute bottom-4 left-4 rounded-xl border p-3 text-xs shadow-sm backdrop-blur-sm",
          isDark
            ? "border-slate-700 bg-slate-950/85"
            : "border-slate-200 bg-white/95",
        ].join(" ")}
      >
        <p className={["mb-2 font-bold", isDark ? "text-slate-200" : "text-slate-700"].join(" ")}>
          Densidade
        </p>
        <div className="mb-1 flex items-center gap-2">
          <div
            className={[
              "h-2 w-20 rounded-full",
              isDark
                ? "bg-gradient-to-r from-blue-200 to-blue-900"
                : "bg-gradient-to-r from-blue-100 to-blue-600",
            ].join(" ")}
          />
        </div>
        <div className={["flex justify-between text-[10px]", isDark ? "text-slate-400" : "text-slate-500"].join(" ")}>
          <span>Baixa</span>
          <span>Alta</span>
        </div>
      </div>
    </div>
  );
}

function CityDetailView({
  state,
  onBack,
  isDark,
}: {
  state: SelectedState;
  onBack: () => void;
  isDark: boolean;
}) {
  const cities = cityDataMock[state.id] || [];

  return (
    <div
      className={[
        "flex h-[600px] flex-col rounded-2xl border shadow-sm",
        isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white",
      ].join(" ")}
    >
      <div
        className={[
          "flex items-center justify-between rounded-t-2xl border-b px-4 py-4",
          isDark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50",
        ].join(" ")}
      >
        <button
          onClick={onBack}
          className={[
            "flex items-center text-sm font-medium transition-colors hover:text-blue-500",
            isDark ? "text-slate-300" : "text-slate-500",
          ].join(" ")}
        >
          <ArrowLeft size={16} className="mr-2" />
          Voltar ao mapa nacional
        </button>
        <h3 className={["text-lg font-bold", isDark ? "text-slate-100" : "text-slate-700"].join(" ")}>
          {state.name}
        </h3>
      </div>

      <div className={["flex-1 overflow-y-auto p-6", isDark ? "bg-slate-900" : "bg-slate-50/50"].join(" ")}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cities.length > 0 ? (
            cities.map((city, idx) => (
              <div
                key={`${city.name}-${idx}`}
                className="rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-blue-200 hover:shadow-md"
              >
                <div className="mb-2 flex items-start justify-between">
                  <div
                    className={`h-3 w-3 rounded-full ${
                      city.status === "high"
                        ? "bg-blue-600"
                        : city.status === "medium"
                          ? "bg-amber-400"
                          : "bg-slate-300"
                    }`}
                  />
                  {city.status === "high" ? (
                    <div className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                      TOP
                    </div>
                  ) : null}
                </div>

                <h4 className="mb-1 font-bold text-slate-700">{city.name}</h4>

                <div className="flex items-baseline space-x-1">
                  <span className="text-2xl font-bold text-slate-800">{city.coletas}</span>
                  <span className="text-xs font-medium text-slate-500">coletas</span>
                </div>

                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${
                      city.status === "high"
                        ? "bg-blue-600"
                        : city.status === "medium"
                          ? "bg-amber-400"
                          : "bg-slate-400"
                    }`}
                    style={{ width: `${(city.coletas / 600) * 100}%` }}
                  />
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-slate-400">
              <Map size={48} className="mb-4 opacity-20" />
              <p>Sem dados detalhados de cidades para este estado.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const [selectedState, setSelectedState] = useState<SelectedState | null>(null);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const updateTheme = () => setIsDark(root.classList.contains("dark"));

    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-slate-100">
      <AppHeader
        title="Dashboard"
        subtitle="Visão geral operacional do sistema."
      />

      <main className="space-y-6 p-6">
        <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
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
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Mapeamento territorial</h2>
              <p className="mt-1 text-sm text-slate-500">
                Interaja com o mapa para visualizar a distribuição das coletas.
              </p>
            </div>

            {selectedState ? (
              <span className="hidden rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700 md:inline-block">
                Filtro ativo: {selectedState.name}
              </span>
            ) : (
              <button
                className="text-slate-400 transition-colors hover:text-blue-600"
                title="Expandir"
                type="button"
              >
                <Maximize2 size={18} />
              </button>
            )}
          </div>

          {selectedState ? (
            <CityDetailView state={selectedState} onBack={() => setSelectedState(null)} isDark={isDark} />
          ) : (
            <GoogleGeoChart onSelectState={setSelectedState} isDark={isDark} />
          )}
        </section>
      </main>
    </div>
  );
}