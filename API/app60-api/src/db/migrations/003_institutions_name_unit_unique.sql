CREATE UNIQUE INDEX IF NOT EXISTS institutions_name_unit_unique_idx
ON institutions (
  lower(btrim(name)),
  lower(btrim(COALESCE(unit, '')))
);
