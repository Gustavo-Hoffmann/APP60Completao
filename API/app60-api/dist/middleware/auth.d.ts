import type { NextFunction, Request, Response } from "express";
import type { Pool } from "pg";
import type { AppConfig } from "../config.js";
export type AuthedUser = {
    id: string;
    cognito_sub: string;
    email: string;
    full_name: string;
    role: string;
    primary_institution_id: string | null;
    is_active: boolean;
};
declare global {
    namespace Express {
        interface Request {
            authUser?: AuthedUser;
        }
    }
}
export declare function createAuthMiddleware(cfg: AppConfig, pool: Pool): (req: Request, res: Response, next: NextFunction) => Promise<void>;
/** Cognito às vezes omite `aud` no access token; use id token no cliente. */
export declare function createOptionalAudienceAuthMiddleware(cfg: AppConfig, pool: Pool): (req: Request, res: Response, next: NextFunction) => Promise<void>;
