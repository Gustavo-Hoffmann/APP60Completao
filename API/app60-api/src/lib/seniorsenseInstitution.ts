import type { Pool } from "pg";

export const SENIORSENSE_PLUS_SLUG = "seniorsense-plus";

export async function getSeniorSensePlusInstitutionId(pool: Pool): Promise<string> {
  const q = await pool.query<{ id: string }>(
    `SELECT id FROM institutions WHERE slug = $1 AND is_active = true LIMIT 1`,
    [SENIORSENSE_PLUS_SLUG]
  );
  const id = q.rows[0]?.id;
  if (!id) {
    throw new Error("Instituição SeniorSense+ não configurada.");
  }
  return id;
}
