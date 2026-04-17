# Implantação e ambientes (multi-account)

Alinhado à estratégia **Management / Staging / Production** descrita na Fase 1 (`docs/final-target-architecture.md`, `docs/aws-cutover-plan.md`).

## Contas AWS

| Conta | Função |
|-------|--------|
| **Management** | Organização, billing, políticas; não roda API RDS do produto. |
| **Staging** | Homologação: Cognito, RDS, S3 e API dedicados. |
| **Production** | Carga real: recursos espelhados, IDs e buckets **diferentes** de staging. |

Não compartilhar bucket S3 ou instância RDS entre staging e production.

## Onde carregar variáveis

| Componente | Staging / Production |
|------------|----------------------|
| **API** | Task definition (ECS), manifest K8s, ou systemd + arquivo restrito; `DATABASE_URL` via Secrets Manager ou SSM. |
| **Web** | Build-time: CI injeta `VITE_*` para o job que roda `vite build`. |
| **Mobile** | `expo.extra` por profile (EAS `staging` / `production`) ou `app.config.ts` lendo env no build. |
| **Worker** | Mesmo padrão da API: `DATABASE_URL` + IAM para S3 read na conta do ambiente. |

## Arquivos de exemplo no repositório

- `.env.example` — desenvolvimento local agregado.
- `.env.staging.example` — placeholders da conta staging.
- `.env.production.example` — placeholders da conta production.

Copie para `.env` local (não versionado; ver `.gitignore` na raiz).

## Checklist por primeiro deploy (banco zerado)

1. Criar RDS PostgreSQL vazio na conta do ambiente.
2. Aplicar migração baseline: `API/app60-api/src/db/migrations/001_initial_aws_schema.sql` (ver `docs/db-bootstrap-plan.md`).
3. Criar User Pool + app client SPA no Cognito da mesma conta.
4. Criar bucket S3 para raw (versão, criptografia, bloqueio público); IAM da API com `s3:PutObject` para presign; IAM do worker com `s3:GetObject`.
5. Definir `BOOTSTRAP_SECRET`, chamar `POST /bootstrap/first-super-admin` uma vez, depois **rotacionar ou remover** exposição conforme política.
6. Publicar web com `VITE_*` apontando para a API e o pool corretos.

## Riscos

- **VITE_*** vazam no bundle**: IDs de pool e URL de API são públicos; proteção é Cognito + API, não “segredo” no front.
- **DATABASE_URL** com superusuário no app: usar usuário SQL com privilégios mínimos.
- **CORS**: restrinja `CORS_ORIGIN` em produção ao domínio real do SPA.
