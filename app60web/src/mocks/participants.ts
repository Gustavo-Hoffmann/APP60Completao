import type { Participant, SignalPoint, TwoMstSession } from "../types/participant";

function generateHumanSignal(durationSeconds = 120): SignalPoint[] {
  const data: SignalPoint[] = [];
  const sampleRate = 5;
  const totalPoints = durationSeconds * sampleRate;

  let phase = 0;

  for (let i = 0; i < totalPoints; i += 1) {
    const t = i / sampleRate;
    const amplitudeNoise = Math.sin(t * 0.35) * 8 + (Math.sin(t * 0.11) + 1) * 6;
    const amplitude = 42 + Math.abs(amplitudeNoise);
    const freq = 1 + Math.sin(t * 0.18) * 0.08;

    phase += freq * (2 * Math.PI / sampleRate);

    data.push({
      time: t.toFixed(1),
      value: Number((amplitude * Math.sin(phase)).toFixed(2)),
    });
  }

  return data;
}

const maria2MstSessions: TwoMstSession[] = [
  {
    sessao: 1,
    date: "10/05/2026",
    repeticoes: 98,
    cadencia: 98,
    velAngularMedia: 280,
    cvVelocidade: 5.2,
    tempoMedioCiclo: 1.22,
    cvTempoCiclo: 4.5,
    velMaxima: 350,
    velMinima: 210,
  },
  {
    sessao: 2,
    date: "15/06/2026",
    repeticoes: 110,
    cadencia: 110,
    velAngularMedia: 310,
    cvVelocidade: 4.8,
    tempoMedioCiclo: 1.09,
    cvTempoCiclo: 4.1,
    velMaxima: 380,
    velMinima: 240,
  },
  {
    sessao: 3,
    date: "20/07/2026",
    repeticoes: 105,
    cadencia: 105,
    velAngularMedia: 295,
    cvVelocidade: 5.0,
    tempoMedioCiclo: 1.14,
    cvTempoCiclo: 4.3,
    velMaxima: 365,
    velMinima: 225,
  },
  {
    sessao: 4,
    date: "25/08/2026",
    repeticoes: 126,
    cadencia: 126,
    velAngularMedia: 340,
    cvVelocidade: 3.5,
    tempoMedioCiclo: 0.95,
    cvTempoCiclo: 3.2,
    velMaxima: 410,
    velMinima: 280,
  },
];

export const mariaSilvaMock: Participant = {
  id: "example-maria-silva",
  name: "Maria Silva",
  cpf: "123.456.789-00",
  age: 68,
  sex: "Feminino",
  createdByUserId: "example",
  professorId: "example-prof",
  studentId: "example-student",
  city: "Curitiba",
  state: "PR",
  dob: "1958-09-12",
  ivcfScore: 18,
  ivcfClass: "Frágil",
  blocks: {
    Idade: 4,
    Percepção: 3,
    AVD: 4,
    Humor: 2,
    Mobilidade: 5,
  },
  tests: {
    has2MST: true,
    twoMstSessions: maria2MstSessions,
    twoMstSignals: {
      1: generateHumanSignal(120),
      2: generateHumanSignal(120),
      3: generateHumanSignal(120),
      4: generateHumanSignal(120),
    },
  },
};