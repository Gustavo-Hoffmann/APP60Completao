export type ParticipantBlockScores = Record<string, number>;

export type IvcfClassification = "Robusto" | "Pré-Frágil" | "Frágil";

export type IvcfSession = {
  sessao: number;
  date: string;
  scoreTotal: number;
  classification?: IvcfClassification;
  blocks: ParticipantBlockScores;
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

export type TwoMstSignalPoint = {
  time: number;
  value: number;
  phonePeak?: number | null;
  predPeak?: number | null;
};

export type Sl30sGodaLabel =
  | "Constante"
  | "Flutuante"
  | "Desacelerador"
  | "Acelerador"
  | "Desacelerador (Tendência)"
  | "Acelerador (Tendência)"
  | "Flutuante (Misto)"
  | "—";

export type Sl30sRikliJonesLabel =
  | "Abaixo da média"
  | "Na média"
  | "Acima da média"
  | "Idade fora da faixa da tabela"
  | "—";

export type Sl30sSession = {
  sessao: number;
  date: string;
  repeticoes: number;
  potenciaMedia: number;
  trabalhoTotal: number;
  trabalhoPorRep: number;
  tempoMedioCiclo: number;
  tempoMedioLevantar: number;
  tempoMedioSentar: number;
  transicaoMediaLevantar: number;
  transicaoMediaSentar: number;
  frequenciaMedia: number;
  cvTempoCiclo: number;
  amplitudeSinal: number;
  velFlexLevantar: number;
  velExtLevantar: number;
  velFlexSentar: number;
  velExtSentar: number;
  goda: Sl30sGodaLabel;
  rikliJones: Sl30sRikliJonesLabel;
  zScore?: number | null;
  percentile?: number | null;
  ageBin?: string;
  sex?: "Masculino" | "Feminino";
  normativeMean?: number | null;
  normativeLower?: number | null;
  normativeUpper?: number | null;
};

export type Sl30sSignalPoint = {
  time: number;
  value: number;
  peak?: number | null;
  valley?: number | null;
};

export type ParticipantTestSummary = {
  has2MST?: boolean;
  twoMstSessions?: TwoMstSession[];
  twoMstSignals?: Record<number, TwoMstSignalPoint[]>;
  hasSL30S?: boolean;
  sl30sSessions?: Sl30sSession[];
  sl30sSignals?: Record<number, Sl30sSignalPoint[]>;
  hasIVCF20?: boolean;
  ivcfSessions?: IvcfSession[];
};

export type Participant = {
  id: string;
  name: string;
  /** Código ISO 3166-1 alpha-2 (ex.: BR, PT). */
  nationality?: string;
  /** Documento de identidade exibido (CPF formatado se BR; texto livre se não BR). */
  cpf: string;
  age: number;
  sex: "Masculino" | "Feminino";
  createdByUserId?: string;
  professorId?: string;
  studentId?: string;
  dob?: string;
  city?: string;
  state?: string;
  cep?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  createdAt?: string;
  updatedAt?: string;
  ivcfScore?: number;
  ivcfClass?: IvcfClassification;
  blocks?: ParticipantBlockScores;
  tests?: ParticipantTestSummary;
};