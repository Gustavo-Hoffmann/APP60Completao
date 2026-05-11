import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.string().optional().default("development"),
  PORT: z.coerce.number().default(8787),
  DATABASE_URL: z.string().min(1),
  AWS_REGION: z.string().min(1),
  COGNITO_USER_POOL_ID: z.string().min(1),
  COGNITO_APP_CLIENT_ID: z.string().min(1),
  S3_RAW_BUCKET: z.string().min(1),
  /** Opcional: se definido, exige header x-worker-key igual a este valor nas rotas internas do worker */
  WORKER_API_KEY: z.string().optional(),
  CORS_ORIGIN: z.string().optional().default("*"),
});

export type AppConfig = z.infer<typeof envSchema>;

const migrateEnvSchema = z.object({
  NODE_ENV: z.string().optional().default("development"),
  DATABASE_URL: z.string().min(1),
  /** Usuário dono do schema (ex.: postgres no RDS). Usado por `npm run db:migrate:owner`. */
  MIGRATE_DATABASE_URL: z.string().optional(),
});

export type MigrateConfig = {
  databaseUrl: string;
  source: "MIGRATE_DATABASE_URL" | "DATABASE_URL";
};

export function loadConfig(): AppConfig {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error("Variáveis de ambiente inválidas para app60-api");
  }
  return parsed.data;
}

export function loadMigrateConfig(options?: { requireOwnerUrl?: boolean }): MigrateConfig {
  const parsed = migrateEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error("Variáveis de ambiente inválidas para migração (DATABASE_URL obrigatório)");
  }

  const ownerUrl = parsed.data.MIGRATE_DATABASE_URL?.trim();
  if (options?.requireOwnerUrl) {
    if (!ownerUrl) {
      throw new Error(
        "Defina MIGRATE_DATABASE_URL no .env local (usuário dono do schema, ex.: postgres no RDS) e rode npm run db:migrate:owner."
      );
    }
    return { databaseUrl: ownerUrl, source: "MIGRATE_DATABASE_URL" };
  }

  if (ownerUrl) {
    return { databaseUrl: ownerUrl, source: "MIGRATE_DATABASE_URL" };
  }

  return { databaseUrl: parsed.data.DATABASE_URL, source: "DATABASE_URL" };
}
