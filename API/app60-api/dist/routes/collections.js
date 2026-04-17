import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Router } from "express";
import { z } from "zod";
import { institutionIdOrThrow, isSuperAdmin } from "../lib/authz.js";
const TEST_TYPES = z.enum(["TUG", "MARCHA", "LOS", "SL30S", "UTT", "IVCF20"]);
function buildRawKey(testType, participantId, sessionNumber, ext) {
    return `raw/${testType}/${participantId}/S${sessionNumber}.${ext}`;
}
export function collectionsRouter(pool, cfg) {
    const r = Router();
    const s3 = new S3Client({ region: cfg.AWS_REGION });
    async function assertParticipantInInstitution(participantId, institutionId) {
        const q = await pool.query(`SELECT 1 FROM participant_institution_history
       WHERE participant_id = $1 AND institution_id = $2 AND valid_to IS NULL`, [participantId, institutionId]);
        return !!q.rows[0];
    }
    async function resolveSupervisorId(evaluatorId, institutionId) {
        const q = await pool.query(`SELECT supervisor_user_id FROM supervision_edges
       WHERE evaluator_user_id = $1 AND institution_id = $2 AND valid_to IS NULL
       ORDER BY valid_from DESC LIMIT 1`, [evaluatorId, institutionId]);
        return q.rows[0]?.supervisor_user_id ?? null;
    }
    r.get("/next-session/:participantId/:testType", async (req, res) => {
        const u = req.authUser;
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
            const q = await pool.query(`SELECT session_number FROM collections
         WHERE participant_id = $1 AND test_type = $2::test_kind
         ORDER BY session_number DESC LIMIT 1`, [participantId, testType]);
            const next = (q.rows[0]?.session_number ?? 0) + 1;
            res.json({ sessionNumber: next });
        }
        catch (e) {
            console.error(e);
            res.status(500).json({ error: "Erro ao calcular sessão." });
        }
    });
    const reserveSchema = z.object({
        participantId: z.string().uuid(),
        testType: TEST_TYPES,
        sessionNumber: z.number().int().positive(),
        samplingHz: z.number().optional().default(60),
        performedAt: z.string().optional(),
        participantName: z.string().optional(),
        sex: z.string().optional(),
        age: z.number().optional(),
        fileExtension: z.string().optional().default("csv"),
        contentType: z.string().optional().default("text/csv"),
    });
    r.post("/reserve", async (req, res) => {
        const u = req.authUser;
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
        const supervisorId = u.role === "AVALIADOR" ? await resolveSupervisorId(u.id, inst) : null;
        const ext = b.fileExtension.replace(/^\./, "");
        const key = buildRawKey(b.testType, b.participantId, b.sessionNumber, ext);
        const client = await pool.connect();
        try {
            await client.query("BEGIN");
            const ins = await client.query(`INSERT INTO collections (
           participant_id, institution_id_at_collection, performed_by_user_id, supervisor_user_id,
           test_type, session_number, raw_s3_bucket, raw_s3_key, processing_status, platform,
           sampling_hz, performed_at, participant_name, sex, age
         ) VALUES ($1,$2,$3,$4,$5::test_kind,$6,$7,$8,'uploading','mobile',$9,$10,$11,$12,$13)
         RETURNING id, session_number, raw_s3_key`, [
                b.participantId,
                inst,
                u.id,
                supervisorId,
                b.testType,
                b.sessionNumber,
                cfg.S3_RAW_BUCKET,
                key,
                b.samplingHz,
                b.performedAt ? new Date(b.performedAt) : new Date(),
                b.participantName ?? null,
                b.sex ?? null,
                b.age ?? null,
            ]);
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
        }
        catch (e) {
            await client.query("ROLLBACK");
            console.error(e);
            const msg = e instanceof Error ? e.message : "Erro";
            if (msg.includes("unique") || msg.includes("duplicate")) {
                res.status(409).json({ error: "Sessão já existe. Recalcule sessionNumber." });
                return;
            }
            res.status(400).json({ error: msg });
        }
        finally {
            client.release();
        }
    });
    r.post("/:id/finalize-upload", async (req, res) => {
        const u = req.authUser;
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
            await pool.query(`UPDATE collections SET processing_status = 'pending', processing_error = NULL, updated_at = now()
         WHERE id = $1`, [id]);
            res.json({ ok: true });
        }
        catch (e) {
            console.error(e);
            res.status(500).json({ error: "Erro ao finalizar upload." });
        }
    });
    r.delete("/:id", async (req, res) => {
        const u = req.authUser;
        const id = req.params.id;
        try {
            const q = await pool.query(`SELECT performed_by_user_id, processing_status FROM collections WHERE id = $1`, [id]);
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
        }
        catch (e) {
            console.error(e);
            res.status(500).json({ error: "Erro ao excluir coleta." });
        }
    });
    r.post("/:id/mark-error", async (req, res) => {
        const u = req.authUser;
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
            await pool.query(`UPDATE collections SET processing_status = 'error', processing_error = $2 WHERE id = $1`, [id, parsed.data.message.slice(0, 4000)]);
            res.json({ ok: true });
        }
        catch (e) {
            console.error(e);
            res.status(500).json({ error: "Erro." });
        }
    });
    return r;
}
