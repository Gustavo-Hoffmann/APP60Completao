import { getValidIdToken } from "../cognito/session";
import { messageFromApiErrorBody } from "./errorMessage";

function baseUrl(): string {
  const u = import.meta.env.VITE_API_BASE_URL;
  if (!u) throw new Error("Falta VITE_API_BASE_URL");
  return u.replace(/\/$/, "");
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getValidIdToken();
  if (!token) {
    throw new Error("Sessão expirada. Faça login novamente.");
  }
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type") && init.body && typeof init.body === "string") {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${baseUrl()}${path.startsWith("/") ? path : `/${path}`}`, {
    ...init,
    headers,
  });
}

export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, init);
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = { raw: text };
    }
  }
  if (!res.ok) {
    throw new Error(messageFromApiErrorBody(data, res.status));
  }
  return data as T;
}
