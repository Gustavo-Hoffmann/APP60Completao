import { Router } from "express";
import { z } from "zod";
import type { Pool } from "pg";
import {
  canReadParticipants,
  canWriteParticipants,
  institutionIdOrThrow,
  isSuperAdmin,
} from "../lib/authz.js";
import type { AuthedUser } from "../middleware/auth.js";

function onlyDigits(s: string) {
  return s.replace(/\D/g, "");
}

function isValidCpfDigits(cpf: string) {
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  const calcCheck = (base: string, factorStart: number) => {
    let sum = 0;
    for (let i = 0; i < base.length; i += 1) {
      sum += Number(base[i]) * (factorStart - i);
    }
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };
  const d9 = calcCheck(cpf.slice(0, 9), 10);
  const d10 = calcCheck(cpf.slice(0, 10), 11);
  return d9 === Number(cpf[9]) && d10 === Number(cpf[10]);
}

function normalizeIdentityInternational(raw: string) {
  const s = raw.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (!s.length) return "";
  if (s.length > 80) return s.slice(0, 80);
  return s;
}

function collectionVisibilityClause(u: AuthedUser, alias = "c", baseIdx = 2) {
  if (isSuperAdmin(u)) {
    return { sql: "TRUE", params: [] as unknown[] };
  }
  const inst = u.primary_institution_id;
  if (!inst) {
    return { sql: "FALSE", params: [] };
  }
  const i = baseIdx;
  if (u.role === "ADMIN" || u.role === "GESTOR") {
    return {
      sql: `${alias}.institution_id_at_collection = $${i}`,
      params: [inst],
    };
  }
  if (u.role === "SUPERVISOR") {
    const j = baseIdx + 1;
    return {
      sql: `(
        ${alias}.institution_id_at_collection = $${i}
        AND (
          ${alias}.performed_by_user_id = $${j}
          OR ${alias}.performed_by_user_id IN (
            SELECT evaluator_user_id FROM supervision_edges
            WHERE supervisor_user_id = $${j} AND institution_id = $${i} AND valid_to IS NULL
          )
        )
      )`,
      params: [inst, u.id],
    };
  }
  if (u.role === "AVALIADOR") {
    const j = baseIdx + 1;
    return {
      sql: `${alias}.institution_id_at_collection = $${i} AND ${alias}.performed_by_user_id = $${j}`,
      params: [inst, u.id],
    };
  }
  return { sql: "FALSE", params: [] };
}

