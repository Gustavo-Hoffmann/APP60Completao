-- Add ACT_SEDENTARY as a supported collection test kind
-- Safe to run multiple times (idempotent)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'test_kind' AND e.enumlabel = 'ACT_SEDENTARY'
  ) THEN
    ALTER TYPE test_kind ADD VALUE 'ACT_SEDENTARY';
  END IF;
END $$;

