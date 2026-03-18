import { normalizeDigits } from "../models/utils";

export async function fetchViaCep(cepRaw: string) {
  const cep = normalizeDigits(cepRaw);
  if (cep.length !== 8) throw new Error("CEP inválido");

  const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
  const data = await res.json();

  if (data?.erro) throw new Error("CEP não encontrado");

  return {
    street: data.logradouro as string,
    neighborhood: data.bairro as string,
    city: data.localidade as string,
    uf: data.uf as string,
  };
}