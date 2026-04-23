#!/usr/bin/env bash
# Deploy da API app60 para staging (AWS): migrações SQL + imagem Docker + ECR + novo deploy ECS.
#
# Pré-requisitos: AWS CLI v2, Docker, credenciais com permissão em ECR/ECS.
#
# Variáveis obrigatórias:
#   DATABASE_URL   — Postgres staging (para npm run db:migrate), salvo em .env.deploy.staging (não versionado) ou exportado.
#
# Opcional (defaults iguais a scripts/ensure-staging-api-cognito-policy.sh):
#   AWS_PROFILE=staging
#   AWS_REGION=us-east-1
#   AWS_ACCOUNT_ID=978850043586
#   ECR_REPOSITORY=app60-api-staging
#   ECS_CLUSTER=ecs-app60-staging
#   ECS_SERVICE=svc-app60-api-staging
#
# Se existir .env.deploy.staging na raiz do repositório, é carregado automaticamente (set -a).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_DIR="${ROOT}/API/app60-api"
ENV_FILE_DEFAULT="${ROOT}/.env.deploy.staging"

if [[ -f "${ENV_FILE_DEFAULT}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE_DEFAULT}"
  set +a
fi

AWS_PROFILE="${AWS_PROFILE:-staging}"
AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-978850043586}"
ECR_REPOSITORY="${ECR_REPOSITORY:-app60-api-staging}"
ECS_CLUSTER="${ECS_CLUSTER:-ecs-app60-staging}"
ECS_SERVICE="${ECS_SERVICE:-svc-app60-api-staging}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
AWS_PAGER=""

AWS_CLI=(aws --profile "${AWS_PROFILE}" --region "${AWS_REGION}")

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Erro: defina DATABASE_URL (RDS staging), p.ex. em .env.deploy.staging na raiz do repo." >&2
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
"${AWS_CLI[@]}" ecr get-login-password | docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
docker tag "${ECR_REPOSITORY}:${IMAGE_TAG}" "${ECR_URI}"
docker push "${ECR_URI}"

echo "==> 4/4 Forçar novo deploy no ECS"
"${AWS_CLI[@]}" ecs update-service \
  --cluster "${ECS_CLUSTER}" \
  --service "${ECS_SERVICE}" \
  --force-new-deployment \
  --no-cli-pager

echo "Concluído. Acompanhe o rollout no console ECS ou: aws --profile \"${AWS_PROFILE}\" ecs describe-services --cluster \"${ECS_CLUSTER}\" --services \"${ECS_SERVICE}\" --region \"${AWS_REGION}\""
