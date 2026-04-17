# Plano de corte (cutover): Supabase → AWS, banco zerado, novo modelo de roles

## Resumo executivo

Este plano ordena trabalhos para **remover completamente o Supabase** do código e da operação, com **RDS/S3/Cognito novos** (sem ETL do legado) e **schema** alinhado a `docs/final-role-model-design.md`. A estratégia é **big-bang funcional** com validação forte em **Staging** antes de Production.

**Premissas:** multi-account (Management / Staging / Production); workloads só em Staging e Production; Management sem app.

---

## Fase 0 — Congelamento e governança (já iniciada com docs)

- Congelar inventário: `docs/supabase-dependency-inventory.md`, `docs/aws-hard-cut-audit.md`.
- Rotacionar/remover segredos expostos em `app60/app.json`, `.env.example` e histórico Git (processo operacional fora do escopo de código).
- Decidir: **Lambda vs ECS** para API; **worker em Fargate/ECS vs externo**; **RLS no RDS vs só API**.

**Saída:** decisões registradas + IaC inicial por conta.

---

## Fase 1 — Fundação AWS por ambiente (Staging primeiro)

**Na conta Staging:**

1. VPC, subnets, security groups para RDS e (se aplicável) ECS/Lambda.
2. RDS PostgreSQL vazio + parameter groups.
3. S3 buckets (`raw-uploads`, etc.) com bloqueio público, encryption, lifecycle.
4. Cognito User Pool + app clients (URLs de callback de staging).
5. Secrets Manager + SSM para URLs e flags.
6. CloudWatch log groups e alarmes básicos.

**Na conta Production:** repetir com políticas mais rígidas **após** sucesso em Staging.

**Parada de validação:** conectar psql administrativo, criar schema mínimo manual ou migration v0.

---

## Fase 2 — Schema RDS alvo (novo baseline)

1. Implementar migrations versionadas a partir de **zero** (não “replay” das migrations Supabase do Git como fonte de verdade).
2. Conteúdo alinhado a `docs/final-role-model-design.md` (`institutions`, `app_users`, vínculos, participante global, histórico, `collections` + resultados).
3. Criar seeds **apenas** para desenvolvimento (SuperAdmin técnico, instituição demo).

**Parada de validação:** testes de integridade (FKs, unicidade CPF, snapshot `institution_id_at_collection` imutável via trigger ou regra na API).

---

## Fase 3 — API de aplicação (substitui PostgREST + Edge Function)

Ordem sugerida dentro da API:

1. **Middleware JWT Cognito** (validação issuer/audience).
2. **Bootstrap SuperAdmin** (script único controlado, não rota pública).
3. **CRUD instituições** (SuperAdmin).
4. **Gestão de usuários** substituindo `create-user`: criar usuário no Cognito + linha em `app_users` + vínculos institucionais (transação).
5. **Participantes** globais + histórico institucional.
6. **Coletas** — criar registro + endpoint de presigned PUT S3 + finalização (status processing).
7. **Resultados** — worker grava em `collection_results` (ou nome final escolhido).

**Parada de validação:** testes automatizados de autorização por papel (matriz Gestor/Supervisor/Avaliador).

---

## Fase 4 — Worker / processador assíncrono

1. Refatorar `Worker/worker.py` para remover `supabase` (`Worker/requirements.txt`).
2. Implementar leitura de fila: polling em RDS **ou** mensagens SQS (opcional).
3. Download S3 (`boto3`) + upload de resultados via SQL ou API interna.
4. Hospedar na VPC de Staging (preferencial) ou manter externo com rede segura.

**Parada de validação:** pipeline completo com um arquivo de teste por tipo habilitado (paridade com `ENABLED_TEST_TYPES`).

---

## Fase 5 — Frontend web (`app60web`)

1. Substituir `AuthContext` para provedor Cognito (Amplify Auth ou OIDC manual).
2. Remover `app60web/src/lib/supabase/client.ts` e todas as chamadas `supabase.from` / `functions.invoke`.
3. Implementar cliente HTTP (OpenAPI) para usuários, participantes, resultados.
4. Atualizar `router.tsx`, `permissions.ts`, tipos `Role`.
5. Revisar `ParticipantDetailPage` (hoje busca `profiles` por IDs — novo modelo pode expor endpoint “resolved names”).

**Parada de validação:** fluxos login, listagem participantes, detalhe, gestão de usuários em Staging.

---

## Fase 6 — Mobile (`app60`)

1. Trocar armazenamento de sessão Supabase por fluxo Cognito (tokens no SecureStore).
2. Refatorar `participants.ts` e `uploadTestJson.ts` para API + S3 presigned.
3. Remover `expo.extra` Supabase; usar EAS `extra` ou env de build por profile `staging|production`.
4. Ajustar telas de resultado que importam funções de upload para a API/S3 (ex.: `upload*ToCollection` em `app60/src/services/tests/uploadTestJson.ts`).

**Parada de validação:** coleta offline/online de pelo menos um teste ponta a ponta em build de staging.

---

## Fase 7 — Remoção de legado Supabase no repositório

1. Arquivar ou apagar `API/supabase-backend/supabase/functions` e documentar substituto.
2. Marcar migrations Supabase como **histórico** (não usar como baseline de deploy AWS).
3. Remover dependências `@supabase/supabase-js` e Python `supabase`.
4. Garantir que nenhum pipeline referencia projeto Supabase.

---

## Fase 8 — Cutover Production

1. Congelar releases na v1 Supabase (opcional) ou aceitar downtime.
2. Deploy infra + API + web + mobile (versões que apontam para **conta Production**).
3. Smoke tests: login, CRUD mínimo, upload + worker + leitura de resultado na web.
4. Monitoramento CloudWatch; rollback = reverter DNS/builds **apenas** se ainda houver stack antiga (no hard cut puro, rollback exige stack AWS estável, não Supabase).

---

## Ordem segura resumida

| Ordem | Item |
|-------|------|
| 1 | Inventário + decisões de plataforma (feito na documentação) |
| 2 | Infra Staging (VPC, RDS, S3, Cognito, secrets, logs) |
| 3 | Schema novo + migrations |
| 4 | API + authZ por papel |
| 5 | Worker refatorado |
| 6 | Web + Mobile apontando para API Staging |
| 7 | Testes de carga mínimos e revisão de segurança |
| 8 | Replicação da stack em Production + cutover |

---

## Validação explícita de staging (checklist)

- [ ] Dois pools Cognito isolados (staging já existente; prod separado).
- [ ] Nenhuma credencial de staging em build de produção.
- [ ] Matriz de testes: Gestor vê coleta de outro avaliador na mesma instituição? (deve **sim**); Avaliador vê coleta de colega? (deve **não**); Supervisor conforme vínculo.
- [ ] Participante transferido: coleta antiga mantém `institution_id_at_collection`.
- [ ] Worker idempotente em reprocessamento (decisão: upsert vs versão).

---

## Riscos e mitigações do plano

| Risco | Mitigação |
|-------|-----------|
| Big-bang | Staging espelha prod com dados fictícios; checklist acima |
| Regressão de segurança | Testes de API + revisão de presigned URLs (TTL, content-type, tamanho) |
| Atraso do worker | Dead-letter / alarme de fila pendente |
| Duplicação de regras UI/API | UI só desabilita ações; API nega |

---

## Estado desta fase

**Implementação estrutural e remoção do Supabase ficam para após revisão** deste plano e dos docs correlatos.
