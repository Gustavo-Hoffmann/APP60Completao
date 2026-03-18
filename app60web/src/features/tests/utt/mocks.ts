export const statsDataUTT = {
    participantes: 780,
    coletasMes: 176,
    coletasTotal: 3310,
    repsMedias: 24,
    amplitudeMedia: 17.8,
  };
  
  export const monthlyDataUTT = [
    { name: "Jan", coletas: 38 },
    { name: "Fev", coletas: 46 },
    { name: "Mar", coletas: 57 },
    { name: "Abr", coletas: 68 },
    { name: "Mai", coletas: 75 },
    { name: "Jun", coletas: 86 },
    { name: "Jul", coletas: 98 },
    { name: "Ago", coletas: 110 },
    { name: "Set", coletas: 123 },
    { name: "Out", coletas: 137 },
    { name: "Nov", coletas: 149 },
    { name: "Dez", coletas: 162 },
  ];
  
  export const participantUTTList = [
    {
      participantId: "p1",
      participantName: "Maria Silva",
      sessoes: 4,
      ultimaData: "25/08",
      repsUltima: 26,
      amplitudeMediaUltima: 19.2,
    },
    {
      participantId: "p2",
      participantName: "João Santos",
      sessoes: 3,
      ultimaData: "20/08",
      repsUltima: 24,
      amplitudeMediaUltima: 17.4,
    },
    {
      participantId: "p3",
      participantName: "Ana Oliveira",
      sessoes: 2,
      ultimaData: "10/08",
      repsUltima: 21,
      amplitudeMediaUltima: 16.3,
    },
  ];
  
  const generateUTTSignal = (durationSeconds = 30) => {
    const data: Array<{ time: string; value: number }> = [];
    const sampleRate = 12;
    const totalPoints = durationSeconds * sampleRate;
  
    let phase = 0;
  
    for (let i = 0; i < totalPoints; i++) {
      const t = i / sampleRate;
      const amplitude = 16 + Math.sin(t * 0.28) * 2 + Math.random() * 2.5;
      const freq = 0.82 + Math.sin(t * 0.15) * 0.04;
      phase += freq * (2 * Math.PI / sampleRate);
  
      data.push({
        time: t.toFixed(1),
        value: Number((amplitude * Math.sin(phase)).toFixed(2)),
      });
    }
  
    return data;
  };
  
  export const uttSummaryByParticipant: Record<
    string,
    Array<{
      sessao: number;
      date: string;
      repeticoes: number;
      cadencia: number;
      tempoMedioCiclo: number;
      amplitudeMedia: number;
    }>
  > = {
    p1: [
      {
        sessao: 1,
        date: "10/05",
        repeticoes: 22,
        cadencia: 44,
        tempoMedioCiclo: 1.36,
        amplitudeMedia: 17.1,
      },
      {
        sessao: 2,
        date: "15/06",
        repeticoes: 24,
        cadencia: 48,
        tempoMedioCiclo: 1.27,
        amplitudeMedia: 17.9,
      },
      {
        sessao: 3,
        date: "20/07",
        repeticoes: 25,
        cadencia: 50,
        tempoMedioCiclo: 1.22,
        amplitudeMedia: 18.6,
      },
      {
        sessao: 4,
        date: "25/08",
        repeticoes: 26,
        cadencia: 52,
        tempoMedioCiclo: 1.16,
        amplitudeMedia: 19.2,
      },
    ],
    p2: [
      {
        sessao: 1,
        date: "12/05",
        repeticoes: 20,
        cadencia: 40,
        tempoMedioCiclo: 1.49,
        amplitudeMedia: 16.2,
      },
      {
        sessao: 2,
        date: "18/06",
        repeticoes: 22,
        cadencia: 44,
        tempoMedioCiclo: 1.38,
        amplitudeMedia: 16.9,
      },
      {
        sessao: 3,
        date: "20/08",
        repeticoes: 24,
        cadencia: 48,
        tempoMedioCiclo: 1.29,
        amplitudeMedia: 17.4,
      },
    ],
    p3: [
      {
        sessao: 1,
        date: "08/06",
        repeticoes: 19,
        cadencia: 38,
        tempoMedioCiclo: 1.58,
        amplitudeMedia: 15.5,
      },
      {
        sessao: 2,
        date: "10/08",
        repeticoes: 21,
        cadencia: 42,
        tempoMedioCiclo: 1.42,
        amplitudeMedia: 16.3,
      },
    ],
  };
  
  export const uttSessionSignalDataByParticipant: Record<
    string,
    Record<number, Array<{ time: string; value: number }>>
  > = {
    p1: {
      1: generateUTTSignal(30),
      2: generateUTTSignal(30),
      3: generateUTTSignal(30),
      4: generateUTTSignal(30),
    },
    p2: {
      1: generateUTTSignal(30),
      2: generateUTTSignal(30),
      3: generateUTTSignal(30),
    },
    p3: {
      1: generateUTTSignal(30),
      2: generateUTTSignal(30),
    },
  };