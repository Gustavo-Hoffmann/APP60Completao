# Inventário completo de dependências Supabase

> **Estado (Fase 3):** registo **histórico** da Fase 1. Os caminhos citados (ex.: `API/supabase-backend/`, clientes Supabase em app/web) foram **removidos ou substituídos**. Estado atual: `docs/supabase-eradication-checklist.md`, `docs/aws-only-validation-checklist.md`.

## Resumo executivo

Este documento listava **onde** o Supabase aparecia no monorepo **antes do hard cut** (clientes, auth, queries, storage, functions, envs, SQL). **Não há uso de Realtime** (`channel` / subscriptions) no código aplicacional pesquisado. **Uma única Edge Function** (`create-user`) é invocada pelo web. O worker Python usa a **service role**, contornando RLS.

Para o modelo de roles e RLS atuais, ver também `docs/current-role-model-audit.md`.

---

## A. Onde o cliente Supabase é inicializado

| Aplicação | Arquivo | Configuração |
|-----------|---------|--------------|
| Web (Vite) | `app60web/src/lib/supabase/client.ts` | `import.meta.env.VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — falha se ausentes |
| Mobile (Expo) | `app60/src/services/supabase/client.ts` | `Constants.expoConfig?.extra` → `supabaseUrl`, `supabaseAnonKey` (hoje em `app60/app.json` > `expo.extra`) |
| Edge Function | `API/supabase-backend/supabase/functions/create-user/index.ts` | `createClient` com anon + JWT do chamador e com service role |
| Worker | `Worker/worker.py` | `create_client(SUPABASE_URL, SUPABASE_SERVER_KEY)` |

---

## B. Supabase Auth — uso

### Web

- `app60web/src/contexts/AuthContext.tsx` — `getSession`, `onAuthStateChange`, `signInWithPassword`, `signOut`; após sessão, carrega `profiles`.
- `app60web/src/features/users/pages/UserEditPage.tsx` — `supabase.auth.updateUser({ password })` para o próprio usuário.

### Mobile

- `app60/src/services/authLocal.ts` — `getSession`, `getUser`, `signInWithPassword`, `signOut`, `updateUser` (email/senha), leitura de `profiles`.

### Edge Function

- `API/supabase-backend/supabase/functions/create-user/index.ts` — `supabaseUserClient.auth.getUser()`; `supabaseAdmin.auth.admin.createUser`; rollback com `auth.admin.deleteUser`.

---

## C. Queries ao banco (PostgREST via SDK)

### Tabela `profiles`

| Arquivo | Operação |
|---------|----------|
| `app60web/src/contexts/AuthContext.tsx` | SELECT por `id` |
| `app60web/src/features/users/pages/UsersPage.tsx` | SELECT ativos; UPDATE `is_active` |
| `app60web/src/features/users/pages/UserCreatePage.tsx` | SELECT professores (admin) |
| `app60web/src/features/users/pages/UserEditPage.tsx` | SELECT perfil alvo + professores; UPDATE perfil |
| `app60web/src/features/participants/pages/ParticipantDetailPage.tsx` | SELECT `id, name` para IDs relacionados |
| `app60/src/services/authLocal.ts` | SELECT próprio; UPDATE campos de perfil |
| `app60/src/services/participants.ts` | SELECT `id, role, professor_id` do usuário logado |

**Nota (deriva de schema):** `UserEditPage.tsx` seleciona `country` em `profiles`; **não há** coluna `country` nas migrations SQL em `API/supabase-backend/supabase/migrations/` — indica evolução só no banco remoto ou migration não commitada.

### Tabela `participants`

| Arquivo | Operação |
|---------|----------|
| `app60web/src/features/participants/services/participants.ts` | SELECT listagem e por id |
| `app60/src/services/participants.ts` | SELECT, UPSERT, DELETE |

### Tabela `test_session_results`

| Arquivo | Operação |
|---------|----------|
| `app60web/src/features/participants/services/participants.ts` | SELECT agregando resultados para UI |

**Nota:** tabela **não** criada nas migrations versionadas do repo (ver secção G).

### Tabela `test_sessions`

| Arquivo | Operação |
|---------|----------|
| `app60/src/services/tests/uploadTestJson.ts` | SELECT `session_number`; INSERT com `processing_status`, `raw_bucket`, etc.; UPDATE; DELETE em rollback |

### Worker (`Worker/worker.py`)

- `participants` — SELECT metadados do sujeito.
- `test_sessions` — SELECT pendentes, UPDATE `processing_status` / erros.
- `test_session_results` — UPSERT em `upsert_result`.

---

## D. Storage Supabase

- **Bucket constante no mobile:** `test-data` — `app60/src/services/tests/uploadTestJson.ts` (`const BUCKET = "test-data"`).
- **Operações:** `upload`, `remove` no mobile; `download` no worker (`download_raw_file`); bucket por linha `raw_bucket` ou `DEFAULT_BUCKET` (`Worker/worker.py`).

### Policies no SQL versionado

- `API/supabase-backend/supabase/migrations/20260317_create_test_sessions.sql` cria bucket `test-data` e policies SELECT/INSERT/UPDATE para `authenticated`. **DELETE** não aparece nesta migration — comportamento de `remove()` no cliente depende de policies reais no projeto Supabase.

---

## E. Realtime

- **Não encontrado** uso de `supabase.channel`, Realtime ou subscriptions em `*.ts`, `*.tsx`, `*.py` (busca por `.channel`, `realtime`, `rpc` limitada a invocação de functions).

---

## F. RPC, Edge Functions, funções SQL

### Edge Functions (repo)

- Única função presente: `create-user` — `app60web/src/features/users/pages/UserCreatePage.tsx` chama `supabase.functions.invoke("create-user", ...)`.

### Funções SQL (migrations)

- `public.set_updated_at()` + triggers em `profiles` e `participants` — `202603131000_init_auth.sql`.
- Helpers RLS: `my_role`, `my_professor_id`, `is_admin`, `is_professor`, `is_aluno` — `202603131005_rls.sql`; ajuste `SECURITY DEFINER` — `202603161700_fix_rls_recursion.sql`.

---

## G. Migrations SQL no repositório

Diretório: `API/supabase-backend/supabase/migrations/`

1. `202603131000_init_auth.sql` — enum `user_role` (`ADMIN`, `PROFESSOR`, `ALUNO`), `profiles`, `participants`, FK para `auth.users`, triggers.
2. `202603131005_rls.sql` — RLS e policies.
3. `202603161700_fix_rls_recursion.sql` — correção recursão nas funções helper.
4. `202603171230_add_profile_fields.sql` — CPF, phone, institution, city, state, birth_date em `profiles`.
5. `202603171500_add_participant_fields.sql` — endereço + CPF em `participants`.
6. `20260317_create_test_sessions.sql` — enum `test_kind` (**sem** `IVCF20` na definição versionada), `test_sessions`, bucket storage, RLS permissivo em `test_sessions`.

### Estruturas referenciadas no código mas ausentes ou divergentes nas migrations commitadas

| Item | Onde aparece | Migration no repo |
|------|----------------|-------------------|
| Tabela `test_session_results` | `Worker/worker.py`, `app60web/.../participants.ts` | Ausente |
| Colunas `processing_status`, `processing_error`, `raw_bucket`, `participant_name`, `sex`, `age` em `test_sessions` | `uploadTestJson.ts`, `worker.py` | Ausentes em `20260317_create_test_sessions.sql` |
| Valor enum / tipo `IVCF20` | `uploadTestJson.ts`, `worker.py` | `test_kind` não inclui `IVCF20` na migration |
| Coluna `profiles.country` | `UserEditPage.tsx` | Ausente nas migrations listadas |

**Conclusão cética:** o ambiente Supabase em uso provavelmente contém DDL **além** do que está no Git; confiar apenas no repo para reconstruir banco **não** reproduz o sistema em execução.

---

## H. Variáveis de ambiente e segredos (nomes)

| Contexto | Variáveis |
|----------|-----------|
| Web (Vite) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| Mobile | Embutido em `app60/app.json` (`supabaseUrl`, `supabaseAnonKey`) |
| Worker | `SUPABASE_URL`, `SUPABASE_SERVER_KEY`, opcionais `POLL_SECONDS`, `DEFAULT_BUCKET`, `ENABLED_TEST_TYPES`, mapeamento de colunas de participante |
| Edge Function | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SERVICE_ROLE_KEY` (nome no código) |
| Exemplo backend | `API/supabase-backend/.env.example` — contém placeholders de projeto real (risco se versionado) |

