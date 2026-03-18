export const statsDataTUG = {
    participantes: 910,
    coletasMes: 224,
    coletasTotal: 4180,
    tempoMedio: 8.7,
    passosMedios: 14,
  };
  
  export const monthlyDataTUG = [
    { name: "Jan", coletas: 48 },
    { name: "Fev", coletas: 60 },
    { name: "Mar", coletas: 74 },
    { name: "Abr", coletas: 88 },
    { name: "Mai", coletas: 95 },
    { name: "Jun", coletas: 112 },
    { name: "Jul", coletas: 126 },
    { name: "Ago", coletas: 141 },
    { name: "Set", coletas: 155 },
    { name: "Out", coletas: 168 },
    { name: "Nov", coletas: 179 },
    { name: "Dez", coletas: 194 },
  ];
  
  export const participantTUGList = [
    {
      participantId: "p1",
      participantName: "Maria Silva",
      sessoes: 4,
      ultimaData: "25/08",
      tempoTotalUltimo: 7.9,
      cadenciaUltima: 104,
    },
    {
      participantId: "p2",
      participantName: "João Santos",
      sessoes: 3,
      ultimaData: "20/08",
      tempoTotalUltimo: 8.6,
      cadenciaUltima: 96,
    },
    {
      participantId: "p3",
      participantName: "Ana Oliveira",
      sessoes: 2,
      ultimaData: "10/08",
      tempoTotalUltimo: 9.2,
      cadenciaUltima: 90,
    },
  ];
  
  const generateTUGSignal = (durationSeconds = 12) => {
    const data: Array<{ time: string; value: number }> = [];
    const sampleRate = 20;
    const totalPoints = durationSeconds * sampleRate;
  
    for (let i = 0; i < totalPoints; i++) {
      const t = i / sampleRate;
  
      let value =
        Math.sin(t * 7) * 18 +
        Math.sin(t * 2.2) * 8 +
        (Math.random() - 0.5) * 5;
  
      if (t > 3.5 && t < 5.2) value += 22;
      if (t > 8.0 && t < 9.4) value -= 18;
  
      data.push({
        time: t.toFixed(2),
        value: Number(value.toFixed(2)),
      });
    }
  
    return data;
  };
  
  export const tugSummaryByParticipant: Record<
    string,
    Array<{
      sessao: number;
      date: string;
      tempoTotal: number;
      numeroPassos: number;
      cadencia: number;
      tempoLevantar: number;
      tempoCaminhadaIda: number;
      tempoGiro: number;
      tempoCaminhadaVolta: number;
      tempoSentar: number;
    }>
  > = {
    p1: [
      {
        sessao: 1,
        date: "10/05",
        tempoTotal: 8.8,
        numeroPassos: 15,
        cadencia: 102,
        tempoLevantar: 1.22,
        tempoCaminhadaIda: 2.12,
        tempoGiro: 1.38,
        tempoCaminhadaVolta: 2.45,
        tempoSentar: 1.63,
      },
      {
        sessao: 2,
        date: "15/06",
        tempoTotal: 8.4,
        numeroPassos: 14,
        cadencia: 103,
        tempoLevantar: 1.15,
        tempoCaminhadaIda: 2.05,
        tempoGiro: 1.31,
        tempoCaminhadaVolta: 2.34,
        tempoSentar: 1.55,
      },
      {
        sessao: 3,
        date: "20/07",
        tempoTotal: 8.2,
        numeroPassos: 14,
        cadencia: 103,
        tempoLevantar: 1.11,
        tempoCaminhadaIda: 2.01,
        tempoGiro: 1.26,
        tempoCaminhadaVolta: 2.28,
        tempoSentar: 1.48,
      },
      {
        sessao: 4,
        date: "25/08",
        tempoTotal: 7.9,
        numeroPassos: 13,
        cadencia: 104,
        tempoLevantar: 1.05,
        tempoCaminhadaIda: 1.92,
        tempoGiro: 1.18,
        tempoCaminhadaVolta: 2.19,
        tempoSentar: 1.41,
      },
    ],
    p2: [
      {
        sessao: 1,
        date: "12/05",
        tempoTotal: 9.2,
        numeroPassos: 15,
        cadencia: 94,
        tempoLevantar: 1.33,
        tempoCaminhadaIda: 2.22,
        tempoGiro: 1.46,
        tempoCaminhadaVolta: 2.61,
        tempoSentar: 1.58,
      },
      {
        sessao: 2,
        date: "18/06",
        tempoTotal: 8.9,
        numeroPassos: 14,
        cadencia: 95,
        tempoLevantar: 1.28,
        tempoCaminhadaIda: 2.16,
        tempoGiro: 1.39,
        tempoCaminhadaVolta: 2.49,
        tempoSentar: 1.49,
      },
      {
        sessao: 3,
        date: "20/08",
        tempoTotal: 8.6,
        numeroPassos: 14,
        cadencia: 96,
        tempoLevantar: 1.22,
        tempoCaminhadaIda: 2.08,
        tempoGiro: 1.31,
        tempoCaminhadaVolta: 2.40,
        tempoSentar: 1.44,
      },
    ],
    p3: [
      {
        sessao: 1,
        date: "08/06",
        tempoTotal: 9.6,
        numeroPassos: 16,
        cadencia: 88,
        tempoLevantar: 1.41,
        tempoCaminhadaIda: 2.36,
        tempoGiro: 1.58,
        tempoCaminhadaVolta: 2.74,
        tempoSentar: 1.51,
      },
      {
        sessao: 2,
        date: "10/08",
        tempoTotal: 9.2,
        numeroPassos: 15,
        cadencia: 90,
        tempoLevantar: 1.33,
        tempoCaminhadaIda: 2.29,
        tempoGiro: 1.49,
        tempoCaminhadaVolta: 2.61,
        tempoSentar: 1.48,
      },
    ],
  };
  
  export const tugSessionSignalDataByParticipant: Record<
    string,
    Record<number, Array<{ time: string; value: number }>>
  > = {
    p1: {
      1: generateTUGSignal(12),
      2: generateTUGSignal(12),
      3: generateTUGSignal(12),
      4: generateTUGSignal(12),
    },
    p2: {
      1: generateTUGSignal(12),
      2: generateTUGSignal(12),
      3: generateTUGSignal(12),
    },
    p3: {
      1: generateTUGSignal(12),
      2: generateTUGSignal(12),
    },
  };