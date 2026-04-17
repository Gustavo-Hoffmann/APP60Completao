import "dotenv/config";
import { z } from "zod";
declare const envSchema: z.ZodObject<{
    NODE_ENV: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    PORT: z.ZodDefault<z.ZodNumber>;
    DATABASE_URL: z.ZodString;
    AWS_REGION: z.ZodString;
    COGNITO_USER_POOL_ID: z.ZodString;
    COGNITO_APP_CLIENT_ID: z.ZodString;
    S3_RAW_BUCKET: z.ZodString;
    /** Opcional: se definido, exige header x-worker-key igual a este valor nas rotas internas do worker */
    WORKER_API_KEY: z.ZodOptional<z.ZodString>;
    CORS_ORIGIN: z.ZodDefault<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    NODE_ENV: string;
    PORT: number;
    DATABASE_URL: string;
    AWS_REGION: string;
    COGNITO_USER_POOL_ID: string;
    COGNITO_APP_CLIENT_ID: string;
    S3_RAW_BUCKET: string;
    CORS_ORIGIN: string;
    WORKER_API_KEY?: string | undefined;
}, {
    DATABASE_URL: string;
    AWS_REGION: string;
    COGNITO_USER_POOL_ID: string;
    COGNITO_APP_CLIENT_ID: string;
    S3_RAW_BUCKET: string;
    NODE_ENV?: string | undefined;
    PORT?: number | undefined;
    WORKER_API_KEY?: string | undefined;
    CORS_ORIGIN?: string | undefined;
}>;
export type AppConfig = z.infer<typeof envSchema>;
declare const migrateEnvSchema: z.ZodObject<{
    NODE_ENV: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    DATABASE_URL: z.ZodString;
}, "strip", z.ZodTypeAny, {
    NODE_ENV: string;
    DATABASE_URL: string;
}, {
    DATABASE_URL: string;
    NODE_ENV?: string | undefined;
}>;
export declare function loadConfig(): AppConfig;
export declare function loadMigrateConfig(): z.infer<typeof migrateEnvSchema>;
export {};
