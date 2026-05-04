import { apiJson } from "./apiClient";

export type InstitutionLite = {
  id: string;
  name: string;
  unit: string | null;
  acronym?: string | null;
};

export async function listInstitutions(): Promise<InstitutionLite[]> {
  return apiJson<InstitutionLite[]>("/api/institutions");
}

