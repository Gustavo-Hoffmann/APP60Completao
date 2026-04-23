#!/usr/bin/env bash
# Deploy da API app60 para staging (AWS): migrações SQL + imagem Docker + ECR + novo deploy ECS.
#
# Pré-requisitos: AWS CLI v2, Docker, credenciais com permissão em ECR/ECS.
#
# Variáveis obrigatórias:
#   DATABASE_URL   — Postgres staging (para npm run db:migrate)
#
# Variáveis com defaults alinhados ao repositório (ajuste se sua conta divergir):
#   AWS_REGION=us-east-1
#   AWS_ACCOUNT_ID=978850043586
#   ECR_REPOSITORY=app60-api-staging
#   ECS_CLUSTER       — nome do cluster ECS (obrigatório se não definido)
#   ECS_SERVICE       — nome do serviço ECS (obrigatório se não definido)
#
# Exemplo:
#   export DATABASE_URL='postgresql://...'
#   export ECS_CLUSTER='meu-cluster-staging'
#   export ECS_SERVICE='meu-servico-api'
#   ./scripts/deploy-staging-api.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_DIR="${ROOT}/API/app60-api"

AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-978850043586}"
ECR_REPOSITORY="${ECR_REPOSITORY:-app60-api-staging}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
AWS_PAGER=""

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Erro: defina DATABASE_URL (connection string do RDS staging) antes de rodar." >&2
  exit 1
fi

if [[ -z "${ECS_CLUSTER:-}" || -z "${ECS_SERVICE:-}" ]]; then
  echo "Erro: defina ECS_CLUSTER e ECS_SERVICE (nomes na conta staging)." >&2
  exit 1
fi

ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:${IMAGE_TAG}"

echo "==> 1/4 Migrações (schema_migrations no RDS)"
(
  cd "${API_DIR}"
  export DATABASE_URL
  npm run db:migrate
)

echo "==> 2/4 Build da imagem Docker"
docker build -t "${ECR_REPOSITORY}:${IMAGE_TAG}" "${API_DIR}"

echo "==> 3/4 Login ECR + push"
aws ecr get-login-password --region "${AWS_REGION}" | docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
docker tag "${ECR_REPOSITORY}:${IMAGE_TAG}" "${ECR_URI}"
docker push "${ECR_URI}"

echo "==> 4/4 Forçar novo deploy no ECS"
aws ecs update-service \
  --region "${AWS_REGION}" \
  --cluster "${ECS_CLUSTER}" \
  --service "${ECS_SERVICE}" \
  --force-new-deployment \
  --no-cli-pager

echo "Concluído. Acompanhe o rollout no console ECS ou: aws ecs describe-services --cluster \"${ECS_CLUSTER}\" --services \"${ECS_SERVICE}\" --region \"${AWS_REGION}\""
