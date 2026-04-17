import { Router } from "express";
import type { Pool } from "pg";
import type { AuthedUser } from "../middleware/auth.js";

export function meRouter(pool: Pool) {
  const r = Router();

  r.get("/", async (req, res) => {
    const u = req.authUser as AuthedUser;
    try {
      let institution_name: string | null = null;
      if (u.primary_institution_id) {
        const q = await pool.query<{ name: string }>(
          `SELECT name FROM institutions WHERE id = $1`,
          [u.primary_institution_id]
        );
        institution_name = q.rows[0]?.name ?? null;
      }

      res.json({
        id: u.id,
        email: u.email,
        name: u.full_name,
        role: u.role,
        institution_id: u.primary_institution_id,
        institution_name,
        is_active: u.is_active,
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Erro ao carregar perfil." });
    }
  });

  return r;
}
