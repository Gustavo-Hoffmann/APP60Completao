import type { Pool } from "pg";
/**
 * Primeiro SUPER_ADMIN quando o banco ainda não tem usuários.
 * Protegido por BOOTSTRAP_SECRET (header x-app60-bootstrap-secret).
 */
export declare function bootstrapRouter(pool: Pool): import("express-serve-static-core").Router;
