import { Activity, CalendarDays, ChevronDown, ClipboardList } from "lucide-react";

import { Card } from "../ui/Card";
import type { IvcfClassification, IvcfSession } from "../../types/participant";

type Props = {
  sessions: IvcfSession[];
  selectedSession: number;
  onSelectSession: (session: number) => void;
};

function IvcfBadge({ value }: { value?: IvcfClassification }) {
  const styles =
    value === "Frágil"
      ? "border-red-200 bg-red-100 text-red-700"
      : value === "Pré-Frágil"
        ? "border-amber-200 bg-amber-100 text-amber-700"
        : value === "Robusto"
          ? "border-emerald-200 bg-emerald-100 text-emerald-700"
          : "border-slate-200 bg-slate-100 text-slate-600";

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${styles}`}>
      {value || "Sem classificação"}
    </span>
  );
}

export function Ivcf20Section({
  sessions,
  selectedSession,
  onSelectSession,
}: Props) {
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
              Detalhes do questionário exibidos apenas quando o card do IVCF é aberto.
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
                <ClipboardList size={20} />
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
                Sem gráfico de barra cafona. Sessões clicáveis e pronto.
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