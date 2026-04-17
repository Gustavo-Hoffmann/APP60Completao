# Log de remoção do Supabase (Fase 2 — hard cut)

Registro do que foi **eliminado do caminho de execução** e do que permanece apenas como **arquivo histórico** no repositório.

## Dependências removidas ou substituídas

| Área | Antes | Depois |
|------|--------|--------|
| Mobile `app60` | `@supabase/supabase-js` | Removido do `package.json`; auth Cognito + HTTP à API. |
| Web `app60web` | Cliente Supabase | Cognito + `src/lib/api/client.ts` (já aplicado nesta migração). |
| Worker | `supabase` Python | `psycopg` + `boto3` (`Worker/requirements.txt`). |
| API runtime | PostgREST / Edge Functions | `API/app60-api` Express + `pg` + JWT Cognito. |

## Arquivos removidos (código ativo)

- `app60/src/services/supabase/client.ts` — **removido**.
- `app60web/src/lib/supabase/client.ts` — removido em trabalho anterior da Fase 2.

## Configuração limpa

- `app60/app.json` — removidos `supabaseUrl` e `supabaseAnonKey`; adicionados placeholders `apiBaseUrl`, `cognitoRegion`, `cognitoUserPoolId`, `cognitoClientId`.
- `app60web/.env` — substituído de variáveis `VITE_SUPABASE_*` por modelo AWS-only (placeholders); não versionar segredos reais.

## Diretório legado (não usado no deploy AWS-only)

- `API/supabase-backend/` — **removido na Fase 3** (limpeza final); histórico permanece apenas no Git antigo se necessário.
- `app60web/supabase/` (artefatos de CLI) — **removido na Fase 3**.

## Comportamento intencionalmente desativado

- **Cadastro self-service no app móvel** (`registerResearcher`): lança erro orientando criação de usuários pelo web/admin — compatível com Cognito gerido por administrador.

## Documentação nova relacionada

- `docs/env-mapping-aws-only.md`
- `docs/deployment-envs.md`
- `docs/final-rds-schema.md`
- `docs/db-bootstrap-plan.md`
- `docs/s3-storage-plan.md`
