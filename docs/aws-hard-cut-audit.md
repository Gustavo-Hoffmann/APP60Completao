# Auditoria: corte seco Supabase → AWS (sem migração de dados)

> **Estado (Fase 3):** documento de **contexto da Fase 1**. O código alvo está em `API/app60-api`, `Worker/worker.py`, clientes Cognito; `API/supabase-backend/` foi **removido**. Ver `docs/supabase-eradication-checklist.md`.

## Resumo executivo

O repositório **antes da migração** dependia do **Supabase** em quatro superfícies: **app móvel** (`app60`), **web** (`app60web`), **Edge Function** (`API/supabase-backend/supabase/functions/create-user`) e **worker Python** (`Worker/worker.py`). Não existe API HTTP proprietária substituindo o PostgREST do Supabase: clientes falam **diretamente** com Postgres (via SDK) e **Storage**, e o login usa **Supabase Auth**.

A estratégia declarada é **hard cut**: **não** migrar dados do Supabase; **RDS, S3 e Cognito começam vazios**; remover **todo** uso de `@supabase/supabase-js`, Python `supabase` e funções hospedadas no projeto Supabase. Isso **elimina** a necessidade de replicação ou export de linhas, mas **exige** reimplementar contratos (tabelas, uploads, fila do worker, criação de usuários) sobre **nova API** e **novo schema** (incluindo a hierarquia de roles alvo).

Evidências de **deriva de schema** entre o que está versionado em `API/supabase-backend/supabase/migrations/` e o que o código assume são **críticas** para qualquer tentativa de “subir o Git e ter paridade”: o código e o worker referenciam estruturas **ausentes** ou **incompletas** nas migrations commitadas (ver `docs/supabase-dependency-inventory.md`).

**Esta fase não implementa mudanças estruturais** — apenas documenta o estado, riscos e alvo.

---

## O que existe hoje (arquitetura atual — evidência no código)

| Camada | Papel | Evidência principal |
|--------|--------|---------------------|
| Web Vite/React | Auth Supabase + leitura/escrita `profiles`, `participants`, `test_session_results`; invoca Edge Function | `app60web/src/lib/supabase/client.ts`, `contexts/AuthContext.tsx`, `features/users/*`, `features/participants/services/participants.ts` |
| Mobile Expo | Auth Supabase + `profiles`/`participants` + pipeline `test_sessions` + Storage | `app60/src/services/supabase/client.ts`, `authLocal.ts`, `participants.ts`, `services/tests/uploadTestJson.ts` |
| “Backend” | Uma Edge Function Deno `create-user` | `API/supabase-backend/supabase/functions/create-user/index.ts` |
| Worker | Service role: poll `test_sessions`, download Storage, upsert `test_session_results` | `Worker/worker.py` |
| SQL versionado | RLS, enums, tabelas base | `API/supabase-backend/supabase/migrations/*.sql` |

O **dashboard web** consome **dados mock**, não Supabase: `app60web/src/features/dashboard/pages/DashboardPage.tsx` (referência cruzada com `docs/aws-migration-audit.md`).

---

## O que é problema (cético, baseado em evidência)

1. **Acoplamento direto ao PostgREST**: trocar o provedor sem introduzir **API própria** implica reescrever todos os `supabase.from(...)` em web/mobile/worker — ou manter algo compatível com PostgREST (não desejado no alvo AWS-only).
2. **Auth e dados de perfil acoplados ao `auth.users`**: `profiles.id` referencia `auth.users(id)` na migration inicial; Cognito usa **sub** próprio — o modelo relacional precisa ser redesenhado (não é “swap de URL”).
3. **Autorização duplicada**: RLS no Postgres + regras na Edge Function + UI (`RequireRole`, `permissions.ts`) + lógica mobile em `participants.ts`. Qualquer novo modelo de roles exige **uma** fonte de verdade clara na API (recomendação no doc de arquitetura alvo).
4. **Schema Git ≠ schema assumido pelo código**: `test_session_results`, colunas de processamento em `test_sessions`, tipo `IVCF20`, campo `profiles.country` na UI — risco de documentação falsa se confiar só nas migrations do repo.
5. **RLS permissivo em `test_sessions`** (no repo): policies com `using (true)` para `authenticated` — segurança real no ambiente remoto pode diferir; na AWS isso precisa ser **explicitamente** redesenhado.
6. **Segredos em artefatos versionados**: `app60/app.json` contém URL e anon key em `expo.extra`; `API/supabase-backend/.env.example` contém chaves — risco operacional e de compliance (rotação/histórico).

