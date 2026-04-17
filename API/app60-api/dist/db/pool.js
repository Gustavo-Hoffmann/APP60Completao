import pg from "pg";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
function stripSslParams(databaseUrl) {
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
function sslFromDatabaseUrl(databaseUrl) {
    const lower = databaseUrl.toLowerCase();
    if (!lower.includes("sslmode="))
        return undefined;
    // Para compatibilidade com URLs existentes (ex.: sslmode=require),
    // aceitamos conexão SSL sem validar CA.
    if (lower.includes("sslmode=require") || lower.includes("sslmode=prefer")) {
        return { rejectUnauthorized: false };
    }
    // Para verify-full / verify-ca, tentamos usar CA bundle local se existir.
    const caPath = resolve(process.cwd(), "global-bundle.pem");
    if (existsSync(caPath)) {
        return { ca: readFileSync(caPath, "utf8"), rejectUnauthorized: true };
    }
    return { rejectUnauthorized: false };
}
export function createPool(cfg) {
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
