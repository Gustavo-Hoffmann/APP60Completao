export type ParticipantBlockScores = {
  Idade: number;
  Percepção: number;
  AVD: number;
  Humor: number;
  Mobilidade: number;
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
};