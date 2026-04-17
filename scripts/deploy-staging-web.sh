#!/usr/bin/env bash
set -euo pipefail

###############################################################################
# deploy-staging-web.sh — Build + deploy do frontend staging para S3/CloudFront
#
# Uso:
#   ./scripts/deploy-staging-web.sh
#
# Pré-requisitos:
#   - AWS CLI v2 configurado com perfil que tenha acesso ao bucket e CloudFront
#   - Node >= 20 e npm instalados
#   - Variáveis abaixo preenchidas
###############################################################################

# IMPORTANTE: este bucket precisa bater com o Origin do CloudFront (EVKKQRLQV24J6).
# Atualmente o Origin está em: seniorsenseplus-staging-web.s3.us-east-1.amazonaws.com
ENV_FILE_DEFAULT=""

# No seu cenário atual:
# - S3 (bucket) está na conta de STAGING (978...) -> use profile "staging"
# - CloudFront (distribuição) está na conta MANAGEMENT (049...) -> use profile "default" (ou o que você usa na 049)
S3_AWS_PROFILE_DEFAULT="staging"
CLOUDFRONT_AWS_PROFILE_DEFAULT="default"
AWS_REGION_DEFAULT="us-east-1"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WEB_DIR="$PROJECT_ROOT/app60web"

# Variáveis já exportadas no shell devem ter prioridade sobre o arquivo .env.
PRESET_S3_BUCKET="${S3_BUCKET-}"
PRESET_S3_AWS_PROFILE="${S3_AWS_PROFILE-}"
PRESET_CLOUDFRONT_DISTRIBUTION_ID="${CLOUDFRONT_DISTRIBUTION_ID-}"
PRESET_CLOUDFRONT_AWS_PROFILE="${CLOUDFRONT_AWS_PROFILE-}"
PRESET_AWS_REGION="${AWS_REGION-}"

ENV_FILE_DEFAULT="$PROJECT_ROOT/.env.deploy.staging"
if [[ -f "$ENV_FILE_DEFAULT" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE_DEFAULT"
  set +a
fi

# IMPORTANTE: este bucket precisa bater com o Origin do CloudFront (EVKKQRLQV24J6).
# Atualmente o Origin está em: seniorsenseplus-staging-web.s3.us-east-1.amazonaws.com
S3_BUCKET="${PRESET_S3_BUCKET:-${S3_BUCKET:-seniorsenseplus-staging-web}}"
CLOUDFRONT_DISTRIBUTION_ID="${PRESET_CLOUDFRONT_DISTRIBUTION_ID:-${CLOUDFRONT_DISTRIBUTION_ID:-}}"   # pode ser passado via env ou .env.deploy.staging
S3_AWS_PROFILE="${PRESET_S3_AWS_PROFILE:-${S3_AWS_PROFILE:-$S3_AWS_PROFILE_DEFAULT}}"
CLOUDFRONT_AWS_PROFILE="${PRESET_CLOUDFRONT_AWS_PROFILE:-${CLOUDFRONT_AWS_PROFILE:-$CLOUDFRONT_AWS_PROFILE_DEFAULT}}"
AWS_REGION="${PRESET_AWS_REGION:-${AWS_REGION:-$AWS_REGION_DEFAULT}}"

if [[ -z "$CLOUDFRONT_DISTRIBUTION_ID" ]]; then
  echo "AVISO: CLOUDFRONT_DISTRIBUTION_ID não definido. A invalidação do cache será pulada."
  echo "   O upload para o S3 será feito, mas a invalidação do cache será pulada."
fi

echo "=== 1/4  Instalando dependências ==="
cd "$WEB_DIR"

# Proteção: se alguém criar `.env.staging.local`, ele sobrescreve `.env.staging`
# e pode quebrar o bundle (ex.: VITE_API_BASE_URL apontando para localhost).
if [[ -f "$WEB_DIR/.env.staging.local" ]]; then
  echo "ERRO: Encontrado app60web/.env.staging.local."
  echo "      Esse arquivo NÃO pode existir para build de staging."
  echo "      Use app60web/.env.development.local para overrides locais."
  exit 2
fi

npm ci

echo "=== 2/4  Build staging (--mode staging) ==="
rm -rf dist
npm run build:staging

# Sanity check: staging nunca pode apontar para localhost.
if grep -R --line-number --fixed-strings "localhost:5173" dist/ >/dev/null 2>&1; then
  echo "ERRO: o bundle gerado contém 'localhost:5173' (env de dev vazou para staging)."
  echo "      Verifique app60web/.env.staging e remova qualquer override local."
  exit 3
fi

echo "=== 3/4  Upload para s3://$S3_BUCKET ==="
set +e
SYNC_OUT="$(aws s3 sync dist/ "s3://$S3_BUCKET/" \
  --delete \
  --region "$AWS_REGION" \
  --profile "$S3_AWS_PROFILE" \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "index.html" \
  --exclude "favicon.svg" \
  --exclude "*.png" 2>&1)"
SYNC_CODE=$?
set -e

if [[ $SYNC_CODE -ne 0 ]]; then
  if echo "$SYNC_OUT" | grep -q "AccessDenied.*ListObjectsV2\|not authorized to perform: s3:ListBucket"; then
    echo "AVISO: Sem permissão de ListBucket para o profile '$S3_AWS_PROFILE'."
    echo "       Fazendo upload sem 'sync --delete' (aws s3 cp --recursive)."
    echo "       Isso pode deixar arquivos antigos no bucket (não deletados)."

    aws s3 cp dist/ "s3://$S3_BUCKET/" \
      --recursive \
      --region "$AWS_REGION" \
      --profile "$S3_AWS_PROFILE" \
      --cache-control "public, max-age=31536000, immutable" \
      --exclude "index.html" \
      --exclude "favicon.svg" \
      --exclude "*.png"
  else
    echo "$SYNC_OUT"
    exit $SYNC_CODE
  fi
fi

aws s3 cp dist/index.html "s3://$S3_BUCKET/index.html" \
  --region "$AWS_REGION" \
  --profile "$S3_AWS_PROFILE" \
  --cache-control "no-cache, no-store, must-revalidate" \
  --content-type "text/html"

for f in dist/favicon.svg dist/*.png dist/icons.svg; do
  [[ -f "$f" ]] || continue
  fname="$(basename "$f")"
  aws s3 cp "$f" "s3://$S3_BUCKET/$fname" \
    --region "$AWS_REGION" \
    --profile "$S3_AWS_PROFILE" \
    --cache-control "public, max-age=86400"
done

echo "=== 4/4  Invalidação do CloudFront ==="
if [[ -n "$CLOUDFRONT_DISTRIBUTION_ID" ]]; then
  aws cloudfront create-invalidation \
    --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" \
    --paths "/*" \
    --region "$AWS_REGION" \
    --profile "$CLOUDFRONT_AWS_PROFILE"
  echo "Invalidação criada com sucesso."
else
  echo "Pulando invalidação (CLOUDFRONT_DISTRIBUTION_ID vazio)."
fi

echo ""
echo "Deploy staging concluído."
echo "URL: https://staging.seniorsenseplus.com"
