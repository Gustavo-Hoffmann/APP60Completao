import { Router } from "express";
import { z } from "zod";
import { canCreateUsers } from "../lib/authz.js";
const KIND = z.enum(["TUTORIAL", "ARTIGO"]);
const createSchema = z.object({
    kind: KIND,
    acronym: z.string().min(1).max(32),
    title: z.string().min(2).max(300),
    url: z.string().min(4).max(800),
});
export function knowledgeBaseRouter(pool) {
    const r = Router();
    r.get("/", async (_req, res) => {
        try {
            const q = await pool.query(`SELECT id,
                kind::text AS kind,
                acronym,
                title,
                url,
                created_at
         FROM knowledge_base_items
         ORDER BY created_at DESC`);
            res.json(q.rows);
        }
        catch (e) {
            console.error(e);
            res.status(500).json({ error: "Erro ao listar base de conhecimento." });
        }
    });
    r.post("/", async (req, res) => {
        const u = req.authUser;
        if (!canCreateUsers(u)) {
            res.status(403).json({ error: "Sem permissão para adicionar itens." });
            return;
        }
        const parsed = createSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: parsed.error.flatten() });
            return;
        }
        const b = parsed.data;
        try {
            const ins = await pool.query(`INSERT INTO knowledge_base_items (kind, acronym, title, url, created_by_user_id)
         VALUES ($1::knowledge_base_kind, $2, $3, $4, $5)
         RETURNING id,
                   kind::text AS kind,
                   acronym,
                   title,
                   url,
                   created_at`, [b.kind, b.acronym.trim(), b.title.trim(), b.url.trim(), u.id]);
            res.status(201).json(ins.rows[0]);
        }
        catch (e) {
            console.error(e);
            res.status(500).json({ error: "Erro ao adicionar item." });
        }
    });
    return r;
}
