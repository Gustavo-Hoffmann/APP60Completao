export const statsDataLOS = {
    participantes: 840,
    coletasMes: 188,
    coletasTotal: 3620,
    tempoMedio: 13.6,
  };
  
  export const monthlyDataLOS = [
    { name: "Jan", coletas: 40 },
    { name: "Fev", coletas: 52 },
    { name: "Mar", coletas: 70 },
    { name: "Abr", coletas: 76 },
    { name: "Mai", coletas: 82 },
    { name: "Jun", coletas: 95 },
    { name: "Jul", coletas: 118 },
    { name: "Ago", coletas: 124 },
    { name: "Set", coletas: 138 },
    { name: "Out", coletas: 152 },
    { name: "Nov", coletas: 166 },
    { name: "Dez", coletas: 181 },
  ];
  
  export const participantLOSList = [
    {
      participantId: "p1",
      participantName: "Maria Silva",
      sessoes: 4,
      ultimaData: "25/08",
      tempoMedioUltimo: 13.1,
      areaTotalUltima: 146,
    },
    {
      participantId: "p2",
      participantName: "João Santos",
      sessoes: 3,
      ultimaData: "20/08",
      tempoMedioUltimo: 14.0,
      areaTotalUltima: 132,
    },
    {
      participantId: "p3",
      participantName: "Ana Oliveira",
      sessoes: 2,
      ultimaData: "10/08",
      tempoMedioUltimo: 14.5,
      areaTotalUltima: 125,
    },
  ];
  
  const generateAreaSignal = (durationSeconds = 60) => {
    const data: Array<{ time: string; value: number }> = [];
    const sampleRate = 10;
    const totalPoints = durationSeconds * sampleRate;
  
    for (let i = 0; i < totalPoints; i++) {
      const t = i / sampleRate;
      const base =
        120 +
        Math.sin(t * 0.32) * 18 +
        Math.sin(t * 0.9) * 10 +
        Math.sin(t * 0.07) * 14;
      const noise = Math.random() * 6;
  
      data.push({
        time: t.toFixed(1),
        value: Number((base + noise).toFixed(2)),
      });
    }
  
    return data;
  };
  
  export const losSummaryByParticipant: Record<
    string,
    Array<{
      sessao: number;
      date: string;
      tempoTotalMedio: number;
      distanciaAP: number;
      distanciaML: number;
      velocidadeAP: number;
      velocidadeML: number;
      areaTotal: number;
    }>
  > = {
    p1: [
      {
        sessao: 1,
        date: "10/05",
        tempoTotalMedio: 14.2,
        distanciaAP: 17.6,
        distanciaML: 14.2,
        velocidadeAP: 2.8,
        velocidadeML: 2.3,
        areaTotal: 118,
      },
      {
        sessao: 2,
        date: "15/06",
        tempoTotalMedio: 13.7,
        distanciaAP: 18.9,
        distanciaML: 15.1,
        velocidadeAP: 3.0,
        velocidadeML: 2.5,
        areaTotal: 129,
      },
      {
        sessao: 3,
        date: "20/07",
        tempoTotalMedio: 13.5,
        distanciaAP: 19.8,
        distanciaML: 15.8,
        velocidadeAP: 3.1,
        velocidadeML: 2.6,
        areaTotal: 136,
      },
      {
        sessao: 4,
        date: "25/08",
        tempoTotalMedio: 13.1,
        distanciaAP: 20.5,
        distanciaML: 16.3,
        velocidadeAP: 3.3,
        velocidadeML: 2.7,
        areaTotal: 146,
      },
    ],
    p2: [
      {
        sessao: 1,
        date: "12/05",
        tempoTotalMedio: 14.8,
        distanciaAP: 15.9,
        distanciaML: 13.5,
        velocidadeAP: 2.5,
        velocidadeML: 2.1,
        areaTotal: 109,
      },
      {
        sessao: 2,
        date: "18/06",
        tempoTotalMedio: 14.3,
        distanciaAP: 16.8,
        distanciaML: 14.1,
        velocidadeAP: 2.7,
        velocidadeML: 2.2,
        areaTotal: 121,
      },
      {
        sessao: 3,
        date: "20/08",
        tempoTotalMedio: 14.0,
        distanciaAP: 17.5,
        distanciaML: 14.8,
        velocidadeAP: 2.8,
        velocidadeML: 2.4,
        areaTotal: 132,
      },
    ],
    p3: [
      {
        sessao: 1,
        date: "08/06",
        tempoTotalMedio: 15.0,
        distanciaAP: 15.1,
        distanciaML: 12.8,
        velocidadeAP: 2.3,
        velocidadeML: 2.0,
        areaTotal: 101,
      },
      {
        sessao: 2,
        date: "10/08",
        tempoTotalMedio: 14.5,
        distanciaAP: 16.4,
        distanciaML: 13.7,
        velocidadeAP: 2.6,
        velocidadeML: 2.2,
        areaTotal: 125,
      },
    ],
  };
  
  export const losSessionSignalDataByParticipant: Record<
    string,
    Record<number, Array<{ time: string; value: number }>>
  > = {
    p1: {
      1: generateAreaSignal(60),
      2: generateAreaSignal(60),
      3: generateAreaSignal(60),
      4: generateAreaSignal(60),
    },
    p2: {
      1: generateAreaSignal(60),
      2: generateAreaSignal(60),
      3: generateAreaSignal(60),
    },
    p3: {
      1: generateAreaSignal(60),
      2: generateAreaSignal(60),
    },
  };