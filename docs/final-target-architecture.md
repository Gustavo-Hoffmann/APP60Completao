# Arquitetura final alvo: AWS-first / AWS-only (pós-Supabase)

## Resumo executivo

Após a migração, **não** haverá Supabase: autenticação em **Amazon Cognito**, dados relacionais em **Amazon RDS for PostgreSQL**, objetos brutos em **Amazon S3**, segredos em **AWS Secrets Manager** (e parâmetros não secretos em **SSM Parameter Store**), observabilidade em **Amazon CloudWatch**. Clientes (web e mobile) e o processador assíncrono devem consumir uma **API HTTP própria** (não PostgREST público), com autorização baseada em **JWT do Cognito** (e autorização de domínio na API).

A organização segue **multi-account**: **Management** apenas governança/billing; **Staging** e **Production** hospedam **toda** workload de aplicação (sem RDS/Cognito de app na Management).

O requisito de **banco e storage zerados** implica **novo schema** e **novos buckets** — alinhado a `docs/final-role-model-design.md`.

---

## Visão multi-account

### Conta Management

**Pode conter:** AWS Organizations, OU structure, SCPs opcionais, billing consolidado, AWS IAM Identity Center (SSO humano), budgets, relatórios de custo agregados.

**Não deve conter:** User Pools da aplicação, RDS com dados de participantes, buckets de PHI/dados clínicos, Lambdas/ECS da API do produto, secrets de runtime da app.

### Conta Staging

**Stack completa de homologação**, isolada de produção:

- Amazon Cognito User Pool + App clients (callbacks para domínio de staging).
- RDS PostgreSQL (schema alvo; dados sintéticos ou mínimos).
- S3 buckets (raw uploads, artefatos opcionais) com criptografia (SSE-KMS recomendado), lifecycle e bloqueio público.
- API: Amazon API Gateway (HTTP ou REST) + AWS Lambda **ou** serviço em Amazon ECS/Fargate — decisão de implementação.
- AWS Secrets Manager: credenciais RDS, chaves de integração; SSM para feature flags.
- Frontend web: Amazon S3 + Amazon CloudFront **ou** AWS Amplify Hosting **ou** ECS static — decisão de implementação.
- CloudWatch: log groups por função/serviço, métricas, alarmes (5xx, latência RDS, espaço disco).

### Conta Production

Mesma **forma** que Staging, com controles reforçados: deletion protection no RDS, backups com retenção maior, alarmes mais rígidos, revisão de mudanças, princípio do menor privilégio IAM.

---

## Componentes por capacidade (substituição do Supabase)

| Hoje (Supabase) | Alvo AWS |
|-----------------|----------|
| Supabase Auth | Cognito User Pools; fluxos sign-in; tokens JWT validados na API |
| `auth.users` + `profiles` | `app_user` (ou equivalente) ligado a `cognito_sub`; papéis e vínculos institucionais no RDS (ver doc de roles) |
| PostgREST direto do cliente | API com endpoints explícitos; sem exposição de SQL ao browser/app |
| Storage buckets | S3; upload via **presigned URL** ou proxy autenticado na API |
| Edge Function `create-user` | Lambda (ou rota na API) + transação RDS + `AdminCreateUser` / fluxo Cognito convidado |
| Worker Python + service role | Mesmo código de domínio, trocando SDK: **boto3** (S3) + **psycopg** ou SQLAlchemy (RDS); IAM role com política mínima |
| RLS Supabase | Ou RLS no RDS com claim mapeado (complexo com Cognito) **ou** autorização central na API (recomendado para clareza com novo modelo de roles) |

---

## Processador assíncrono (ex-worker)

Hoje: `Worker/worker.py` no Render com chave service Supabase.

**Alvo:** o job continua sendo um **loop de polling** ou evolui para fila (Amazon SQS) — decisão de engenharia. Mínimo viável:

- Identidade: **IAM role** (se rodar em AWS) ou credencial de máquina com acesso restrito a **prefixos** S3 e **tabelas** RDS necessárias.
- Rede: se o worker permanecer fora da AWS, expor RDS via **acesso controlado** (Security Group, allowlist IP, ou túnel/VPN/PrivateLink) — item de risco operacional a decidir cedo.

**Recomendação de alinhamento “AWS-only”:** executar o worker em **ECS Fargate** ou **Lambda** (com limites de tempo) na **mesma conta** do ambiente, reduzindo superfície de rede.

---

## Segredos, configuração e deploy

- **Secrets Manager:** senha master/usuário app do RDS, strings de conexão, client secrets se necessário.
- **SSM Parameter Store:** URLs públicas não secretas, flags de ambiente.
- **CI/CD:** OIDC (GitHub Actions → IAM role) com roles separadas `deploy-staging` / `deploy-prod` em cada conta membro.
- **Nomeação:** `app60-{env}-{resource}-{suffix}` dentro de cada conta (ex.: `app60-staging-rds-01`, `app60-prod-raw-uploads`).
- **Tags:** `Project=app60`, `Environment=staging|production`, `ManagedBy=terraform|cdk` (quando aplicável).

---

## Implicações para ambientes

| Aspecto | Staging | Production |
|---------|---------|------------|
| Cognito User Pool | Pool dedicado | Pool dedicado (nunca compartilhar) |
| RDS | Instância menor, dados fictícios | Instância dimensionada, backups |
| S3 | Bucket separado | Bucket separado |
| Domínios | `app.staging.example.com` | `app.example.com` |
| Secrets | ARNs distintos | ARNs distintos |

---

## Frontend web “na AWS”

Opções equivalentes alinhadas ao requisito:

1. Build estático em **S3** + **CloudFront** + ACM.
2. **Amplify Hosting** com pipeline.
3. Container + **CloudFront** na frente.

O mobile (Expo) consome a **mesma API** com base URL por ambiente (build flavors / EAS profiles).

---

## Relação com o novo modelo de roles

- Cognito **groups** ou **custom attributes** podem espelhar papel de alto nível, mas a **regra de negócio** (Gestor vs Supervisor vs Avaliador, escopo por instituição e coleta) deve ser **enforçada na API** com testes, usando tabelas descritas em `docs/final-role-model-design.md`.
- Evitar três matrizes divergentes (Cognito + API + UI); UI só reflete o que a API permite.

---

## Riscos da arquitetura alvo

| Risco | Mitigação |
|-------|-----------|
| Complexidade multi-account | Automatizar com IaC; documentar contas e OU |
| Latência / conectividade worker ↔ RDS | Preferir worker na VPC da mesma conta |
| Duplicação de lógica de auth | Biblioteca compartilhada de validação JWT + testes de autorização na API |
| Custos Cognito/RDS | Monitorar com budgets na Management ou por conta |

---

## Documentos relacionados

- `docs/aws-hard-cut-audit.md` — estado atual e corte seco.
- `docs/supabase-dependency-inventory.md` — inventário de acoplamento.
- `docs/final-role-model-design.md` — schema e regras de negócio.
- `docs/aws-cutover-plan.md` — ordem de implementação e validação.
