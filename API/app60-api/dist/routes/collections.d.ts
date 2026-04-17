import type { Pool } from "pg";
import type { AppConfig } from "../config.js";
export declare function collectionsRouter(pool: Pool, cfg: AppConfig): import("express-serve-static-core").Router;
