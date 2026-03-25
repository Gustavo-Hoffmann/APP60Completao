import { Activity, HeartPulse, Search, UserRound, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { AppHeader } from "../../../components/layout/AppHeader";
import { Card } from "../../../components/ui/Card";
import { routes } from "../../../navigation/routes";
import type { Participant } from "../../../types/participant";
import { listParticipants } from "../services/participants";

function getIvcfBadgeStyles(ivcfClass?: Participant["ivcfClass"]) {
  if (ivcfClass === "Frágil") {
    return "border-red-200 bg-red-100 text-red-700";
  }
  if (ivcfClass === "Pré-Frágil") {
    return "border-amber-200 bg-amber-100 text-amber-700";
  }
  if (ivcfClass === "Robusto") {
    return "border-emerald-200 bg-emerald-100 text-emerald-700";
  }
  return "border-slate-200 bg-slate-100 text-slate-500";
}

function PremiumMetricCard({
  label,
  value,
  subtitle,
  icon: Icon,
}: {
  label: string;
  value: number;
  subtitle: string;
  icon: typeof UserRound;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
            {label}
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
          <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
        </div>

        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3 text-blue-700">
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

export function ParticipantsPage() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setIsLoading(true);
        setError(null);
        const data = await listParticipants();
        if (!mounted) return;
        setParticipants(data);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Erro ao carregar participantes.");
      } finally {
        if (!mounted) return;
        setIsLoading(false);
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return participants;

    return participants.filter((participant) => {
      const cityState = [participant.city, participant.state].filter(Boolean).join(" / ");

      return [participant.name, participant.cpf, cityState]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [participants, search]);

  const stats = useMemo(() => {
    return {
      total: participants.length,
      with2Mst: participants.filter((participant) => participant.tests?.has2MST).length,
      fragile: participants.filter((participant) => participant.ivcfClass === "Frágil").length,
    };
  }, [participants]);

  return (
    <div className="min-h-screen bg-slate-100">
      <AppHeader
        title="Participantes"
        subtitle="Lista geral de participantes cadastrados."
      />

      <main className="space-y-6 px-6 py-8">
        <section className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div />

          <div className="relative w-full max-w-md">
            <Search
              size={18}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Buscar por nome, CPF ou cidade..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <PremiumMetricCard
            label="Total"
            value={stats.total}
            subtitle="Participantes cadastrados"
            icon={UserRound}
          />
          <PremiumMetricCard
            label="2MST disponível"
            value={stats.with2Mst}
            subtitle="Participantes com marcha processada"
            icon={Activity}
          />
          <PremiumMetricCard
            label="IVCF frágil"
            value={stats.fragile}
            subtitle="Última classificação com maior atenção"
            icon={HeartPulse}
          />
        </section>

        <section>
          {isLoading ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="text-slate-500">Carregando participantes...</div>
            </div>
          ) : error ? (
            <div className="rounded-3xl border border-red-200 bg-red-50 p-6 shadow-sm">
              <p className="font-semibold text-red-700">Erro ao carregar participantes</p>
              <p className="mt-1 text-sm text-red-600">{error}</p>
            </div>
          ) : (
            <Card className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-white">
                    <tr className="border-b border-slate-200 text-left text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                      <th className="px-6 py-5">Nome</th>
                      <th className="px-6 py-5">CPF</th>
                      <th className="px-6 py-5">Idade</th>
                      <th className="px-6 py-5">Sexo</th>
                      <th className="px-6 py-5">Cidade</th>
                      <th className="px-6 py-5">IVCF-20</th>
                      <th className="px-6 py-5 text-right">Abrir</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filtered.map((participant, index) => {
                      const cityState =
                        [participant.city, participant.state].filter(Boolean).join(" / ") || "—";

                      const isExample = participant.id === "example-maria-silva";

                      return (
                        <tr
                          key={participant.id}
                          className={[
                            "border-t border-slate-100 transition-colors hover:bg-slate-50",
                            isExample ? "bg-slate-50/70" : "bg-white",
                            index === 0 ? "border-t-0" : "",
                          ].join(" ")}
                        >
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              <span className="font-semibold text-slate-900">
                                {participant.name}
                              </span>

                              {isExample ? (
                                <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-blue-700">
                                  Exemplo
                                </span>
                              ) : null}
                            </div>
                          </td>

                          <td className="px-6 py-5 text-slate-600">{participant.cpf || "—"}</td>
                          <td className="px-6 py-5 text-slate-600">{participant.age || "—"}</td>
                          <td className="px-6 py-5 text-slate-600">{participant.sex || "—"}</td>
                          <td className="px-6 py-5 text-slate-600">{cityState}</td>
                          <td className="px-6 py-5">
                            {participant.ivcfClass ? (
                              <div className="flex flex-col gap-2">
                                <div className="text-sm font-black text-slate-900">
                                  {participant.ivcfScore ?? "—"} pontos
                                </div>
                                <span
                                  className={[
                                    "inline-flex w-fit rounded-full border px-3 py-1 text-xs font-bold",
                                    getIvcfBadgeStyles(participant.ivcfClass),
                                  ].join(" ")}
                                >
                                  {participant.ivcfClass}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400">Sem coleta</span>
                            )}
                          </td>
                          <td className="px-6 py-5 text-right">
                            <Link
                              to={routes.participantDetail(participant.id)}
                              className="inline-flex items-center gap-1 font-semibold text-blue-700 transition hover:text-blue-900"
                            >
                              Ver
                              <ChevronRight size={16} />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}

                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-10 text-center">
                          <p className="font-semibold text-slate-700">
                            Nenhum participante encontrado.
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            Ajusta a busca ou confere os dados.
                          </p>
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </section>
      </main>
    </div>
  );
}