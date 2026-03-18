import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { routes } from "../../../navigation/routes";
import type { Participant } from "../../../types/participant";
import { listParticipants } from "../services/participants";

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

    return participants.filter((p) =>
      [p.name, p.cpf, p.ivcfClass, p.city, p.state]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }, [participants, search]);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Participantes</h1>
          <p className="mt-1 text-sm text-slate-500">
            Lista geral de participantes cadastrados.
          </p>
        </div>

        <div className="w-full max-w-sm">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="px-6 py-10 text-sm text-slate-500">Carregando participantes...</div>
        ) : error ? (
          <div className="px-6 py-10 text-sm text-rose-600">{error}</div>
        ) : (
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                <th className="px-6 py-4">Nome</th>
                <th className="px-6 py-4">CPF</th>
                <th className="px-6 py-4">Idade</th>
                <th className="px-6 py-4">Sexo</th>
                <th className="px-6 py-4">Cidade</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((participant, index) => (
                <tr
                  key={participant.id}
                  className={`border-t border-slate-100 ${index === 0 ? "bg-blue-50/60" : "bg-white"}`}
                >
                  <td className="px-6 py-4">
                    <Link
                      to={routes.participantDetail(participant.id)}
                      className="font-semibold text-blue-700 hover:underline"
                    >
                      {participant.name}
                      {index === 0 ? " • sujeito exemplo" : ""}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{participant.cpf || "—"}</td>
                  <td className="px-6 py-4 text-slate-600">{participant.age || "—"}</td>
                  <td className="px-6 py-4 text-slate-600">{participant.sex || "—"}</td>
                  <td className="px-6 py-4 text-slate-600">
                    {[participant.city, participant.state].filter(Boolean).join(" / ") || "—"}
                  </td>
                </tr>
              ))}

              {!filtered.length ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-sm text-slate-500">
                    Nenhum participante encontrado.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}