import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { routes } from "../../../navigation/routes";
import type { Participant } from "../../../types/participant";
import { getParticipantById } from "../services/participants";

function DetailItem({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-sm font-medium text-slate-800">{value || "—"}</div>
    </div>
  );
}

export function ParticipantDetailPage() {
  const { id = "" } = useParams();
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getParticipantById(id);
        if (!mounted) return;
        setParticipant(data);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Erro ao carregar participante.");
      } finally {
        if (!mounted) return;
        setIsLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [id]);

  if (isLoading) {
    return <div className="text-sm text-slate-500">Carregando participante...</div>;
  }

  if (error) {
    return <div className="text-sm text-rose-600">{error}</div>;
  }

  if (!participant) {
    return <div className="text-sm text-slate-500">Participante não encontrado.</div>;
  }

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link to={routes.participants} className="text-sm font-medium text-blue-700 hover:underline">
            ← Voltar para participantes
          </Link>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
            {participant.name}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {participant.id === "example-maria-silva"
              ? "Participante exemplo fixo enquanto o fluxo real é populado."
              : "Dados do participante vinculados ao Supabase."}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DetailItem label="CPF" value={participant.cpf} />
        <DetailItem label="Idade" value={participant.age ? `${participant.age} anos` : "—"} />
        <DetailItem label="Sexo" value={participant.sex} />
        <DetailItem
          label="Cidade / Estado"
          value={[participant.city, participant.state].filter(Boolean).join(" / ")}
        />
        <DetailItem label="Data de nascimento" value={participant.dob} />
        <DetailItem label="Criado por" value={participant.createdByUserId} />
        <DetailItem label="Professor" value={participant.professorId} />
        <DetailItem label="Aluno dono" value={participant.studentId} />
      </div>
    </section>
  );
}