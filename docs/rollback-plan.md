# Plano de rollback (técnico e operacional)

Cenário: regressão após cutover AWS-only ou erro na nova hierarquia de papéis.

---

## 1. Rollback de código

| Ação | Detalhe |
|------|---------|
| Git | `git revert` do merge problemático ou deploy da **tag/commit** anterior estável. |
| API / Web / Worker | Redeploy do artefacto anterior nos mesmos ambientes (staging primeiro). |

**Hard cut puro:** não existe “voltar para Supabase” sem reintroduzir o legado removido do repositório; o rollback é **entre versões AWS**, não para o stack antigo, salvo restaurar branch/commit que ainda contenha `API/supabase-backend/` (não recomendado como estratégia principal).

---

## 2. Rollback de deploy

- **ECS/K8s:** rollback para revisão/task set anterior.
- **Render:** “Manual Deploy” do commit anterior ou instantâneo guardado.
- **Front (S3+CloudFront ou hosting estático):** republicar build anterior ou invalidar cache apontando para bundle antigo.

---

## 3. Rollback de schema (RDS)

| Situação | Abordagem |
|----------|-----------|
| Migration incremental com `DOWN` | Executar script de reversão se existir. |
| Baseline única (`001_initial_aws_schema.sql`) | **Não há** downgrade trivial; em ambiente **zerado**, o mais seguro é **recriar** a instância RDS e reaplicar só a versão SQL boa. |
| Dados já em production | **Evitar** `DROP` em pânico; preferir **forward fix** (nova migration corrigindo política/constraint). |

Sempre testar migrations em **staging** antes de production.

---

## 4. Rollback de envs / segredos

- Restaurar valores anteriores no Secrets Manager / painel Render a partir de backup interno (vault/1Password/runbook).
- Se `COGNITO_*` ou `DATABASE_URL` trocados por engano, reverter imediatamente e **reiniciar** a API.

---

## 5. Rollback funcional (hierarquia de papéis errada)

- Corrigir **dados** em `app_users` / `supervision_edges` via SQL controlado (ex.: `PATCH /api/users` com SUPER_ADMIN ou script de suporte).
- Se regra de visibilidade estiver errada no código, **hotfix** na API (`participants.ts` / `authz.ts`) + redeploy.

---

## 6. Rollback operacional (comunicação)

- Comunicar janela de indisponibilidade se API for revertida.
- Documentar incidente: causa, commit fixo, validação cruzada com `docs/authorization-rules-matrix.md`.

---

## 7. O que **não** fazer

- Não misturar credenciais staging/production no mesmo deploy.
- Não aplicar migration em production sem dry-run em staging.
