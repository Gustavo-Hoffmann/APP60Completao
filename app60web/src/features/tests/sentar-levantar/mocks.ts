export const statsDataSL30s = {
    participantes: 1025,
    coletasMes: 268,
    coletasTotal: 4720,
    repsMedias: 14,
  };
  
  export const monthlyDataSL30s = [
    { name: "Jan", coletas: 60 },
    { name: "Fev", coletas: 72 },
    { name: "Mar", coletas: 88 },
    { name: "Abr", coletas: 96 },
    { name: "Mai", coletas: 108 },
    { name: "Jun", coletas: 120 },
    { name: "Jul", coletas: 136 },
    { name: "Ago", coletas: 149 },
    { name: "Set", coletas: 168 },
    { name: "Out", coletas: 184 },
    { name: "Nov", coletas: 196 },
    { name: "Dez", coletas: 215 },
  ];
  
  export const participantSL30sList = [
    {
      participantId: "p1",
      participantName: "Maria Silva",
      sessoes: 4,
      ultimaData: "25/08",
      repsUltima: 16,
      cadenciaUltima: 32,
    },
    {
      participantId: "p2",
      participantName: "João Santos",
      sessoes: 3,
      ultimaData: "20/08",
      repsUltima: 14,
      cadenciaUltima: 28,
    },
    {
      participantId: "p3",
      participantName: "Ana Oliveira",
      sessoes: 2,
      ultimaData: "10/08",
      repsUltima: 13,
      cadenciaUltima: 26,
    },
  ];
  
  const generateSLSignal = (durationSeconds = 34) => {
    const data: Array<{ time: string; value: number }> = [];
    const sampleRate = 12;
    const totalPoints = durationSeconds * sampleRate;
  
    let phase = 0;
  
    for (let i = 0; i < totalPoints; i++) {
      const t = i / sampleRate;
      const amplitude = 28 + Math.sin(t * 0.45) * 3 + Math.random() * 4;
      const freq = 0.45 + Math.sin(t * 0.12) * 0.03;
      phase += freq * (2 * Math.PI / sampleRate);
  
      data.push({
        time: t.toFixed(1),
        value: Number((amplitude * Math.sin(phase)).toFixed(2)),
      });
    }
  
    return data;
  };
  
  export const sl30sSummaryByParticipant: Record<
    string,
    Array<{
      sessao: number;
      date: string;
      repeticoes: number;
      cadencia: number;
      tempoMedioRep: number;
      tempoMedioSubida: number;
      tempoMedioDescida: number;
      tempoMedioTransicao: number;
    }>
  > = {
    p1: [
      {
        sessao: 1,
        date: "10/05",
        repeticoes: 13,
        cadencia: 26,
        tempoMedioRep: 2.21,
        tempoMedioSubida: 0.82,
        tempoMedioDescida: 0.91,
        tempoMedioTransicao: 0.48,
      },
      {
        sessao: 2,
        date: "15/06",
        repeticoes: 14,
        cadencia: 28,
        tempoMedioRep: 2.08,
        tempoMedioSubida: 0.79,
        tempoMedioDescida: 0.85,
        tempoMedioTransicao: 0.44,
      },
      {
        sessao: 3,
        date: "20/07",
        repeticoes: 15,
        cadencia: 30,
        tempoMedioRep: 1.98,
        tempoMedioSubida: 0.74,
        tempoMedioDescida: 0.81,
        tempoMedioTransicao: 0.43,
      },
      {
        sessao: 4,
        date: "25/08",
        repeticoes: 16,
        cadencia: 32,
        tempoMedioRep: 1.88,
        tempoMedioSubida: 0.71,
        tempoMedioDescida: 0.77,
        tempoMedioTransicao: 0.40,
      },
    ],
    p2: [
      {
        sessao: 1,
        date: "12/05",
        repeticoes: 12,
        cadencia: 24,
        tempoMedioRep: 2.36,
        tempoMedioSubida: 0.88,
        tempoMedioDescida: 0.99,
        tempoMedioTransicao: 0.49,
      },
      {
        sessao: 2,
        date: "18/06",
        repeticoes: 13,
        cadencia: 26,
        tempoMedioRep: 2.22,
        tempoMedioSubida: 0.84,
        tempoMedioDescida: 0.91,
        tempoMedioTransicao: 0.47,
      },
      {
        sessao: 3,
        date: "20/08",
        repeticoes: 14,
        cadencia: 28,
        tempoMedioRep: 2.10,
        tempoMedioSubida: 0.80,
        tempoMedioDescida: 0.86,
        tempoMedioTransicao: 0.44,
      },
    ],
    p3: [
      {
        sessao: 1,
        date: "08/06",
        repeticoes: 11,
        cadencia: 22,
        tempoMedioRep: 2.52,
        tempoMedioSubida: 0.94,
        tempoMedioDescida: 1.05,
        tempoMedioTransicao: 0.53,
      },
      {
        sessao: 2,
        date: "10/08",
        repeticoes: 13,
        cadencia: 26,
        tempoMedioRep: 2.24,
        tempoMedioSubida: 0.85,
        tempoMedioDescida: 0.91,
        tempoMedioTransicao: 0.48,
      },
    ],
  };
  
  export const sl30sSessionSignalDataByParticipant: Record<
    string,
    Record<number, Array<{ time: string; value: number }>>
  > = {
    p1: {
      1: generateSLSignal(34),
      2: generateSLSignal(34),
      3: generateSLSignal(34),
      4: generateSLSignal(34),
    },
    p2: {
      1: generateSLSignal(34),
      2: generateSLSignal(34),
      3: generateSLSignal(34),
    },
    p3: {
      1: generateSLSignal(34),
      2: generateSLSignal(34),
    },
  };