-- Knowledge base items (tutorials and scientific articles)

CREATE TYPE knowledge_base_kind AS ENUM ('TUTORIAL', 'ARTIGO');

CREATE TABLE knowledge_base_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind knowledge_base_kind NOT NULL,
  acronym text NOT NULL,
  title text NOT NULL,
  url text NOT NULL,
  created_by_user_id uuid REFERENCES app_users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX knowledge_base_items_kind_idx ON knowledge_base_items (kind, created_at DESC);
CREATE INDEX knowledge_base_items_created_at_idx ON knowledge_base_items (created_at DESC);

