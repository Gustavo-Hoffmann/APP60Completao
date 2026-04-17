import { Router } from "express";
import { z } from "zod";
import type { Pool } from "pg";
import { institutionIdOrThrow, isSuperAdmin } from "../lib/authz.js";
import type { AuthedUser } from "../middleware/auth.js";

function normalizeIvcfClass(label?: unknown, key?: unknown) {
  const normalizedLabel = String(label ?? "").trim().toLowerCase();
  if (normalizedLabel === "robusto") return "Robusto" as const;
  if (["pré-frágil", "pre-frágil", "pre-fragil", "pré-fragil"].includes(normalizedLabel)) {
    return "Pré-Frágil" as const;
  }
  if (["frágil", "fragil"].includes(normalizedLabel)) return "Frágil" as const;

  const normalizedKey = String(key ?? "").trim().toLowerCase();
  if (normalizedKey === "robusto") return "Robusto" as const;
  if (["pre_fragil", "pre-fragil", "pré_fragil", "pré-frágil"].includes(normalizedKey)) {
    return "Pré-Frágil" as const;
  }
  if (normalizedKey === "fragil") return "Frágil" as const;
  return undefined;
}

function collectionVisibilityClause(u: AuthedUser, alias = "c", baseIdx = 1) {
  if (isSuperAdmin(u)) {
    return { sql: "TRUE", params: [] as unknown[] };
  }
  const inst = u.primary_institution_id;
  if (!inst) return { sql: "FALSE", params: [] as unknown[] };

  const i = baseIdx;
  if (u.role === "ADMIN" || u.role === "GESTOR") {
    return { sql: `${alias}.institution_id_at_collection = $${i}`, params: [inst] };
  }
  if (u.role === "SUPERVISOR") {
    const j = baseIdx + 1;
    return {
      sql: `(
        ${alias}.institution_id_at_collection = $${i}
        AND (
          ${alias}.performed_by_user_id = $${j}
          OR ${alias}.performed_by_user_id IN (
            SELECT evaluator_user_id
            FROM supervision_edges
            WHERE supervisor_user_id = $${j}
              AND institution_id = $${i}
              AND valid_to IS NULL
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
  return { sql: "FALSE", params: [] as unknown[] };
}

export function dashboardRouter(pool: Pool) {
  const r = Router();

  r.get("/summary", async (req, res) => {
    const u = req.authUser as AuthedUser;

    const parsed = z
      .object({
        year: z
          .string()
          .optional()
          .transform((v) => (v ? Number(v) : new Date().getFullYear())),
      })
      .safeParse(req.query);

    if (!parsed.success) {
      res.status(400).json({ error: "Parâmetros inválidos." });
      return;
    }

    const year = parsed.data.year;
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      res.status(400).json({ error: "Ano inválido." });
      return;
    }

    try {
      const vis = collectionVisibilityClause(u, "c", 1);

      const [participantsTotalQ, collectionsTotalQ, collectionsMonthQ, collectionsByMonthQ, topTestQ] =
        await Promise.all([
          isSuperAdmin(u)
            ? pool.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM participants`)
            : pool.query<{ count: number }>(
                `SELECT COUNT(DISTINCT p.id)::int AS count
                 FROM participants p
                 JOIN participant_institution_history h ON h.participant_id = p.id
                 WHERE h.institution_id = $1 AND h.valid_to IS NULL`,
                [institutionIdOrThrow(u)]
              ),
          pool.query<{ count: number }>(
            `SELECT COUNT(*)::int AS count
             FROM collections c
             WHERE (${vis.sql})`,
            vis.params
          ),
          pool.query<{ count: number }>(
            `SELECT COUNT(*)::int AS count
             FROM collections c
             WHERE (${vis.sql})
               AND date_trunc('month', c.performed_at) = date_trunc('month', now())`,
            vis.params
          ),
          pool.query<{ month: number; count: number }>(
            `SELECT EXTRACT(MONTH FROM c.performed_at)::int AS month,
                    COUNT(*)::int AS count
             FROM collections c
             WHERE (${vis.sql})
               AND c.performed_at >= make_date($${vis.params.length + 1}::int, 1, 1)
               AND c.performed_at < make_date($${vis.params.length + 1}::int + 1, 1, 1)
             GROUP BY 1
             ORDER BY 1 ASC`,
            [...vis.params, year]
          ),
          pool.query<{ test_type: string; count: number }>(
            `SELECT c.test_type::text AS test_type, COUNT(*)::int AS count
             FROM collections c
             WHERE (${vis.sql})
             GROUP BY 1
             ORDER BY count DESC
             LIMIT 1`,
            vis.params
          ),
        ]);

      const ivcfRows = await pool.query<{
        participant_id: string;
        classification_label: string | null;
        classification_key: string | null;
      }>(
        `SELECT DISTINCT ON (c.participant_id)
           c.participant_id,
           (cr.metrics_json ->> 'classification_label') AS classification_label,
           (cr.metrics_json ->> 'classification_key') AS classification_key
         FROM collection_results cr
         JOIN collections c ON c.id = cr.collection_id
         WHERE (${vis.sql})
           AND c.test_type = 'IVCF20'
         ORDER BY c.participant_id, c.session_number DESC, cr.updated_at DESC NULLS LAST, cr.created_at DESC NULLS LAST`,
        vis.params
      );

      const ivcf = { robusto: 0, preFragil: 0, fragil: 0 };
      for (const row of ivcfRows.rows) {
        const cls = normalizeIvcfClass(row.classification_label, row.classification_key);
        if (cls === "Robusto") ivcf.robusto += 1;
        if (cls === "Pré-Frágil") ivcf.preFragil += 1;
        if (cls === "Frágil") ivcf.fragil += 1;
      }

      res.json({
        year,
        participantsTotal: participantsTotalQ.rows[0]?.count ?? 0,
        collectionsTotal: collectionsTotalQ.rows[0]?.count ?? 0,
        collectionsMonth: collectionsMonthQ.rows[0]?.count ?? 0,
        collectionsByMonth: collectionsByMonthQ.rows ?? [],
        topTest: topTestQ.rows[0] ? { testType: topTestQ.rows[0].test_type, count: topTestQ.rows[0].count } : null,
        ivcf,
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Erro ao carregar dashboard." });
    }
  });

  return r;
}