---

## O que se propõe (alto nível, fase seguinte)

- **Cognito** (pools separados staging/prod em contas de workload) + **RDS PostgreSQL** + **S3** + **API** (Lambda+API Gateway ou ECS) + **Secrets Manager/SSM** + **CloudWatch**.
- **Banco zerado** com schema alinhado a `docs/final-role-model-design.md` (instituição, histórico de vínculo, participante global, coleta com instituição vigente, política de continuidade).
- **Worker** deixa de usar `supabase` Python: passa a **RDS + S3** com credencial de workload (IAM user/role assumível ou secrets), idealmente **na mesma conta** do ambiente (staging vs production) — ver `docs/final-target-architecture.md`.
- **Corte**: desligar clientes contra Supabase somente quando API + auth + storage + worker estiverem validados em **staging**.

---

## Arquivos impactados (lista principal — migração completa)

### Pacotes / config

- `app60/package.json`, `app60web/package.json` — remoção `@supabase/supabase-js`.
- `Worker/requirements.txt` — remoção `supabase`.
- `app60/app.json` — remoção de `expo.extra` Supabase; substituição por config segura (EAS secrets / build-time env).

### Inicialização cliente

- `app60web/src/lib/supabase/client.ts`
- `app60/src/services/supabase/client.ts`

### Auth e sessão

- `app60web/src/contexts/AuthContext.tsx`
- `app60/src/services/authLocal.ts`

### Domínio

- `app60web/src/features/users/pages/UsersPage.tsx`, `UserCreatePage.tsx`, `UserEditPage.tsx`
- `app60web/src/features/participants/services/participants.ts`, `pages/ParticipantDetailPage.tsx`
- `app60/src/services/participants.ts`
- `app60/src/services/tests/uploadTestJson.ts`
- Telas que chamam upload: ex. `app60/src/features/tests/tug/ResultScreen.tsx`, `marcha-estacionaria/ResultScreen.tsx`, `limite-estabilidade/ResultScreen.tsx`

### Tipos e autorização UI

- `app60web/src/types/auth.ts`, `app60web/src/lib/auth/permissions.ts`, `app60web/src/app/router.tsx`, `app60web/src/components/layout/AppSidebar.tsx`
- `app60/src/models/auth.ts`

### Infra legada Supabase no repo

- `API/supabase-backend/supabase/functions/create-user/*`
- `API/supabase-backend/supabase/migrations/*` (referência histórica; schema novo será outro baseline)
- `Worker/worker.py`

---

## Riscos específicos do hard cut (sem migração de dados)

| Risco | Por quê |
|-------|---------|
| **Paralisar produção** | Cutover sem worker + API + mobile/web alinhados quebra coleta e processamento. |
| **Perda de rastreabilidade** | Histórico antigo fica só no Supabase desligado — aceitar explicitamente ou arquivar export read-only fora do escopo declarado. |
| **Regressão de autorização** | Substituir RLS por API mal modelada pode expor `participants` ou `test_sessions`. |
| **Duplicidade de participante (CPF)** | Novo modelo exige unicidade global e política de merge/transferência — precisa regra de produto + implementação. |

---

## Próximo passo recomendado

1. Revisão humana deste pacote de docs e congelamento de decisões (API Lambda vs ECS, worker na AWS vs externo).
2. Especificar **OpenAPI** (ou contrato interno) para substituir cada tabela/coluna hoje acessada pelo SDK.
3. Implementar **staging** na conta Staging: Cognito + RDS vazio com schema alvo + S3 + API mínima (login + health + uma leitura autorizada).

**PARE aqui para revisão** — sem remoção de Supabase, sem alteração destrutiva de schema no repositório além da documentação entregue nesta fase.
