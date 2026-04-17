import { Router } from "express";
import { z } from "zod";
import type { Pool } from "pg";

const bodySchema = z.object({
  cognitoSub: z.string().min(10),
  email: z.string().email(),
  fullName: z.string().min(2),
});

/**
 * Primeiro SUPER_ADMIN quando o banco ainda não tem usuários.
 * Protegido por BOOTSTRAP_SECRET (header x-app60-bootstrap-secret).
 */
export function bootstrapRouter(pool: Pool) {
  const r = Router();

  r.post("/first-super-admin", async (req, res) => {
    const secret = process.env.BOOTSTRAP_SECRET;
    if (!secret) {
      res.status(404).json({ error: "Bootstrap desativado." });
      return;
    }
    const hdr = req.headers["x-app60-bootstrap-secret"];
    if (hdr !== secret) {
      res.status(401).json({ error: "Segredo inválido." });
      return;
    }

    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const { cognitoSub, email, fullName } = parsed.data;

    try {
      const count = await pool.query(`SELECT count(*)::int AS c FROM app_users`);
      if ((count.rows[0]?.c ?? 0) > 0) {
        res.status(409).json({ error: "Já existem usuários. Bootstrap não permitido." });
        return;
      }

      await pool.query(
        `INSERT INTO app_users (cognito_sub, email, full_name, role, is_active, primary_institution_id)
         VALUES ($1, $2, $3, 'SUPER_ADMIN', true, NULL)`,
        [cognitoSub, email.trim().toLowerCase(), fullName.trim()]
      );
      res.status(201).json({ message: "Super admin criado." });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Erro ao criar super admin." });
    }
  });

  return r;
}