export function participantsRouter(pool: Pool) {
  const r = Router();

  r.get("/meta/user-names", async (req, res) => {
    const u = req.authUser as AuthedUser;
    if (!canReadParticipants(u)) {
      res.status(403).json({ error: "Sem permissão." });
      return;
    }
    const raw = req.query.ids;
    const idList = typeof raw === "string" ? raw.split(",").filter(Boolean) : [];
    if (!idList.length) {
      res.json([]);
      return;
    }
    try {
      let q;
      if (isSuperAdmin(u)) {
        q = await pool.query(
          `SELECT id, full_name FROM app_users WHERE id = ANY($1::uuid[])`,
          [idList]
        );
      } else {
        const inst = institutionIdOrThrow(u);
        q = await pool.query(
          `SELECT id, full_name FROM app_users WHERE id = ANY($1::uuid[]) AND primary_institution_id = $2`,
          [idList, inst]
        );
      }
      res.json(q.rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Erro." });
    }
  });

  r.get("/", async (req, res) => {
    const u = req.authUser as AuthedUser;
    if (!canReadParticipants(u)) {
      res.status(403).json({ error: "Sem permissão." });
      return;
    }
    try {
      let rows;
      if (isSuperAdmin(u)) {
        const q = await pool.query(
          `SELECT p.id, p.nationality, p.cpf_normalized AS cpf, p.full_name, p.birth_date, p.sex,
                  p.cep, p.street, p.number, p.neighborhood, p.city, p.state, p.complement,
                  p.created_at, p.updated_at
           FROM participants p
           ORDER BY p.full_name ASC`
        );
        rows = q.rows;
      } else {
        const inst = institutionIdOrThrow(u);
        const q = await pool.query(
          `SELECT DISTINCT p.id, p.nationality, p.cpf_normalized AS cpf, p.full_name, p.birth_date, p.sex,
                  p.cep, p.street, p.number, p.neighborhood, p.city, p.state, p.complement,
                  p.created_at, p.updated_at,
                  h.requested_by_user_id AS created_by_user_id
           FROM participants p
           JOIN participant_institution_history h ON h.participant_id = p.id
           WHERE h.institution_id = $1 AND h.valid_to IS NULL
           ORDER BY p.full_name ASC`,
          [inst]
        );
        rows = q.rows;
      }

      const ids = rows.map((x) => x.id);
      let results: unknown[] = [];
      if (ids.length) {
        const vis = collectionVisibilityClause(u, "c", 2);
        const rsql = await pool.query(
          `SELECT c.participant_id, c.test_type::text AS test_type, c.session_number,
                  cr.metrics_json, cr.plot_json, cr.created_at, cr.updated_at
           FROM collection_results cr
           JOIN collections c ON c.id = cr.collection_id
           WHERE c.participant_id = ANY($1::uuid[])
             AND (${vis.sql})
             AND c.test_type::text IN ('MARCHA','SL30S','IVCF20')
           ORDER BY c.session_number ASC`,
          [ids, ...vis.params]
        );
        results = rsql.rows;
      }

      res.json({ participants: rows, results });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Erro ao listar participantes." });
    }
  });

  r.get("/:id", async (req, res) => {
    const u = req.authUser as AuthedUser;
    if (!canReadParticipants(u)) {
      res.status(403).json({ error: "Sem permissão." });
      return;
    }
    const id = req.params.id;
    try {
      const p = await pool.query(`SELECT * FROM participants WHERE id = $1`, [id]);
      const part = p.rows[0];
      if (!part) {
        res.status(404).json({ error: "Não encontrado." });
        return;
      }
      let createdByUserId: string | null = null;
      if (!isSuperAdmin(u)) {
        const inst = institutionIdOrThrow(u);
        const link = await pool.query(
          `SELECT requested_by_user_id
           FROM participant_institution_history
           WHERE participant_id = $1 AND institution_id = $2 AND valid_to IS NULL
           LIMIT 1`,
          [id, inst]
        );
        if (!link.rows[0]) {
          res.status(404).json({ error: "Não encontrado." });
          return;
        }
        createdByUserId = link.rows[0].requested_by_user_id ?? null;
      }

      const vis = collectionVisibilityClause(u, "c", 2);
      const rsql = await pool.query(
        `SELECT c.participant_id, c.test_type::text AS test_type, c.session_number,
                cr.metrics_json, cr.plot_json, cr.created_at, cr.updated_at
         FROM collection_results cr
         JOIN collections c ON c.id = cr.collection_id
         WHERE c.participant_id = $1
           AND (${vis.sql})
           AND c.test_type::text IN ('MARCHA','SL30S','IVCF20')
         ORDER BY c.session_number ASC`,
        [id, ...vis.params]
      );

      res.json({
        participant: {
          id: part.id,
          nationality: part.nationality ?? "BR",
          cpf: part.cpf_normalized,
          identity: part.cpf_normalized,
          full_name: part.full_name,
          birth_date: part.birth_date,
          sex: part.sex,
          cep: part.cep,
          street: part.street,
          number: part.number,
          neighborhood: part.neighborhood,
          city: part.city,
          state: part.state,
          complement: part.complement,
          created_at: part.created_at,
          updated_at: part.updated_at,
          created_by_user_id: createdByUserId,
        },
        results: rsql.rows,
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Erro ao carregar participante." });
    }
  });

  const upsertSchema = z
    .object({
      id: z.string().uuid().optional(),
      fullName: z.string().min(1),
      nationality: z.string().length(2),
      identity: z.string().optional(),
      /** @deprecated usar identity */
      cpf: z.string().optional(),
      birthDate: z.string().optional(),
      sex: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      cep: z.string().optional(),
      street: z.string().optional(),
      number: z.string().optional(),
      neighborhood: z.string().optional(),
      complement: z.string().optional(),
    })
    .superRefine((val, ctx) => {
      const doc = (val.identity ?? val.cpf ?? "").trim();
      if (!doc) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "identity_required",
          path: ["identity"],
        });
      }
    });

  r.post("/", async (req, res) => {
    const u = req.authUser as AuthedUser;
    if (!canWriteParticipants(u)) {
      res.status(403).json({ error: "Sem permissão." });
      return;
    }
    const parsed = upsertSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const b = parsed.data;
    const nationality = String(b.nationality || "").trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(nationality)) {
      res.status(400).json({ error: "Nacionalidade inválida (use código ISO, ex.: BR, PT)." });
      return;
    }

    const docRaw = String(b.identity ?? b.cpf ?? "").trim();
    let identityStored: string;
    if (nationality === "BR") {
      const cpf = onlyDigits(docRaw);
      if (!isValidCpfDigits(cpf)) {
        res.status(400).json({ error: "CPF inválido." });
        return;
      }
      identityStored = cpf;
    } else {
      const idNorm = normalizeIdentityInternational(docRaw);
      if (idNorm.length < 3) {
        res.status(400).json({ error: "Documento de identidade inválido." });
        return;
      }
      identityStored = idNorm;
    }

    const inst = isSuperAdmin(u) ? null : institutionIdOrThrow(u);
    if (isSuperAdmin(u)) {
      res.status(400).json({ error: "Super admin use fluxo com institutionId explícito (em evolução)." });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      let pid = b.id ?? null;
      let row;
      if (pid) {
        const ex = await client.query(`SELECT id FROM participants WHERE id = $1`, [pid]);
        if (!ex.rows[0]) {
          await client.query("ROLLBACK");
          res.status(404).json({ error: "Participante não encontrado." });
          return;
        }
        const up = await client.query(
          `UPDATE participants SET
             full_name = $2, nationality = $3, cpf_normalized = $4, birth_date = $5, sex = $6,
             cep = $7, street = $8, number = $9, neighborhood = $10, city = $11, state = $12, complement = $13
           WHERE id = $1
           RETURNING *`,
          [
            pid,
            b.fullName.trim(),
            nationality,
            identityStored,
            b.birthDate || null,
            b.sex ?? null,
            nationality === "BR" && b.cep ? onlyDigits(b.cep) : (b.cep?.trim() || null),
            b.street?.trim() || null,
            b.number?.trim() || null,
            b.neighborhood?.trim() || null,
            b.city?.trim() || null,
            b.state?.trim()?.toUpperCase() || null,
            b.complement?.trim() || null,
          ]
        );
        row = up.rows[0];
      } else {
        let existingId: string | null = null;
        if (nationality === "BR") {
          const existing = await client.query(
            `SELECT id FROM participants WHERE nationality = 'BR' AND cpf_normalized = $1`,
            [identityStored]
          );
          existingId = existing.rows[0]?.id ?? null;
        }
        if (existingId) {
          pid = existingId;
          const up = await client.query(
            `UPDATE participants SET
               full_name = $2, nationality = $3, birth_date = $4, sex = $5,
               cep = $6, street = $7, number = $8, neighborhood = $9, city = $10, state = $11, complement = $12
             WHERE id = $1
             RETURNING *`,
            [
              pid,
              b.fullName.trim(),
              nationality,
              b.birthDate || null,
              b.sex ?? null,
              nationality === "BR" && b.cep ? onlyDigits(b.cep) : (b.cep?.trim() || null),
              b.street?.trim() || null,
              b.number?.trim() || null,
              b.neighborhood?.trim() || null,
              b.city?.trim() || null,
              b.state?.trim()?.toUpperCase() || null,
              b.complement?.trim() || null,
            ]
          );
          row = up.rows[0];
        } else {
          const ins = await client.query(
            `INSERT INTO participants (
               nationality, cpf_normalized, full_name, birth_date, sex,
               cep, street, number, neighborhood, city, state, complement
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
             RETURNING *`,
            [
              nationality,
              identityStored,
              b.fullName.trim(),
              b.birthDate || null,
              b.sex ?? null,
              nationality === "BR" && b.cep ? onlyDigits(b.cep) : (b.cep?.trim() || null),
              b.street?.trim() || null,
              b.number?.trim() || null,
              b.neighborhood?.trim() || null,
              b.city?.trim() || null,
              b.state?.trim()?.toUpperCase() || null,
              b.complement?.trim() || null,
            ]
          );
          row = ins.rows[0];
          pid = row.id;
        }
      }

      const open = await client.query(
        `SELECT id FROM participant_institution_history
         WHERE participant_id = $1 AND institution_id = $2 AND valid_to IS NULL`,
        [pid, inst]
      );
      if (!open.rows[0]) {
        await client.query(
          `INSERT INTO participant_institution_history
             (participant_id, institution_id, reason, requested_by_user_id, approved_by_user_id)
           VALUES ($1, $2, 'ENROLL', $3, $3)`,
          [pid, inst, u.id]
        );
      }

      await client.query("COMMIT");
      res.status(201).json({
        id: row.id,
        nationality: row.nationality ?? nationality,
        cpf: row.nationality === "BR" ? row.cpf_normalized : null,
        identity: row.cpf_normalized,
        full_name: row.full_name,
        birth_date: row.birth_date,
        sex: row.sex,
        cep: row.cep,
        street: row.street,
        number: row.number,
        neighborhood: row.neighborhood,
        city: row.city,
        state: row.state,
        complement: row.complement,
        created_at: row.created_at,
        updated_at: row.updated_at,
      });
    } catch (e) {
      await client.query("ROLLBACK");
      console.error(e);
      res.status(400).json({
        error: e instanceof Error ? e.message : "Erro ao salvar participante.",
      });
    } finally {
      client.release();
    }
  });

  r.delete("/:id", async (req, res) => {
    const u = req.authUser as AuthedUser;
    if (!isSuperAdmin(u)) {
      res.status(403).json({ error: "Apenas super admin remove participante global." });
      return;
    }
    try {
      await pool.query(`DELETE FROM participants WHERE id = $1`, [req.params.id]);
      res.status(204).send();
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Erro ao excluir." });
    }
  });

  return r;
}
