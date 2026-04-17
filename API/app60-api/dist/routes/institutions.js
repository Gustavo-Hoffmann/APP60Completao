import { Router } from "express";
import { z } from "zod";
import { canManageInstitutions } from "../lib/authz.js";
export function institutionsRouter(pool) {
    const r = Router();
    const duplicateInstitutionMessage = "Já existe uma instituição cadastrada com este nome e unidade.";
    function isInstitutionNameUnitConflict(error) {
        return ((error instanceof Error && error.message === duplicateInstitutionMessage) ||
            (typeof error === "object" &&
                error !== null &&
                "code" in error &&
                error.code === "23505"));
    }
    async function assertUniqueInstitutionNameUnit(name, unit, excludeId) {
        const normalizedName = name.trim();
        const normalizedUnit = unit?.trim() || "";
        const params = [normalizedName, normalizedUnit];
        const excludeClause = excludeId ? `AND id <> $3` : "";
        if (excludeId)
            params.push(excludeId);
        const existing = await pool.query(`SELECT id
       FROM institutions
       WHERE lower(btrim(name)) = lower(btrim($1))
         AND lower(btrim(COALESCE(unit, ''))) = lower(btrim($2))
         ${excludeClause}
       LIMIT 1`, params);
        if (existing.rows[0]) {
            throw new Error(duplicateInstitutionMessage);
        }
    }
    r.get("/", async (req, res) => {
        const u = req.authUser;
        try {
            if (canManageInstitutions(u)) {
                const q = await pool.query(`SELECT id, name, slug, acronym, unit, country, state_or_county, city,
                  postal_code, street, neighborhood, street_number, complement,
                  is_active, created_at, updated_at
           FROM institutions
           WHERE is_active = true
           ORDER BY name`);
                res.json(q.rows);
                return;
            }
            if (u.primary_institution_id) {
                const q = await pool.query(`SELECT id, name, slug, acronym, unit, country, state_or_county, city,
                  postal_code, street, neighborhood, street_number, complement,
                  is_active, created_at, updated_at
           FROM institutions WHERE id = $1`, [u.primary_institution_id]);
                res.json(q.rows);
                return;
            }
            res.json([]);
        }
        catch (e) {
            console.error(e);
            res.status(500).json({ error: "Erro ao listar instituições." });
        }
    });
    r.post("/", async (req, res) => {
        const u = req.authUser;
        if (!canManageInstitutions(u)) {
            res.status(403).json({ error: "Sem permissão para criar instituições." });
            return;
        }
        const schema = z.object({
            name: z.string().min(2),
            slug: z.string().optional(),
            acronym: z.string().min(1),
            unit: z.string().optional().nullable(),
            country: z.string().min(2).max(3),
            state_or_county: z.string().optional().nullable(),
            city: z.string().min(1),
            postal_code: z.string().optional().nullable(),
            street: z.string().optional().nullable(),
            neighborhood: z.string().optional().nullable(),
            street_number: z.string().optional().nullable(),
            complement: z.string().optional().nullable(),
        });
        const parsed = schema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: parsed.error.flatten() });
            return;
        }
        try {
            await assertUniqueInstitutionNameUnit(parsed.data.name, parsed.data.unit);
            const ins = await pool.query(`INSERT INTO institutions (
           name, slug, acronym, unit, country, state_or_county, city,
           postal_code, street, neighborhood, street_number, complement,
           created_by_super_admin_id
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING id, name, slug, acronym, unit, country, state_or_county, city,
                   postal_code, street, neighborhood, street_number, complement,
                   is_active, created_at, updated_at`, [
                parsed.data.name.trim(),
                parsed.data.slug?.trim() || null,
                parsed.data.acronym.trim(),
                parsed.data.unit?.trim() || null,
                parsed.data.country.trim().toUpperCase(),
                parsed.data.state_or_county?.trim() || null,
                parsed.data.city.trim(),
                parsed.data.postal_code?.trim() || null,
                parsed.data.street?.trim() || null,
                parsed.data.neighborhood?.trim() || null,
                parsed.data.street_number?.trim() || null,
                parsed.data.complement?.trim() || null,
                u.id,
            ]);
            res.status(201).json(ins.rows[0]);
        }
        catch (e) {
            if (isInstitutionNameUnitConflict(e)) {
                res.status(409).json({ error: duplicateInstitutionMessage });
                return;
            }
            console.error(e);
            res.status(500).json({ error: "Erro ao criar instituição." });
        }
    });
    r.patch("/:id", async (req, res) => {
        const u = req.authUser;
        if (!canManageInstitutions(u)) {
            res.status(403).json({ error: "Sem permissão para editar instituições." });
            return;
        }
        const id = req.params.id;
        const schema = z.object({
            name: z.string().min(2).optional(),
            slug: z.string().optional().nullable(),
            acronym: z.string().min(1).optional(),
            unit: z.string().optional().nullable(),
            country: z.string().min(2).max(3).optional(),
            state_or_county: z.string().optional().nullable(),
            city: z.string().min(1).optional(),
            postal_code: z.string().optional().nullable(),
            street: z.string().optional().nullable(),
            neighborhood: z.string().optional().nullable(),
            street_number: z.string().optional().nullable(),
            complement: z.string().optional().nullable(),
            is_active: z.boolean().optional(),
        });
        const parsed = schema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: parsed.error.flatten() });
            return;
        }
        const b = parsed.data;
        const updates = [];
        const vals = [];
        let i = 1;
        if (b.name !== undefined) {
            updates.push(`name = $${i++}`);
            vals.push(b.name.trim());
        }
        if (b.slug !== undefined) {
            updates.push(`slug = $${i++}`);
            vals.push(b.slug ? b.slug.trim() : null);
        }
        if (b.acronym !== undefined) {
            updates.push(`acronym = $${i++}`);
            vals.push(b.acronym.trim());
        }
        if (b.unit !== undefined) {
            updates.push(`unit = $${i++}`);
            vals.push(b.unit ? b.unit.trim() : null);
        }
        if (b.country !== undefined) {
            updates.push(`country = $${i++}`);
            vals.push(b.country.trim().toUpperCase());
        }
        if (b.state_or_county !== undefined) {
            updates.push(`state_or_county = $${i++}`);
            vals.push(b.state_or_county ? b.state_or_county.trim() : null);
        }
        if (b.city !== undefined) {
            updates.push(`city = $${i++}`);
            vals.push(b.city.trim());
        }
        if (b.postal_code !== undefined) {
            updates.push(`postal_code = $${i++}`);
            vals.push(b.postal_code ? b.postal_code.trim() : null);
        }
        if (b.street !== undefined) {
            updates.push(`street = $${i++}`);
            vals.push(b.street ? b.street.trim() : null);
        }
        if (b.neighborhood !== undefined) {
            updates.push(`neighborhood = $${i++}`);
            vals.push(b.neighborhood ? b.neighborhood.trim() : null);
        }
        if (b.street_number !== undefined) {
            updates.push(`street_number = $${i++}`);
            vals.push(b.street_number ? b.street_number.trim() : null);
        }
        if (b.complement !== undefined) {
            updates.push(`complement = $${i++}`);
            vals.push(b.complement ? b.complement.trim() : null);
        }
        if (b.is_active !== undefined) {
            updates.push(`is_active = $${i++}`);
            vals.push(b.is_active);
        }
        if (!updates.length) {
            res.json({ ok: true });
            return;
        }
        vals.push(id);
        try {
            const currentResult = await pool.query(`SELECT id, name, unit
         FROM institutions
         WHERE id = $1`, [id]);
            const current = currentResult.rows[0];
            if (!current) {
                res.status(404).json({ error: "Instituição não encontrada." });
                return;
            }
            await assertUniqueInstitutionNameUnit(b.name ?? current.name, b.unit ?? current.unit, id);
            await pool.query(`UPDATE institutions SET ${updates.join(", ")} WHERE id = $${i}`, vals);
            const out = await pool.query(`SELECT id, name, slug, acronym, unit, country, state_or_county, city,
                postal_code, street, neighborhood, street_number, complement,
                is_active, created_at, updated_at
         FROM institutions WHERE id = $1`, [id]);
            res.json(out.rows[0]);
        }
        catch (e) {
            if (isInstitutionNameUnitConflict(e)) {
                res.status(409).json({ error: duplicateInstitutionMessage });
                return;
            }
            console.error(e);
            res.status(500).json({ error: "Erro ao atualizar instituição." });
        }
    });
    r.delete("/:id", async (req, res) => {
        const u = req.authUser;
        if (!canManageInstitutions(u)) {
            res.status(403).json({ error: "Sem permissão para excluir instituições." });
            return;
        }
        const id = req.params.id;
        try {
            const existing = await pool.query(`SELECT id
         FROM institutions
         WHERE id = $1`, [id]);
            if (!existing.rows[0]) {
                res.status(404).json({ error: "Instituição não encontrada." });
                return;
            }
            const links = await pool.query(`SELECT
           (SELECT COUNT(*)::int FROM app_users WHERE primary_institution_id = $1) AS users_count,
           (SELECT COUNT(*)::int FROM collections WHERE institution_id_at_collection = $1) AS collections_count,
           (SELECT COUNT(*)::int FROM participant_institution_history WHERE institution_id = $1) AS participant_links_count,
           (SELECT COUNT(*)::int FROM data_continuity_policies WHERE institution_id = $1) AS policies_count,
           (SELECT COUNT(*)::int FROM supervision_edges WHERE institution_id = $1) AS supervision_count`, [id]);
            const counts = links.rows[0];
            const blockers = [
                counts.users_count ? `${counts.users_count} usuário(s) vinculado(s)` : null,
                counts.collections_count ? `${counts.collections_count} coleta(s)` : null,
                counts.participant_links_count
                    ? `${counts.participant_links_count} vínculo(s) de participante`
                    : null,
                counts.policies_count ? `${counts.policies_count} política(s)` : null,
                counts.supervision_count ? `${counts.supervision_count} vínculo(s) de supervisão` : null,
            ].filter(Boolean);
            if (blockers.length) {
                res.status(409).json({
                    error: `Não é possível excluir esta instituição porque ela possui ${blockers.join(", ")}.`,
                });
                return;
            }
            await pool.query(`DELETE FROM institutions WHERE id = $1`, [id]);
            res.json({ ok: true });
        }
        catch (e) {
            console.error(e);
            res.status(500).json({ error: "Erro ao excluir instituição." });
        }
    });
    r.get("/stats/collections-by-institution", async (req, res) => {
        const u = req.authUser;
        if (!canManageInstitutions(u)) {
            res.status(403).json({ error: "Sem permissão." });
            return;
        }
        try {
            const q = await pool.query(`SELECT i.id,
                i.acronym,
                i.country,
                COUNT(c.id)::int AS collections_count
         FROM institutions i
         LEFT JOIN collections c ON c.institution_id_at_collection = i.id
         WHERE i.is_active = true
         GROUP BY i.id, i.acronym, i.country
         ORDER BY i.country ASC, collections_count DESC, i.acronym ASC`);
            res.json(q.rows);
        }
        catch (e) {
            console.error(e);
            res.status(500).json({ error: "Erro ao carregar estatísticas." });
        }
    });
    return r;
}
