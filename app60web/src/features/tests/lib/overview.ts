import type { Participant, Sl30sSession, TwoMstSession } from "../../../types/participant";

type MonthBucket = { name: string; coletas: number };

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function parseBrDate(value?: string) {
  if (!value) return null;
  const parts = value.split("/");
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts;
  const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function buildMonthlyCollections(dates: Array<string | undefined>): MonthBucket[] {
  const buckets = new Array<number>(12).fill(0);

  for (const dateLabel of dates) {
    const date = parseBrDate(dateLabel);
    if (!date) continue;
    buckets[date.getMonth()] += 1;
  }

  return MONTH_LABELS.map((name, index) => ({ name, coletas: buckets[index] }));
}

export function summarize2Mst(participants: Participant[]) {
  const with2Mst = participants.filter((p) => p.tests?.has2MST && (p.tests?.twoMstSessions?.length ?? 0) > 0);
  const sessions = with2Mst.flatMap((p) => p.tests?.twoMstSessions ?? []);
  const latestDate = sessions[sessions.length - 1]?.date;
  const latestMonth = parseBrDate(latestDate)?.getMonth();

  const list = with2Mst.map((participant) => {
    const participantSessions = participant.tests?.twoMstSessions ?? [];
    const last = participantSessions[participantSessions.length - 1] as TwoMstSession | undefined;
    return {
      participantId: participant.id,
      participantName: participant.name,
      sessoes: participantSessions.length,
      ultimaData: last?.date ?? "-",
      repeticoesUltima: last?.repeticoes ?? "-",
      cadenciaUltima: last?.cadencia ?? "-",
    };
  });

  return {
    stats: {
      participantes: with2Mst.length,
      coletasMes:
        latestMonth == null
          ? 0
          : sessions.filter((session) => parseBrDate(session.date)?.getMonth() === latestMonth).length,
      coletasTotal: sessions.length,
    },
    monthly: buildMonthlyCollections(sessions.map((s) => s.date)),
    list,
  };
}

export function summarizeSl30s(participants: Participant[]) {
  const withSl30s = participants.filter((p) => p.tests?.hasSL30S && (p.tests?.sl30sSessions?.length ?? 0) > 0);
  const sessions = withSl30s.flatMap((p) => p.tests?.sl30sSessions ?? []);
  const latestDate = sessions[sessions.length - 1]?.date;
  const latestMonth = parseBrDate(latestDate)?.getMonth();

  const repsAverage =
    sessions.length > 0
      ? Number(
          (sessions.reduce((acc, session) => acc + (session.repeticoes ?? 0), 0) / sessions.length).toFixed(1),
        )
      : 0;

  const list = withSl30s.map((participant) => {
    const participantSessions = participant.tests?.sl30sSessions ?? [];
    const last = participantSessions[participantSessions.length - 1] as Sl30sSession | undefined;
    return {
      participantId: participant.id,
      participantName: participant.name,
      sessoes: participantSessions.length,
      ultimaData: last?.date ?? "-",
      repsUltima: last?.repeticoes ?? "-",
      cadenciaUltima: last?.frequenciaMedia ?? "-",
    };
  });

  return {
    stats: {
      participantes: withSl30s.length,
      coletasMes:
        latestMonth == null
          ? 0
          : sessions.filter((session) => parseBrDate(session.date)?.getMonth() === latestMonth).length,
      repsMedias: repsAverage,
      coletasTotal: sessions.length,
    },
    monthly: buildMonthlyCollections(sessions.map((s) => s.date)),
    list,
  };
}
