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
  const b = baseUrl();
  const p = path.startsWith("/") ? path : `/${path}`;
  const normalizedPath = b.endsWith("/api") && p.startsWith("/api/") ? p.slice(4) : p;

  const url = `${b}${normalizedPath}`;
  const res = await fetch(url, {
    ...init,
    headers,
  });

  // Alguns ambientes colocam "/api" no base URL ou fazem rewrite no balanceador;
  // esse retry deixa o client resiliente sem depender da config exata.
  if (res.status === 404 && normalizedPath.startsWith("/api/")) {
    const altUrl = `${b}${normalizedPath.slice(4)}`;
    return fetch(altUrl, {
      ...init,
      headers,
    });
  }

  return res;
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
