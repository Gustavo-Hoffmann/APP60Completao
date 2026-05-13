-- ADMIN sem instituição (como SUPER_ADMIN) e instituição padrão SeniorSense+.

UPDATE app_users
SET primary_institution_id = NULL
WHERE role = 'ADMIN';

ALTER TABLE app_users
  DROP CONSTRAINT IF EXISTS super_admin_no_inst;

ALTER TABLE app_users
  DROP CONSTRAINT IF EXISTS non_super_requires_inst;

ALTER TABLE app_users
  ADD CONSTRAINT platform_staff_no_inst CHECK (
    (role IN ('SUPER_ADMIN', 'ADMIN') AND primary_institution_id IS NULL)
    OR role NOT IN ('SUPER_ADMIN', 'ADMIN')
  );

ALTER TABLE app_users
  ADD CONSTRAINT institution_staff_requires_inst CHECK (
    (role NOT IN ('SUPER_ADMIN', 'ADMIN') AND primary_institution_id IS NOT NULL)
    OR role IN ('SUPER_ADMIN', 'ADMIN')
  );

INSERT INTO institutions (
  name,
  slug,
  acronym,
  country,
  city,
  is_active
)
VALUES (
  'SeniorSense+',
  'seniorsense-plus',
  'SS+',
  'BR',
  'Curitiba',
  true
)
ON CONFLICT (slug) DO NOTHING;
