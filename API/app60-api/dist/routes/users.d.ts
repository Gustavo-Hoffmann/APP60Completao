import type { Pool } from "pg";
import type { AppConfig } from "../config.js";
export declare function usersRouter(pool: Pool, cfg: AppConfig): import("express-serve-static-core").Router;
