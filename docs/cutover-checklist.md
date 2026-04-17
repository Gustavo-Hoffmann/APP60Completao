# Checklist de deploy e cutover (staging → production)

## Modelo de branches e contas (política acordada)

| Branch / trigger | Conta AWS alvo |
|------------------|----------------|
| `staging` (ou pipeline de homologação) | **Staging** — RDS, Cognito, S3, secrets próprios. |
| `main` (ou tag de release) | **Production** — recursos isolados, **nunca** reutilizar bucket/RDS de staging. |

Ajuste os nomes exatos de branch ao vosso GitOps (GitHub Actions, CodePipeline, etc.); o princípio é **um ambiente = uma conta** (além da conta Management para governança).

---

## Variáveis e segredos por ambiente

- Copiar estrutura de `.env.staging.example` e `.env.production.example` na raiz.
- **Nunca** usar o mesmo `DATABASE_URL`, `S3_RAW_BUCKET`, `COGNITO_USER_POOL_ID` entre staging e production.
- Segredos: AWS Secrets Manager / SSM + referência no ECS/Render/Lambda conforme o runtime da API.

Documentação de chaves: `docs/env-mapping-aws-only.md`, `docs/deployment-envs.md`.

---

## Ordem segura de deploy (primeiro deploy sem dados)

1. **RDS** criado; schema aplicado (`001_initial_aws_schema.sql`).
2. **Cognito** pool + app client.
3. **S3** bucket + políticas IAM.
4. **API** deploy com envs corretas; health check na rota pública mínima.
5. **Bootstrap** SUPER_ADMIN (`docs/bootstrap-from-zero.md`).
6. **Web** build com `VITE_*` de staging; publicar atrás de URL de staging.
7. **Mobile** build com `expo.extra` de staging (EAS profile).
8. **Worker** deploy no Render (ou ECS) com `DATABASE_URL` + AWS creds **da mesma conta** do ambiente.

---

## Primeiro deploy sem dados

- Bases vazias são esperadas; o único utilizador inicial vem do bootstrap + Cognito.
- Não importar dumps do Supabase.

---

## Promover staging → production (passo exato)

1. **Congelar** alterações em staging até a bateria de testes do `docs/staging-validation-plan.md` estar verde.
2. **Merge** do código aprovado para `main` (ou equivalente).
3. **Pipeline de production** com:
   - Novo deploy da API apontando para **RDS/Cognito/S3 de production** (envs de production).
   - Build da web com `VITE_*` de **production**.
   - Worker de production com credenciais da conta production.
4. **Bootstrap production** só se o RDS production estiver vazio: repetir `POST /bootstrap/first-super-admin` com segredo **próprio** de production (não reutilizar o de staging).
5. **Smoke tests** mínimos em production (`/api/me`, criação instituição, um utilizador de serviço).
6. **DNS / CORS:** apontar domínio público e atualizar `CORS_ORIGIN` na API de production.

**Importante:** promover **código**, não **dados** de staging para production, salvo política explícita de cópia anonimizada. Em hard cut típico, production começa também zerada.

---

## Pós-cutover

- Monitorização CloudWatch (API, RDS, erros 5xx).
- Rotacionar `BOOTSTRAP_SECRET` ou remover variável após bootstrap em cada ambiente.
