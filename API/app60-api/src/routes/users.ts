import { Router } from "express";
import { z } from "zod";
import type { Pool } from "pg";
import {
  canCreateUsers,
  canListUsers,
  canMigrateUsers,
  canActorCreateRole,
  institutionIdOrThrow,
  isGlobalOperator,
  normalizeAppRole,
  roleRequiresInstitution,
} from "../lib/authz.js";
import {
  cognitoCreateUserWithPassword,
  cognitoDeleteUser,
  cognitoSetDisabled,
  createCognito,
} from "../lib/cognito.js";
import type { AppConfig } from "../config.js";
import type { AuthedUser } from "../middleware/auth.js";

function onlyDigits(s: string) {
  return s.replace(/\D/g, "");
}

const passwordPolicyMessage =
  "A senha deve ter ao menos 8 caracteres, com letra maiúscula, minúscula, número e símbolo.";

function isPasswordPolicyCompliant(password: string) {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().refine(isPasswordPolicyCompliant, passwordPolicyMessage),
  fullName: z.string().min(2),
  role: z.preprocess(
    (value) => (typeof value === "string" ? value.trim().toUpperCase() : value),
    z.enum(["ADMIN", "GESTOR", "SUPERVISOR", "AVALIADOR"])
  ),
  institutionId: z.string().uuid().optional(),
  supervisorId: z.string().uuid().optional(),
  cpf: z.string().optional(),
  phone: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  birth_date: z.string().optional(),
});

const patchSchema = z.object({
  fullName: z.string().min(2).optional(),
  phone: z.string().optional(),
  cpf: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  birth_date: z.string().optional(),
  role: z.enum(["ADMIN", "GESTOR", "SUPERVISOR", "AVALIADOR"]).optional(),
  institutionId: z.string().uuid().optional().nullable(),
  is_active: z.boolean().optional(),
});

