export type ParticipantBlockScores = {
  Idade: number;
  Percepção: number;
  AVD: number;
  Humor: number;
  Mobilidade: number;
};

export type TwoMstStrategyLabel =
  | "Ascendente"
  | "Descendente"
  | "Constante"
  | "Indefinida";

export type TwoMstSession = {
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
  strategy: TwoMstStrategyLabel;
};

export type SignalPoint = {
  time: number;
  value: number;
  phonePeak?: number | null;
  predPeak?: number | null;
};

export type ParticipantTestSummary = {
  has2MST?: boolean;
  twoMstSessions?: TwoMstSession[];
  twoMstSignals?: Record<number, SignalPoint[]>;
};

export type Participant = {
  id: string;
  name: string;
  cpf: string;
  age: number;
  sex: "Masculino" | "Feminino";
  createdByUserId: string;
  professorId?: string;
  studentId?: string;
  dob?: string;
  city?: string;
  state?: string;
  createdAt?: string;
  updatedAt?: string;
  ivcfScore?: number;
  ivcfClass?: "Robusto" | "Pré-Frágil" | "Frágil";
  blocks?: ParticipantBlockScores;
  tests?: ParticipantTestSummary;
};