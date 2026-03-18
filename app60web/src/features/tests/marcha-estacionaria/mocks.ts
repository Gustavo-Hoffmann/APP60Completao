export const statsData2MST = {
    participantes: 1240,
    coletasMes: 345,
    coletasTotal: 8500,
  };
  
  export const monthlyData2MST = [
    { name: "Jan", coletas: 150 },
    { name: "Fev", coletas: 180 },
    { name: "Mar", coletas: 220 },
    { name: "Abr", coletas: 260 },
    { name: "Mai", coletas: 240 },
    { name: "Jun", coletas: 300 },
    { name: "Jul", coletas: 280 },
    { name: "Ago", coletas: 450 },
    { name: "Set", coletas: 390 },
    { name: "Out", coletas: 510 },
    { name: "Nov", coletas: 480 },
    { name: "Dez", coletas: 600 },
  ];
  
  export const participant2MSTList = [
    {
      participantId: "p1",
      participantName: "Maria Silva",
      sessoes: 4,
      ultimaData: "25/08",
      repeticoesUltima: 126,
      cadenciaUltima: 126,
    },
    {
      participantId: "p2",
      participantName: "João Santos",
      sessoes: 3,
      ultimaData: "20/08",
      repeticoesUltima: 108,
      cadenciaUltima: 108,
    },
    {
      participantId: "p3",
      participantName: "Ana Oliveira",
      sessoes: 2,
      ultimaData: "10/08",
      repeticoesUltima: 96,
      cadenciaUltima: 96,
    },
  ];
  
  export const test2mstSummaryByParticipant: Record<
    string,
    Array<{
      sessao: number;
      date: string;
      repeticoes: number;
      cadencia: number;
      velAngularMedia: number;
      cvVelocidade: number;
      tempoMedioCiclo: number;
      cvTempoCiclo: number;
      velMaxima: number;
      velMinima: number;
    }>
  > = {
    p1: [
      { sessao: 1, date: "10/05", repeticoes: 98, cadencia: 98, velAngularMedia: 280, cvVelocidade: 5.2, tempoMedioCiclo: 1.22, cvTempoCiclo: 4.5, velMaxima: 350, velMinima: 210 },
      { sessao: 2, date: "15/06", repeticoes: 110, cadencia: 110, velAngularMedia: 310, cvVelocidade: 4.8, tempoMedioCiclo: 1.09, cvTempoCiclo: 4.1, velMaxima: 380, velMinima: 240 },
      { sessao: 3, date: "20/07", repeticoes: 105, cadencia: 105, velAngularMedia: 295, cvVelocidade: 5.0, tempoMedioCiclo: 1.14, cvTempoCiclo: 4.3, velMaxima: 365, velMinima: 225 },
      { sessao: 4, date: "25/08", repeticoes: 126, cadencia: 126, velAngularMedia: 340, cvVelocidade: 3.5, tempoMedioCiclo: 0.95, cvTempoCiclo: 3.2, velMaxima: 410, velMinima: 280 },
    ],
    p2: [
      { sessao: 1, date: "12/05", repeticoes: 92, cadencia: 92, velAngularMedia: 250, cvVelocidade: 6.0, tempoMedioCiclo: 1.31, cvTempoCiclo: 5.4, velMaxima: 320, velMinima: 190 },
      { sessao: 2, date: "18/06", repeticoes: 101, cadencia: 101, velAngularMedia: 275, cvVelocidade: 5.5, tempoMedioCiclo: 1.18, cvTempoCiclo: 4.8, velMaxima: 345, velMinima: 205 },
      { sessao: 3, date: "20/08", repeticoes: 108, cadencia: 108, velAngularMedia: 290, cvVelocidade: 4.9, tempoMedioCiclo: 1.08, cvTempoCiclo: 4.0, velMaxima: 360, velMinima: 220 },
    ],
    p3: [
      { sessao: 1, date: "08/06", repeticoes: 88, cadencia: 88, velAngularMedia: 240, cvVelocidade: 6.2, tempoMedioCiclo: 1.38, cvTempoCiclo: 5.8, velMaxima: 300, velMinima: 180 },
      { sessao: 2, date: "10/08", repeticoes: 96, cadencia: 96, velAngularMedia: 260, cvVelocidade: 5.4, tempoMedioCiclo: 1.23, cvTempoCiclo: 4.9, velMaxima: 330, velMinima: 195 },
    ],
  };
  
  const generateHumanSignal = (durationSeconds = 60) => {
    const data = [];
    const sampleRate = 10;
    const totalPoints = durationSeconds * sampleRate;
  
    let phase = 0;
  
    for (let i = 0; i < totalPoints; i++) {
      const t = i / sampleRate;
      const amplitudeNoise = Math.sin(t * 0.5) * 10 + Math.random() * 15;
      const amplitude = 40 + Math.abs(amplitudeNoise);
      const freq = 1 + Math.sin(t * 0.2) * 0.1;
      phase += freq * (2 * Math.PI / sampleRate);
      const value = amplitude * Math.sin(phase);
  
      data.push({
        time: t.toFixed(1),
        value,
      });
    }
  
    return data;
  };
  
  export const sessionSignalDataByParticipant: Record<
    string,
    Record<number, Array<{ time: string; value: number }>>
  > = {
    p1: {
      1: generateHumanSignal(60),
      2: generateHumanSignal(60),
      3: generateHumanSignal(60),
      4: generateHumanSignal(60),
    },
    p2: {
      1: generateHumanSignal(60),
      2: generateHumanSignal(60),
      3: generateHumanSignal(60),
    },
    p3: {
      1: generateHumanSignal(60),
      2: generateHumanSignal(60),
    },
  };