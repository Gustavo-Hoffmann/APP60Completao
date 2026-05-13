import { createRemoteJWKSet, jwtVerify } from "jose";
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

export function createAuthMiddleware(cfg: AppConfig, pool: Pool) {
  const issuer = `https://cognito-idp.${cfg.AWS_REGION}.amazonaws.com/${cfg.COGNITO_USER_POOL_ID}`;
  const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));

  return async function requireAuth(req: Request, res: Response, next: NextFunction) {
    const hdr = req.headers.authorization;
    if (!hdr?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Token ausente." });
      return;
    }
    const token = hdr.slice(7);
    try {
      const { payload } = await jwtVerify(token, jwks, {
        issuer,
        audience: cfg.COGNITO_APP_CLIENT_ID,
      });
      const sub = String(payload.sub);
      const r = await pool.query(
        `SELECT id, cognito_sub, email, full_name, role::text AS role, primary_institution_id, is_active
         FROM app_users WHERE cognito_sub = $1 LIMIT 1`,
        [sub]
      );
      const row = r.rows[0];
      if (!row?.is_active) {
        res.status(403).json({ error: "Usuário inativo ou não provisionado na base." });
        return;
      }
      req.authUser = {
        ...(row as AuthedUser),
        role: String(row.role).trim().toUpperCase(),
      };
      next();
    } catch (e) {
      console.error("JWT verify failed", e);
      res.status(401).json({ error: "Token inválido ou expirado." });
    }
  };
}

/** Cognito às vezes omite `aud` no access token; use id token no cliente. */
export function createOptionalAudienceAuthMiddleware(cfg: AppConfig, pool: Pool) {
  const issuer = `https://cognito-idp.${cfg.AWS_REGION}.amazonaws.com/${cfg.COGNITO_USER_POOL_ID}`;
  const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));

  return async function requireAuthFlexible(req: Request, res: Response, next: NextFunction) {
    const hdr = req.headers.authorization;
    if (!hdr?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Token ausente." });
      return;
    }
    const token = hdr.slice(7);
    try {
      let payload;
      try {
        const v = await jwtVerify(token, jwks, {
          issuer,
          audience: cfg.COGNITO_APP_CLIENT_ID,
        });
        payload = v.payload;
      } catch {
        const v = await jwtVerify(token, jwks, { issuer });
        payload = v.payload;
      }
      const sub = String(payload.sub);
      const r = await pool.query(
        `SELECT id, cognito_sub, email, full_name, role::text AS role, primary_institution_id, is_active
         FROM app_users WHERE cognito_sub = $1 LIMIT 1`,
        [sub]
      );
      const row = r.rows[0];
      if (!row?.is_active) {
        res.status(403).json({ error: "Usuário inativo ou não provisionado na base." });
        return;
      }
      req.authUser = {
        ...(row as AuthedUser),
        role: String(row.role).trim().toUpperCase(),
      };
      next();
    } catch (e) {
      console.error("JWT verify failed", e);
      res.status(401).json({ error: "Token inválido ou expirado." });
    }
  };
}
