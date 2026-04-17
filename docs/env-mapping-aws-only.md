# Mapeamento de variáveis — AWS-only (pós hard cut)

Este documento substitui o modelo legado baseado em `VITE_SUPABASE_*`, `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE` e `expo.extra.supabaseUrl`.

## Princípios

- **Segredos** ficam fora do Git (`.env` local, SSM/Secrets Manager na AWS, ou variáveis do pipeline).
- **Build do front (Vite)** só enxerga variáveis com prefixo `VITE_*` (públicas ao bundle).
- **API e Worker** usam credenciais da conta do ambiente (staging vs production); não há “anon key” de PostgREST.

## API (`API/app60-api`)

| Variável | Uso |
|----------|-----|
| `DATABASE_URL` | Conexão PostgreSQL (RDS). |
| `AWS_REGION` | Região dos clientes AWS SDK (S3, Cognito admin se usado). |
| `COGNITO_USER_POOL_ID` | Validação JWT (`jose`) do `Authorization: Bearer`. |
| `COGNITO_APP_CLIENT_ID` | Audience do token. |
| `S3_RAW_BUCKET` | Bucket para uploads brutos (presigned PUT na reserva de coleta). |
| `PORT` | Porta HTTP (default 8787). |
| `CORS_ORIGIN` | Origem permitida (ou `*` em dev). |
| `WORKER_API_KEY` | Opcional: endurecer rotas internas. |
| `BOOTSTRAP_SECRET` | Lido em `routes/bootstrap.ts`; header `x-app60-bootstrap-secret` para `POST /bootstrap/first-super-admin`. |

## Web (`app60web`)

| Variável | Uso |
|----------|-----|
| `VITE_API_BASE_URL` | Base URL da API (sem barra final). |
| `VITE_COGNITO_REGION` | Região do User Pool. |
| `VITE_COGNITO_USER_POOL_ID` | Pool Cognito (SPA). |
| `VITE_COGNITO_CLIENT_ID` | App client público (sem secret no browser). |

## Mobile (`app60`)

Configuração em `app.json` → `expo.extra`:

| Chave | Equivalente |
|-------|-------------|
| `apiBaseUrl` | `VITE_API_BASE_URL` |
| `cognitoRegion` | `VITE_COGNITO_REGION` |
| `cognitoUserPoolId` | `VITE_COGNITO_USER_POOL_ID` |
| `cognitoClientId` | `VITE_COGNITO_CLIENT_ID` |

## Worker (`Worker`)

| Variável | Uso |
|----------|-----|
| `DATABASE_URL` | Mesmo schema RDS que a API (`collections`, `collection_results`, `participants`). |
| `AWS_REGION` | Cliente S3 para `GetObject` no bucket/key da coleta. |
| `POLL_SECONDS` | Intervalo entre tentativas quando a fila está vazia. |
| `ENABLED_TEST_TYPES` | Subconjunto de processadores (ex.: `MARCHA,SL30S,IVCF20`). |
| `CALIBRATOR_PATH` | Modelo joblib da marcha. |

Credenciais AWS para o worker: **IAM role** (ECS/EKS/EC2) ou credenciais de workload; não usar chaves Supabase.

## Removidas (legado)

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (Python/Deno)
- `expo.extra.supabaseUrl`, `expo.extra.supabaseAnonKey`

Detalhes de arquivos removidos: `docs/supabase-removal-log.md`.
