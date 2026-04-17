import pg from "pg";
import type { AppConfig } from "../config.js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function stripSslParams(databaseUrl: string) {
  const u = new URL(databaseUrl);
  u.searchParams.delete("sslmode");
  u.searchParams.delete("sslrootcert");
  u.searchParams.delete("sslcert");
  u.searchParams.delete("sslkey");
  u.searchParams.delete("sslpassword");
  u.searchParams.delete("sslidentity");
  u.searchParams.delete("uselibpqcompat");
  return u.toString();
}

function sslFromDatabaseUrl(databaseUrl: string) {
  const lower = databaseUrl.toLowerCase();
  if (!lower.includes("sslmode=")) return undefined;

  // Para compatibilidade com URLs existentes (ex.: sslmode=require),
  // aceitamos conexão SSL sem validar CA.
  if (lower.includes("sslmode=require") || lower.includes("sslmode=prefer")) {
    return { rejectUnauthorized: false } as const;
  }

  // Para verify-full / verify-ca, tentamos usar CA bundle local se existir.
  const caPath = resolve(process.cwd(), "global-bundle.pem");
  if (existsSync(caPath)) {
    return { ca: readFileSync(caPath, "utf8"), rejectUnauthorized: true } as const;
  }

  return { rejectUnauthorized: false } as const;
}

export function createPool(cfg: AppConfig) {
  const connectionString = cfg.DATABASE_URL.includes("sslmode=")
    ? stripSslParams(cfg.DATABASE_URL)
    : cfg.DATABASE_URL;
  const ssl = sslFromDatabaseUrl(cfg.DATABASE_URL);
  return new pg.Pool({
    connectionString,
    ssl,
    max: 20,
    idleTimeoutMillis: 30_000,
  });
}
