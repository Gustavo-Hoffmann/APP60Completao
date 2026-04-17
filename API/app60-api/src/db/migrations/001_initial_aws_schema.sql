-- Schema APP60 — RDS PostgreSQL (AWS-only, novo modelo de roles)
-- Executar em banco zerado. Autorização fina na API; sem RLS Supabase.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE app_role AS ENUM (
  'SUPER_ADMIN',
  'ADMIN',
  'GESTOR',
  'SUPERVISOR',
  'AVALIADOR'
);

CREATE TYPE participant_link_reason AS ENUM (
  'ENROLL',
  'TRANSFER',
  'DISCHARGE',
  'ADJUSTMENT'
);

CREATE TYPE test_kind AS ENUM (
  'TUG',
  'MARCHA',
  'LOS',
  'SL30S',
  'UTT',
  'IVCF20'
);

CREATE TABLE institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_super_admin_id uuid
);

CREATE TABLE app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cognito_sub text NOT NULL UNIQUE,
  email text NOT NULL,
  full_name text NOT NULL,
  role app_role NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  -- Instituição principal; NULL apenas para SUPER_ADMIN
  primary_institution_id uuid REFERENCES institutions (id) ON DELETE SET NULL,
  cpf_normalized text,
  phone text,
  country text,
  city text,
  state text,
  birth_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_id uuid REFERENCES app_users (id) ON DELETE SET NULL,
  CONSTRAINT super_admin_no_inst CHECK (
    (role = 'SUPER_ADMIN' AND primary_institution_id IS NULL)
    OR role <> 'SUPER_ADMIN'
  ),
  CONSTRAINT non_super_requires_inst CHECK (
    (role <> 'SUPER_ADMIN' AND primary_institution_id IS NOT NULL)
    OR role = 'SUPER_ADMIN'
  )
);

ALTER TABLE institutions
  ADD CONSTRAINT institutions_created_by_fk
  FOREIGN KEY (created_by_super_admin_id) REFERENCES app_users (id) ON DELETE SET NULL;

CREATE INDEX app_users_email_idx ON app_users (lower(email));
CREATE INDEX app_users_institution_idx ON app_users (primary_institution_id);
CREATE INDEX app_users_role_idx ON app_users (role);

CREATE TABLE supervision_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions (id) ON DELETE CASCADE,
  supervisor_user_id uuid NOT NULL REFERENCES app_users (id) ON DELETE CASCADE,
  evaluator_user_id uuid NOT NULL REFERENCES app_users (id) ON DELETE CASCADE,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, supervisor_user_id, evaluator_user_id, valid_from)
);

CREATE INDEX supervision_supervisor_idx ON supervision_edges (supervisor_user_id) WHERE valid_to IS NULL;
CREATE INDEX supervision_evaluator_idx ON supervision_edges (evaluator_user_id) WHERE valid_to IS NULL;

CREATE TABLE participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cpf_normalized char(11) NOT NULL UNIQUE,
  full_name text NOT NULL,
  birth_date date,
  sex text,
  notes text,
  cep text,
  street text,
  number text,
  neighborhood text,
  city text,
  state text,
  complement text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE participant_institution_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES participants (id) ON DELETE CASCADE,
  institution_id uuid NOT NULL REFERENCES institutions (id) ON DELETE CASCADE,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to timestamptz,
  reason participant_link_reason NOT NULL DEFAULT 'ENROLL',
  requested_by_user_id uuid REFERENCES app_users (id) ON DELETE SET NULL,
  approved_by_user_id uuid REFERENCES app_users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX pih_participant_open_idx ON participant_institution_history (participant_id)
  WHERE valid_to IS NULL;
CREATE INDEX pih_institution_open_idx ON participant_institution_history (institution_id)
  WHERE valid_to IS NULL;

CREATE TABLE data_continuity_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid REFERENCES institutions (id) ON DELETE CASCADE,
  policy_key text NOT NULL,
  rules jsonb NOT NULL DEFAULT '{}',
  effective_from timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES app_users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, policy_key, effective_from)
);

CREATE TABLE collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES participants (id) ON DELETE CASCADE,
  institution_id_at_collection uuid NOT NULL REFERENCES institutions (id) ON DELETE RESTRICT,
  performed_by_user_id uuid NOT NULL REFERENCES app_users (id) ON DELETE RESTRICT,
  supervisor_user_id uuid REFERENCES app_users (id) ON DELETE SET NULL,
  test_type test_kind NOT NULL,
  session_number integer NOT NULL,
  raw_s3_bucket text NOT NULL,
  raw_s3_key text NOT NULL,
  processing_status text NOT NULL DEFAULT 'pending',
  processing_error text,
  platform text NOT NULL DEFAULT '',
  sampling_hz integer NOT NULL DEFAULT 60,
  performed_at timestamptz,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  participant_name text,
  sex text,
  age integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (participant_id, test_type, session_number)
);

CREATE INDEX collections_participant_idx ON collections (participant_id);
CREATE INDEX collections_institution_idx ON collections (institution_id_at_collection);
CREATE INDEX collections_processing_idx ON collections (processing_status)
  WHERE processing_status IN ('pending', 'uploading');

CREATE TABLE collection_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL UNIQUE REFERENCES collections (id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES participants (id) ON DELETE CASCADE,
  test_type test_kind NOT NULL,
  session_number integer NOT NULL,
  metrics_json jsonb NOT NULL DEFAULT '{}',
  plot_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX collection_results_participant_idx ON collection_results (participant_id);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER institutions_updated_at
BEFORE UPDATE ON institutions
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE TRIGGER app_users_updated_at
BEFORE UPDATE ON app_users
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE TRIGGER participants_updated_at
BEFORE UPDATE ON participants
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE TRIGGER collections_updated_at
BEFORE UPDATE ON collections
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE TRIGGER collection_results_updated_at
BEFORE UPDATE ON collection_results
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
