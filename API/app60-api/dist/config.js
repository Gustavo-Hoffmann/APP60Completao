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
const migrateEnvSchema = z.object({
    NODE_ENV: z.string().optional().default("development"),
    DATABASE_URL: z.string().min(1),
});
export function loadConfig() {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
        console.error(parsed.error.flatten().fieldErrors);
        throw new Error("Variáveis de ambiente inválidas para app60-api");
    }
    return parsed.data;
}
export function loadMigrateConfig() {
    const parsed = migrateEnvSchema.safeParse(process.env);
    if (!parsed.success) {
        console.error(parsed.error.flatten().fieldErrors);
        throw new Error("Variáveis de ambiente inválidas para migração (DATABASE_URL obrigatório)");
    }
    return parsed.data;
}