export function usersRouter(pool: Pool, cfg: AppConfig) {
  const r = Router();
  const cognito = createCognito(cfg);

  r.get("/", async (req, res) => {
    const u = req.authUser as AuthedUser;
    if (!canListUsers(u)) {
      res.status(403).json({ error: "Sem permissão para listar usuários." });
      return;
    }
    const activeOnly = req.query.active !== "false";
    try {
      let q;
      if (isGlobalOperator(u)) {
        q = await pool.query(
          `SELECT id, email, full_name, role::text AS role, primary_institution_id, is_active, created_at,
                  cpf_normalized AS cpf, phone, country, city, state, birth_date,
                  (SELECT se.supervisor_user_id
                     FROM supervision_edges se
                    WHERE se.evaluator_user_id = app_users.id
                      AND se.institution_id = app_users.primary_institution_id
                      AND se.valid_to IS NULL
                    ORDER BY se.valid_from DESC
                    LIMIT 1) AS supervisor_id
           FROM app_users
           WHERE ($1::boolean IS FALSE OR is_active = true)
           ORDER BY created_at ASC`,
          [activeOnly]
        );
      } else if (normalizeAppRole(u.role) === "SUPERVISOR") {
        q = await pool.query(
          `SELECT id, email, full_name, role::text AS role, primary_institution_id, is_active, created_at,
                  cpf_normalized AS cpf, phone, country, city, state, birth_date, created_by_id,
                  (SELECT se.supervisor_user_id
                     FROM supervision_edges se
                    WHERE se.evaluator_user_id = app_users.id
                      AND se.institution_id = app_users.primary_institution_id
                      AND se.valid_to IS NULL
                    ORDER BY se.valid_from DESC
                    LIMIT 1) AS supervisor_id
           FROM app_users
           WHERE primary_institution_id = $1
             AND ($2::boolean IS FALSE OR is_active = true)
             AND (
               id = $3
               OR (role = 'AVALIADOR' AND created_by_id = $3)
             )
           ORDER BY created_at ASC`,
          [u.primary_institution_id, activeOnly, u.id]
        );
      } else {
        q = await pool.query(
          `SELECT id, email, full_name, role::text AS role, primary_institution_id, is_active, created_at,
                  cpf_normalized AS cpf, phone, country, city, state, birth_date, created_by_id,
                  (SELECT se.supervisor_user_id
                     FROM supervision_edges se
                    WHERE se.evaluator_user_id = app_users.id
                      AND se.institution_id = app_users.primary_institution_id
                      AND se.valid_to IS NULL
                    ORDER BY se.valid_from DESC
                    LIMIT 1) AS supervisor_id
           FROM app_users
           WHERE primary_institution_id = $1
             AND ($2::boolean IS FALSE OR is_active = true)
           ORDER BY created_at ASC`,
          [u.primary_institution_id, activeOnly]
        );
      }
      res.json(q.rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Erro ao listar usuários." });
    }
  });

  r.get("/org-metrics", async (req, res) => {
    const u = req.authUser as AuthedUser;
    if (!canListUsers(u) || isGlobalOperator(u)) {
      res.status(403).json({ error: "Sem permissão." });
      return;
    }
    try {
      const inst = institutionIdOrThrow(u);
      const [enrollmentsQ, collectionsQ] = await Promise.all([
        pool.query<{ user_id: string; count: number }>(
          `SELECT requested_by_user_id AS user_id, COUNT(*)::int AS count
           FROM participant_institution_history
           WHERE institution_id = $1
             AND valid_to IS NULL
             AND requested_by_user_id IS NOT NULL
           GROUP BY requested_by_user_id`,
          [inst]
        ),
        pool.query<{ user_id: string; count: number }>(
          `SELECT performed_by_user_id AS user_id, COUNT(*)::int AS count
           FROM collections
           WHERE institution_id_at_collection = $1
             AND performed_by_user_id IS NOT NULL
           GROUP BY performed_by_user_id`,
          [inst]
        ),
      ]);

      const byUserId: Record<string, { enrollments: number; collections: number }> = {};
      for (const row of enrollmentsQ.rows) {
        byUserId[row.user_id] = { enrollments: row.count, collections: 0 };
      }
      for (const row of collectionsQ.rows) {
        const current = byUserId[row.user_id] ?? { enrollments: 0, collections: 0 };
        current.collections = row.count;
        byUserId[row.user_id] = current;
      }

      res.json({ byUserId });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Erro ao carregar métricas da equipe." });
    }
  });

  r.get("/:id", async (req, res) => {
    const actor = req.authUser as AuthedUser;
    const targetId = req.params.id;
    try {
      const t = await pool.query(
        `SELECT id, email, full_name, role::text AS role, primary_institution_id, is_active, created_at,
                cpf_normalized AS cpf, phone, country, city, state, birth_date, created_by_id
         FROM app_users WHERE id = $1`,
        [targetId]
      );
      const target = t.rows[0];
      if (!target) {
        res.status(404).json({ error: "Não encontrado." });
        return;
      }
      const sameInstitution =
        target.primary_institution_id &&
        actor.primary_institution_id &&
        target.primary_institution_id === actor.primary_institution_id;
      const supervisorManagesEvaluator =
        actor.role === "SUPERVISOR" &&
        String(target.role) === "AVALIADOR" &&
        target.created_by_id === actor.id &&
        sameInstitution;

      const canView =
        actor.id === targetId ||
        isGlobalOperator(actor) ||
        ((actor.role === "ADMIN" || actor.role === "GESTOR") && sameInstitution) ||
        supervisorManagesEvaluator;
      if (!canView) {
        res.status(403).json({ error: "Sem permissão." });
        return;
      }
      res.json(target);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Erro ao carregar usuário." });
    }
  });

  r.post("/", async (req, res) => {
    const actor = req.authUser as AuthedUser;
    if (!canCreateUsers(actor)) {
      res.status(403).json({ error: "Sem permissão para criar usuários." });
      return;
    }
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const body = parsed.data;
    const targetRole = normalizeAppRole(body.role);
    if (!targetRole || !canActorCreateRole(actor, targetRole)) {
      res.status(403).json({ error: "Não pode criar este papel." });
      return;
    }

    let institutionId: string | null = body.institutionId ?? null;
    if (!roleRequiresInstitution(targetRole)) {
      institutionId = null;
    } else if (normalizeAppRole(actor.role) === "GESTOR" || normalizeAppRole(actor.role) === "SUPERVISOR") {
      institutionId = actor.primary_institution_id;
    } else if (!institutionId) {
      res.status(400).json({ error: "institutionId é obrigatório." });
      return;
    }

    if (normalizeAppRole(actor.role) === "GESTOR" && (targetRole === "ADMIN" || targetRole === "GESTOR")) {
      res.status(403).json({ error: "Gestor não pode criar ADMIN/GESTOR." });
      return;
    }

    const cpfNorm = body.cpf ? onlyDigits(body.cpf) : null;
    if (cpfNorm && cpfNorm.length !== 11) {
      res.status(400).json({ error: "CPF inválido." });
      return;
    }

    if (targetRole === "AVALIADOR" && body.supervisorId) {
      const sup = await pool.query(
        `SELECT id FROM app_users WHERE id = $1 AND role = 'SUPERVISOR' AND primary_institution_id = $2 AND is_active = true`,
        [body.supervisorId, institutionId]
      );
      if (!sup.rows[0]) {
        res.status(400).json({ error: "Supervisor inválido para a instituição." });
        return;
      }
    }

    const client = await pool.connect();
    const cognitoUsername = body.email.trim().toLowerCase();
    let cognitoUserCreated = false;
    try {
      await client.query("BEGIN");
      const { sub } = await cognitoCreateUserWithPassword(cognito, cfg, {
        email: body.email,
        password: body.password,
        fullName: body.fullName,
      });
      cognitoUserCreated = true;

      const ins = await client.query(
        `INSERT INTO app_users (
           cognito_sub, email, full_name, role, primary_institution_id, is_active,
           cpf_normalized, phone, country, city, state, birth_date, created_by_id
         ) VALUES ($1,$2,$3,$4::app_role,$5,true,$6,$7,$8,$9,$10,$11,$12)
         RETURNING id, email, full_name, role::text AS role, primary_institution_id, is_active, created_at,
                   cpf_normalized AS cpf, phone, country, city, state, birth_date`,
        [
          sub,
          body.email.trim().toLowerCase(),
          body.fullName.trim(),
          targetRole,
          institutionId,
          cpfNorm,
          body.phone?.trim() || null,
          body.country?.trim() || null,
          body.city?.trim() || null,
          body.state?.trim()?.toUpperCase() || null,
          body.birth_date || null,
          actor.id,
        ]
      );
      const row = ins.rows[0];

      const supervisorForEdge =
        targetRole === "AVALIADOR"
          ? normalizeAppRole(actor.role) === "SUPERVISOR"
            ? actor.id
            : body.supervisorId ?? null
          : null;

      if (supervisorForEdge) {
        await client.query(
          `INSERT INTO supervision_edges (institution_id, supervisor_user_id, evaluator_user_id)
           VALUES ($1, $2, $3)`,
          [institutionId, supervisorForEdge, row.id]
        );
      }

      await client.query("COMMIT");
      res.status(201).json(row);
    } catch (e) {
      await client.query("ROLLBACK");
      if (cognitoUserCreated) {
        try {
          await cognitoDeleteUser(cognito, cfg, cognitoUsername);
        } catch (cleanupError) {
          console.error("Erro ao limpar usuário órfão no Cognito", cleanupError);
        }
      }
      console.error(e);
      res.status(400).json({
        error: e instanceof Error ? e.message : "Erro ao criar usuário.",
      });
    } finally {
      client.release();
    }
  });

  r.patch("/:id", async (req, res) => {
    const actor = req.authUser as AuthedUser;
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const targetId = req.params.id;
    try {
      const t = await pool.query(`SELECT * FROM app_users WHERE id = $1`, [targetId]);
      const target = t.rows[0];
      if (!target) {
        res.status(404).json({ error: "Usuário não encontrado." });
        return;
      }

      const sameInstitution =
        target.primary_institution_id &&
        actor.primary_institution_id &&
        target.primary_institution_id === actor.primary_institution_id;
      const supervisorManagesEvaluator =
        actor.role === "SUPERVISOR" &&
        String(target.role) === "AVALIADOR" &&
        target.created_by_id === actor.id &&
        sameInstitution;

      const canEdit =
        actor.id === targetId ||
        isGlobalOperator(actor) ||
        ((actor.role === "ADMIN" || actor.role === "GESTOR") && sameInstitution) ||
        supervisorManagesEvaluator;

      if (!canEdit) {
        res.status(403).json({ error: "Sem permissão para editar." });
        return;
      }

      if (parsed.data.role && actor.id !== targetId) {
        if (actor.role === "GESTOR") {
          const newRole = parsed.data.role;
          const targetRole = String(target.role);
          const okTarget = targetRole === "SUPERVISOR" || targetRole === "AVALIADOR";
          const okNew = newRole === "SUPERVISOR" || newRole === "AVALIADOR";
          if (!okTarget || !okNew) {
            res.status(403).json({ error: "Gestor só pode alterar papel de Supervisor/Avaliador." });
            return;
          }
        } else if (!canMigrateUsers(actor)) {
          res.status(403).json({ error: "Sem permissão para alterar papel." });
          return;
        } else if (actor.role === "ADMIN" && parsed.data.role === "ADMIN") {
          res.status(403).json({ error: "Não pode promover a ADMIN." });
          return;
        }
      }

      const nextRole = parsed.data.role ?? String(target.role);
      let nextInstitutionId: string | null | undefined = parsed.data.institutionId;
      if (nextInstitutionId !== undefined && !canMigrateUsers(actor)) {
        res.status(403).json({ error: "Sem permissão para alterar instituição." });
        return;
      }
      if (parsed.data.role && !roleRequiresInstitution(parsed.data.role)) {
        nextInstitutionId = null;
      }
      if (nextInstitutionId !== undefined && nextRole !== "ADMIN" && !nextInstitutionId) {
        res.status(400).json({ error: "institutionId é obrigatório para este papel." });
        return;
      }

      if (parsed.data.is_active === false && actor.id === targetId) {
        res.status(400).json({ error: "Não pode desativar a si mesmo." });
        return;
      }

      const updates: string[] = [];
      const vals: unknown[] = [];
      let i = 1;
      const b = parsed.data;
      if (b.fullName) {
        updates.push(`full_name = $${i++}`);
        vals.push(b.fullName.trim());
      }
      if (b.phone !== undefined) {
        updates.push(`phone = $${i++}`);
        vals.push(b.phone?.trim() || null);
      }
      if (b.cpf !== undefined) {
        const d = onlyDigits(b.cpf ?? "");
        updates.push(`cpf_normalized = $${i++}`);
        vals.push(d.length === 11 ? d : null);
      }
      if (b.country !== undefined) {
        updates.push(`country = $${i++}`);
        vals.push(b.country?.trim() || null);
      }
      if (b.city !== undefined) {
        updates.push(`city = $${i++}`);
        vals.push(b.city?.trim() || null);
      }
      if (b.state !== undefined) {
        updates.push(`state = $${i++}`);
        vals.push(b.state?.trim()?.toUpperCase() || null);
      }
      if (b.birth_date !== undefined) {
        updates.push(`birth_date = $${i++}`);
        vals.push(b.birth_date || null);
      }
      if (b.role) {
        updates.push(`role = $${i++}::app_role`);
        vals.push(b.role);
      }
      if (nextInstitutionId !== undefined) {
        updates.push(`primary_institution_id = $${i++}`);
        vals.push(nextInstitutionId);
      }
      if (b.is_active !== undefined) {
        updates.push(`is_active = $${i++}`);
        vals.push(b.is_active);
      }

      if (!updates.length) {
        res.json({ ok: true });
        return;
      }

      vals.push(targetId);
      await pool.query(
        `UPDATE app_users SET ${updates.join(", ")} WHERE id = $${i}`,
        vals
      );

      if (b.is_active === false) {
        await cognitoSetDisabled(cognito, cfg, target.email, true);
      }
      if (b.is_active === true) {
        await cognitoSetDisabled(cognito, cfg, target.email, false);
      }

      const out = await pool.query(
        `SELECT id, email, full_name, role::text AS role, primary_institution_id, is_active, created_at,
                cpf_normalized AS cpf, phone, country, city, state, birth_date
         FROM app_users WHERE id = $1`,
        [targetId]
      );
      res.json(out.rows[0]);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Erro ao atualizar usuário." });
    }
  });

  return r;
}
