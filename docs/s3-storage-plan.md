# Plano de armazenamento S3 (substitui Supabase Storage)

## Papel

- **Upload** (mobile/web): a API cria linha em `collections` com `raw_s3_bucket` + `raw_s3_key` e devolve **URL pré-assinada** (`PUT`) para o cliente enviar o arquivo direto ao S3.
- **Processamento**: o **worker** lê o objeto com `GetObject` usando credenciais IAM da conta do ambiente.
- **Sem URL pública** obrigatória: acesso indireto via API ou futuras URLs assinadas de leitura se necessário.

## Convenção de bucket

| Ambiente | Exemplo de nome (ajuste à política da org) |
|----------|--------------------------------------------|
| Staging | `app60-staging-raw-<region>` |
| Production | `app60-prod-raw-<region>` |

Um bucket por conta de workload (staging ≠ production).

## Convenção de chave (key)

Gerada na API (`collections.ts`): `raw/<TEST_TYPE>/<participantId>/S<sessionNumber>.<ext>`  
Ex.: `raw/MARCHA/550e8400-e29b-41d4-a716-446655440000/S3.csv`

IVCF20 usa extensão `.json` e `Content-Type: application/json`.

## IAM

- **API**: `s3:PutObject` no bucket de raw (para `getSignedUrl` de upload).
- **Worker**: `s3:GetObject` no mesmo bucket (e opcionalmente `s3:DeleteObject` se implementar limpeza).
- Bloquear políticas públicas no bucket; criptografia em repouso (SSE-S3 ou SSE-KMS) conforme padrão da conta.

## Variáveis

- API: `S3_RAW_BUCKET`, `AWS_REGION`.
- Worker: usa `raw_s3_bucket` e `raw_s3_key` da linha em `collections` (não depende de nome fixo em código além do fallback removido no hard cut).

## Riscos

- **Clock skew** e expiração do presigned URL (900 s na API): uploads lentos devem refazer reserva se necessário.
- **Content-Type** deve coincidir com o usado na assinatura, senão o S3 pode rejeitar o `PUT`.
