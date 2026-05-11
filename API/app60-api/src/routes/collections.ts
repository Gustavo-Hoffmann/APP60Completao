import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Router } from "express";
import { z } from "zod";
import type { Pool } from "pg";
import type { AppConfig } from "../config.js";
import { institutionIdOrThrow, isSuperAdmin } from "../lib/authz.js";
import type { AuthedUser } from "../middleware/auth.js";

const TEST_TYPES = z.enum([
  "TUG",
  "MARCHA",
  "LOS",
  "SL30S",
  "UTT",
  "IVCF20",
  "FESI",
  "ACT_SEDENTARY",
]);

function buildRawKey(
  testType: string,
  participantId: string,
  sessionNumber: number,
  ext: string
) {
  return `raw/${testType}/${participantId}/S${sessionNumber}.${ext}`;
}

export function collectionsRouter(pool: Pool, cfg: AppConfig) {
  const r = Router();
  const s3 = new S3Client({ region: cfg.AWS_REGION });

  async function assertParticipantInInstitution(participantId: string, institutionId: string) {
    const q = await pool.query(
      `SELECT 1 FROM participant_institution_history
       WHERE participant_id = $1 AND institution_id = $2 AND valid_to IS NULL`,
      [participantId, institutionId]
    );
    return !!q.rows[0];
  }

  async function resolveSupervisorId(
    evaluatorId: string,
    institutionId: string
  ): Promise<string | null> {
    const q = await pool.query(
      `SELECT supervisor_user_id FROM supervision_edges
       WHERE evaluator_user_id = $1 AND institution_id = $2 AND valid_to IS NULL
       ORDER BY valid_from DESC LIMIT 1`,
      [evaluatorId, institutionId]
    );
    return q.rows[0]?.supervisor_user_id ?? null;
  }

  // Linhas em 'uploading' mais antigas que esse TTL são consideradas órfãs
  // (presigned URL expira em 15 min — damos folga para retry/rede).
  const UPLOADING_TTL_INTERVAL = "30 minutes";

  function isAdminLike(u: AuthedUser) {
    return isSuperAdmin(u) || u.role === "ADMIN";
  }

  async function canReadCollectionRaw(
    u: AuthedUser,
    args: { participantId: string; testType: string; sessionNumber: number },
  ): Promise<{ ok: true; bucket: string; key: string } | { ok: false; status: number; error: string }> {
    const testType = args.testType.toUpperCase();
    const parsedType = TEST_TYPES.safeParse(testType);
    if (!parsedType.success) {
      return { ok: false, status: 400, error: "test_type inválido." };
    }

    const participantId = args.participantId;
    const sessionNumber = args.sessionNumber;

    // SUPER_ADMIN/ADMIN têm visão global (ainda precisa existir).
    if (isAdminLike(u)) {
      const q = await pool.query(
        `SELECT raw_s3_bucket, raw_s3_key
         FROM collections
         WHERE participant_id = $1
           AND test_type = $2::test_kind
           AND session_number = $3
         LIMIT 1`,
        [participantId, testType, sessionNumber],
      );
      const row = q.rows[0];
      if (!row?.raw_s3_bucket || !row?.raw_s3_key) {
        return { ok: false, status: 404, error: "Arquivo bruto não encontrado." };
      }
      return { ok: true, bucket: row.raw_s3_bucket, key: row.raw_s3_key };
    }

    const inst = institutionIdOrThrow(u);
    if (!(await assertParticipantInInstitution(participantId, inst))) {
      return { ok: false, status: 404, error: "Participante não encontrado." };
    }

    // Papéis por instituição: GESTOR pode ler qualquer coleta da instituição;
    // SUPERVISOR pode ler as próprias e de avaliadores supervisionados;
    // AVALIADOR só lê as próprias.
    const params: unknown[] = [participantId, testType, sessionNumber, inst];
    let visibilitySql = "c.institution_id_at_collection = $4";

    if (u.role === "AVALIADOR") {
      params.push(u.id);
      visibilitySql += " AND c.performed_by_user_id = $5";
    } else if (u.role === "SUPERVISOR") {
      params.push(u.id);
      visibilitySql += ` AND (
        c.performed_by_user_id = $5
        OR c.performed_by_user_id IN (
          SELECT evaluator_user_id
          FROM supervision_edges
          WHERE supervisor_user_id = $5 AND institution_id = $4 AND valid_to IS NULL
        )
      )`;
    } else if (u.role === "GESTOR") {
      // já está coberto por institution
    } else {
      return { ok: false, status: 403, error: "Sem permissão." };
    }

    const q = await pool.query(
      `SELECT c.raw_s3_bucket, c.raw_s3_key
       FROM collections c
       WHERE c.participant_id = $1
         AND c.test_type = $2::test_kind
         AND c.session_number = $3
         AND (${visibilitySql})
       LIMIT 1`,
      params,
    );
    const row = q.rows[0];
    if (!row?.raw_s3_bucket || !row?.raw_s3_key) {
      return { ok: false, status: 404, error: "Arquivo bruto não encontrado." };
    }
    return { ok: true, bucket: row.raw_s3_bucket, key: row.raw_s3_key };
  }

  r.get("/raw-url/:participantId/:testType/:sessionNumber", async (req, res) => {
    const u = req.authUser as AuthedUser;
    const participantId = String(req.params.participantId || "");
    const testType = String(req.params.testType || "").toUpperCase();
    const sessionNumber = Number(req.params.sessionNumber);

    if (!participantId || !Number.isFinite(sessionNumber) || sessionNumber <= 0) {
      res.status(400).json({ error: "Parâmetros inválidos." });
      return;
    }

    try {
      const allowed = await canReadCollectionRaw(u, { participantId, testType, sessionNumber });
      if (!allowed.ok) {
        res.status(allowed.status).json({ error: allowed.error });
        return;
      }

      const ext = String(allowed.key.split(".").pop() ?? "csv").toLowerCase();
      const contentType = ext === "json" ? "application/json" : "text/csv";
      const filename = `${testType}-S${sessionNumber}-${participantId}.${ext}`;

      const cmd = new GetObjectCommand({
        Bucket: allowed.bucket,
        Key: allowed.key,
        ResponseContentType: contentType,
        ResponseContentDisposition: `attachment; filename="${filename}"`,
      });
      const url = await getSignedUrl(s3, cmd, { expiresIn: 120 });
      res.json({ url });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Erro ao preparar download." });
    }
  });

  r.get("/next-session/:participantId/:testType", async (req, res) => {
    const u = req.authUser as AuthedUser;
    const participantId = req.params.participantId;
    const testType = req.params.testType.toUpperCase();
    const parsed = TEST_TYPES.safeParse(testType);
    if (!parsed.success) {
      res.status(400).json({ error: "test_type inválido." });
      return;
    }
    const inst = isSuperAdmin(u) ? null : institutionIdOrThrow(u);
    if (inst && !(await assertParticipantInInstitution(participantId, inst))) {
      res.status(404).json({ error: "Participante não encontrado." });
      return;
    }
    try {
      const q = await pool.query(
        `SELECT session_number FROM collections
         WHERE participant_id = $1 AND test_type = $2::test_kind
           AND (
             processing_status <> 'uploading'
             OR created_at >= now() - interval '${UPLOADING_TTL_INTERVAL}'
           )
         ORDER BY session_number DESC LIMIT 1`,
        [participantId, testType]
      );
      const next = (q.rows[0]?.session_number ?? 0) + 1;
      res.json({ sessionNumber: next });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Erro ao calcular sessão." });
    }
  });

  const reserveSchema = z.object({
    participantId: z.string().uuid(),
    testType: TEST_TYPES,
    // sessionNumber é apenas dica do cliente; o servidor decide o valor final.
    sessionNumber: z.number().int().positive().nullish(),
    samplingHz: z.number().nullish().transform((v) => v ?? 60),
    performedAt: z.string().nullish(),
    participantName: z.string().nullish(),
    sex: z.string().nullish(),
    age: z.number().nullish(),
    fileExtension: z.string().nullish().transform((v) => v ?? "csv"),
    contentType: z.string().nullish().transform((v) => v ?? "text/csv"),
  });

  r.post("/reserve", async (req, res) => {
    const u = req.authUser as AuthedUser;
    const parsed = reserveSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    const b = parsed.data;
    const inst = isSuperAdmin(u) ? null : institutionIdOrThrow(u);
    if (!inst) {
      res.status(400).json({ error: "Coleta requer instituição do usuário." });
      return;
    }
    if (!(await assertParticipantInInstitution(b.participantId, inst))) {
      res.status(404).json({ error: "Participante não vinculado à instituição." });
      return;
    }

    const supervisorId =
      u.role === "AVALIADOR" ? await resolveSupervisorId(u.id, inst) : null;

    const ext = b.fileExtension.replace(/^\./, "");

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Serializa concorrência por (participant, test_type) para evitar
      // race conditions ao calcular o próximo session_number.
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
        `${b.participantId}|${b.testType}`,
      ]);

      // Limpa "buracos" deixados por uploads que nunca terminaram (linha
      // ficou em 'uploading' além do TTL). Sem isso, S1 órfã força a
      // próxima coleta a virar S2 mesmo sem arquivo no S3.
      await client.query(
        `DELETE FROM collections
         WHERE participant_id = $1
           AND test_type = $2::test_kind
           AND processing_status = 'uploading'
           AND created_at < now() - interval '${UPLOADING_TTL_INTERVAL}'`,
        [b.participantId, b.testType]
      );

      // Servidor decide o session_number (cliente pode mandar como dica,
      // mas o valor canônico vem daqui).
      const snRes = await client.query(
        `SELECT COALESCE(MAX(session_number), 0) + 1 AS next
         FROM collections
         WHERE participant_id = $1 AND test_type = $2::test_kind`,
        [b.participantId, b.testType]
      );
      const sessionNumber: number = snRes.rows[0].next;
      const key = buildRawKey(b.testType, b.participantId, sessionNumber, ext);

      const ins = await client.query(
        `INSERT INTO collections (
           participant_id, institution_id_at_collection, performed_by_user_id, supervisor_user_id,
           test_type, session_number, raw_s3_bucket, raw_s3_key, processing_status, platform,
           sampling_hz, performed_at, participant_name, sex, age
         ) VALUES ($1,$2,$3,$4,$5::test_kind,$6,$7,$8,'uploading','mobile',$9,$10,$11,$12,$13)
         RETURNING id, session_number, raw_s3_key`,
        [
          b.participantId,
          inst,
          u.id,
          supervisorId,
          b.testType,
          sessionNumber,
          cfg.S3_RAW_BUCKET,
          key,
          b.samplingHz,
          b.performedAt ? new Date(b.performedAt) : new Date(),
          b.participantName ?? null,
          b.sex ?? null,
          b.age ?? null,
        ]
      );
      const row = ins.rows[0];
      await client.query("COMMIT");

      const cmd = new PutObjectCommand({
        Bucket: cfg.S3_RAW_BUCKET,
        Key: key,
        ContentType: b.contentType,
      });
      const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 900 });

      res.status(201).json({
        collectionId: row.id,
        sessionNumber: row.session_number,
        rawS3Key: key,
        uploadUrl,
      });
    } catch (e) {
      await client.query("ROLLBACK");
      console.error(e);
      const msg = e instanceof Error ? e.message : "Erro";
      if (msg.includes("unique") || msg.includes("duplicate")) {
        res.status(409).json({ error: "Sessão já existe. Tente novamente." });
        return;
      }
      res.status(400).json({ error: msg });
    } finally {
      client.release();
    }
  });

  r.post("/:id/finalize-upload", async (req, res) => {
    const u = req.authUser as AuthedUser;
    const id = req.params.id;
    try {
      const q = await pool.query(`SELECT * FROM collections WHERE id = $1`, [id]);
      const row = q.rows[0];
      if (!row) {
        res.status(404).json({ error: "Coleta não encontrada." });
        return;
      }
      if (row.performed_by_user_id !== u.id && !isSuperAdmin(u)) {
        res.status(403).json({ error: "Sem permissão." });
        return;
      }
      await pool.query(
        `UPDATE collections SET processing_status = 'pending', processing_error = NULL, updated_at = now()
         WHERE id = $1`,
        [id]
      );
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Erro ao finalizar upload." });
    }
  });

  r.delete("/:id", async (req, res) => {
    const u = req.authUser as AuthedUser;
    const id = req.params.id;
    try {
      const q = await pool.query(
        `SELECT performed_by_user_id, processing_status FROM collections WHERE id = $1`,
        [id]
      );
      const row = q.rows[0];
      if (!row) {
        res.status(404).json({ error: "Não encontrado." });
        return;
      }
      if (row.performed_by_user_id !== u.id && !isSuperAdmin(u)) {
        res.status(403).json({ error: "Sem permissão." });
        return;
      }
      await pool.query(`DELETE FROM collections WHERE id = $1`, [id]);
      res.status(204).send();
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Erro ao excluir coleta." });
    }
  });

  r.post("/:id/mark-error", async (req, res) => {
    const u = req.authUser as AuthedUser;
    const id = req.params.id;
    const schema = z.object({ message: z.string().max(4000) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }
    try {
      const q = await pool.query(`SELECT performed_by_user_id FROM collections WHERE id = $1`, [id]);
      const row = q.rows[0];
      if (!row) {
        res.status(404).json({ error: "Não encontrado." });
        return;
      }
      if (row.performed_by_user_id !== u.id && !isSuperAdmin(u)) {
        res.status(403).json({ error: "Sem permissão." });
        return;
      }
      await pool.query(
        `UPDATE collections SET processing_status = 'error', processing_error = $2 WHERE id = $1`,
        [id, parsed.data.message.slice(0, 4000)]
      );
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Erro." });
    }
  });

  return r;
}
