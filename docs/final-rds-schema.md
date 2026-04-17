# Schema RDS final (novo modelo de roles)

Fonte canônica SQL: `API/app60-api/src/db/migrations/001_initial_aws_schema.sql`.

## Visão lógica

- **Instituição** (`institutions`): entidade organizacional; sem login. `created_by_super_admin_id` amarra criação ao papel `SUPER_ADMIN`.
- **Usuários** (`app_users`): um registro por pessoa com login; `cognito_sub` único; `role` enum `SUPER_ADMIN | ADMIN | GESTOR | SUPERVISOR | AVALIADOR`; `primary_institution_id` obrigatório exceto `SUPER_ADMIN`.
- **Supervisão** (`supervision_edges`): vínculo avaliador → supervisor por instituição, com vigência (`valid_from` / `valid_to`).
- **Participantes** (`participants`): globais por `cpf_normalized` único; sem credenciais.
- **Histórico institucional** (`participant_institution_history`): continuidade / transferência (`reason`: `ENROLL`, `TRANSFER`, etc.).
- **Políticas de continuidade** (`data_continuity_policies`): extensão futura para regras de negócio.
- **Coletas** (`collections`): substitui o conceito legado de `test_sessions`; status inclui `uploading`, `pending`, processamento worker → `done` / `error`.
- **Resultados** (`collection_results`): métricas JSON por `collection_id` (1:1).

## Tipos enum

- `app_role`, `participant_link_reason`, `test_kind` — ver migration.

## Autorização

- **Sem RLS** estilo Supabase: políticas de acesso são da **API** (Cognito JWT + regras por role) e, no worker, da **identidade IAM** + SQL direto.

## Compatibilidade PostgreSQL / RDS

Os triggers usam `EXECUTE PROCEDURE set_updated_at()`. Em versões recentes do PostgreSQL a forma preferida é `EXECUTE FUNCTION`; se o `CREATE TRIGGER` falhar na sua versão do RDS, ajuste para a sintaxe suportada pelo major da instância (consulte [documentação AWS RDS PostgreSQL](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_PostgreSQL.html)).

## Relação com o worker

O worker Python lê `collections` com `processing_status = 'pending'`, baixa `raw_s3_bucket` + `raw_s3_key` no S3 e grava `collection_results`, atualizando o status da coleta.
