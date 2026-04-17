-- Migração incremental: rastrear migrations e expandir institutions

CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE institutions
  ADD COLUMN IF NOT EXISTS acronym text,
  ADD COLUMN IF NOT EXISTS unit text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS state_or_county text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS street text,
  ADD COLUMN IF NOT EXISTS neighborhood text,
  ADD COLUMN IF NOT EXISTS street_number text,
  ADD COLUMN IF NOT EXISTS complement text;

-- Backfill básico para instalações já existentes
UPDATE institutions
SET acronym = COALESCE(acronym, slug, left(name, 10)),
    country = COALESCE(country, 'BR'),
    city = COALESCE(city, '')
WHERE acronym IS NULL OR country IS NULL OR city IS NULL;

ALTER TABLE institutions
  ALTER COLUMN acronym SET NOT NULL;

ALTER TABLE institutions
  ALTER COLUMN country SET NOT NULL;

ALTER TABLE institutions
  ALTER COLUMN city SET NOT NULL;

