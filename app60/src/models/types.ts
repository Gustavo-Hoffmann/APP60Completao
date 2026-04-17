export type BiologicalSex = "Masculino" | "Feminino";

export type Participant = {
  /** Ausente em rascunhos de criação local; o POST da API devolve o id. */
  id?: string;
  name: string;
  cpf: string;
  dob: string; // ISO
  biologicalSex?: BiologicalSex;
  cep?: string;
  address?: {
    street?: string;
    number?: string;
    neighborhood?: string;
    city?: string;
    uf?: string;
    complement?: string;
  };
  createdAt: string;
  updatedAt: string;
};