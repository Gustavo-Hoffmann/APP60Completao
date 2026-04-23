export type BiologicalSex = "Masculino" | "Feminino";

export type Participant = {
  /** Ausente em rascunhos de criação local; o POST da API devolve o id. */
  id?: string;
  name: string;
  /** ISO 3166-1 alpha-2 (ex.: BR). */
  nationality: string;
  /**
   * Documento de identidade (no BR: CPF somente dígitos; fora do BR: texto livre).
   * Mantido como `cpf` por compatibilidade com o payload legado do app.
   */
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