---

## I. RLS, policies, triggers (implicação para AWS)

- **`profiles` / `participants`:** matriz admin / professor / aluno documentada em `docs/current-role-model-audit.md`.
- **`test_sessions` (repo):** policies permitem qualquer `authenticated` ler/inserir/atualizar — não espelha ownership por participante.
- Na AWS com **RDS**, o equivalente será: **RLS com claims** (se `SET LOCAL` / JWT customizado) ou **autorização só na API** (padrão comum quando o cliente não acessa SQL diretamente).

---

## J. Dependências em `package.json` / `requirements.txt`

- `app60/package.json` — `@supabase/supabase-js`.
- `app60web/package.json` — `@supabase/supabase-js`.
- `Worker/requirements.txt` — `supabase==2.15.3`.

---

## K. Arquivos com string `supabase` fora de dependências lockfile (referência rápida)

- `API/supabase-backend/README.md`, `API/supabase-backend/docs/architecture.md`
- `API/supabase-backend/supabase/config.toml`
- `Worker/marcha_runtime.py` (comentário)
- Documentação em `docs/aws-migration-audit.md`, `docs/target-architecture-overview.md`

---

## L. Mapa funcional × Supabase

| Funcionalidade | Depende de Supabase? | Observação |
|----------------|----------------------|------------|
| Login web/mobile | Sim | Auth |
| Lista / detalhe participantes web | Sim | `participants` + `test_session_results` |
| CRUD participantes mobile | Sim | `participants` + RLS |
| Upload de testes + fila | Sim | `test_sessions` + Storage |
| Processamento assíncrono | Sim | Worker + DB + Storage |
| Criação de usuário (web) | Sim | Edge Function + Auth admin |
| Dashboard | Não (mock) | Evidência em auditoria prévia |
