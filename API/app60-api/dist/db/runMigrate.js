import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadMigrateConfig } from "../config.js";
import { Pool } from "pg";
import { existsSync } from "node:fs";
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
    if (lower.includes("sslmode=require") || lower.includes("sslmode=prefer")) {
        return { rejectUnauthorized: false };
    }
    const caPath = resolve(process.cwd(), "global-bundle.pem");
    if (existsSync(caPath)) {
        return { ca: readFileSync(caPath, "utf8"), rejectUnauthorized: true };
    }
    return { rejectUnauthorized: false };
}
const __dirname = dirname(fileURLToPath(import.meta.url));
function ensureMigrationsTable(sqlText) {
    // Se a migração inicial ainda estiver sendo usada em banco zerado, ela não cria schema_migrations.
    // Criamos de forma idempotente antes de aplicar as próximas.
    if (sqlText.includes("CREATE TABLE IF NOT EXISTS schema_migrations"))
        return sqlText;
    return `CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
\n${sqlText}`;
}
async function shouldBaselineInitialMigration(pool) {
    const result = await pool.query(`SELECT
       EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') AS has_app_role,
       to_regclass('public.institutions') IS NOT NULL AS has_institutions,
       to_regclass('public.app_users') IS NOT NULL AS has_app_users,
       to_regclass('public.collections') IS NOT NULL AS has_collections`);
    const row = result.rows[0];
    return !!(row?.has_app_role &&
        row?.has_institutions &&
        row?.has_app_users &&
        row?.has_collections);
}
async function main() {
    const cfg = loadMigrateConfig();
    console.log("Conectando no Postgres via DATABASE_URL...");
    const ssl = sslFromDatabaseUrl(cfg.DATABASE_URL);
    const connectionString = cfg.DATABASE_URL.includes("sslmode=")
        ? stripSslParams(cfg.DATABASE_URL)
        : cfg.DATABASE_URL;
    const pool = new Pool({
        connectionString,
        ssl,
        connectionTimeoutMillis: 15000,
    });
    try {
        const dir = join(__dirname, "migrations");
        const files = readdirSync(dir)
            .filter((f) => /^\d+_.+\.sql$/.test(f))
            .sort((a, b) => a.localeCompare(b));
        console.log(`Encontradas ${files.length} migrations em ${dir}`);
        await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
        version text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`);
        for (const file of files) {
            const version = file;
            const already = await pool.query(`SELECT 1 FROM schema_migrations WHERE version = $1 LIMIT 1`, [version]);
            if (already.rows[0]) {
                console.log(`- Pulando (já aplicada): ${version}`);
                continue;
            }
            if (version === "001_initial_aws_schema.sql" && (await shouldBaselineInitialMigration(pool))) {
                await pool.query(`INSERT INTO schema_migrations (version) VALUES ($1)`, [version]);
                console.log(`- Baseline detectado, marcando como aplicada: ${version}`);
                continue;
            }
            const sqlPath = join(dir, file);
            const sqlRaw = readFileSync(sqlPath, "utf8");
            const sql = ensureMigrationsTable(sqlRaw);
            console.log(`- Aplicando: ${version}`);
            const client = await pool.connect();
            try {
                await client.query("BEGIN");
                await client.query(sql);
                await client.query(`INSERT INTO schema_migrations (version) VALUES ($1)`, [version]);
                await client.query("COMMIT");
                console.log("Migration aplicada:", sqlPath);
            }
            catch (e) {
                await client.query("ROLLBACK");
                throw e;
            }
            finally {
                client.release();
            }
        }
        console.log("Migrações finalizadas com sucesso.");
    }
    finally {
        await pool.end();
    }
}
main().catch((e) => {
    console.error(e);
    process.exit(1);
});
