#!/usr/bin/env bash
# Deploy da API app60 para staging (AWS): migrações SQL + imagem Docker + ECR + novo deploy ECS.
#
# Pré-requisitos: AWS CLI v2, Docker, credenciais com permissão em ECR/ECS.
#
# IMPORTANTE (contexto): o ECS/Fargate de STAGING espera imagens Linux x86_64.
# Portanto, este script builda e publica explicitamente como: linux/amd64
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
IMAGE_TAG="${IMAGE_TAG:-$(date -u +%Y%m%d%H%M%S)-amd64}"
SKIP_MIGRATIONS="${SKIP_MIGRATIONS:-0}"
DOCKER_PLATFORM="${DOCKER_PLATFORM:-linux/amd64}"
AWS_PAGER=""

AWS_CLI=(aws --profile "${AWS_PROFILE}" --region "${AWS_REGION}")

if [[ "${SKIP_MIGRATIONS}" != "1" ]]; then
  if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "Erro: defina DATABASE_URL (RDS staging), p.ex. em .env.deploy.staging na raiz do repo." >&2
    exit 1
  fi
fi

ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:${IMAGE_TAG}"

if [[ "${SKIP_MIGRATIONS}" == "1" ]]; then
  echo "==> 1/4 Migrações (schema_migrations no RDS) — PULADO (SKIP_MIGRATIONS=1)"
else
  echo "==> 1/4 Migrações (schema_migrations no RDS)"
  (
    cd "${API_DIR}"
    export DATABASE_URL
    npm run db:migrate
  )
fi

echo "==> 2/4 Login ECR"
"${AWS_CLI[@]}" ecr get-login-password | docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

echo "==> 3/4 Build + push da imagem Docker (${DOCKER_PLATFORM})"
# Observação: o buildx garante a plataforma correta para o ECS/Fargate.
docker buildx build \
  --platform "${DOCKER_PLATFORM}" \
  -t "${ECR_URI}" \
  --push \
  "${API_DIR}"

echo "==> 4/4 Registrar nova task definition com a imagem nova e atualizar o service"
# ECS/Fargate só puxa imagem nova quando a task definition muda (mesmo com :latest).
# Por isso aqui a gente registra uma nova revision apontando para a imagem recém-publicada.
CURRENT_TD_ARN="$(
  "${AWS_CLI[@]}" ecs describe-services \
    --cluster "${ECS_CLUSTER}" \
    --services "${ECS_SERVICE}" \
    --query 'services[0].taskDefinition' \
    --output text
)"
echo "Task definition atual: ${CURRENT_TD_ARN}"

NEW_TD_JSON="$(mktemp)"
"${AWS_CLI[@]}" ecs describe-task-definition \
  --task-definition "${CURRENT_TD_ARN}" \
  --query 'taskDefinition' \
  --output json |
  python3 -c "
import json, sys
td = json.load(sys.stdin)
new_image = sys.argv[1]
for c in td.get('containerDefinitions', []):
    if c.get('name') == 'app60-api':
        c['image'] = new_image
for k in ('status','taskDefinitionArn','revision','requiresAttributes','compatibilities','registeredAt','registeredBy','deregisteredAt'):
    td.pop(k, None)
json.dump(td, sys.stdout)
" "${ECR_URI}" > "${NEW_TD_JSON}"

NEW_TD_ARN="$(
  "${AWS_CLI[@]}" ecs register-task-definition \
    --cli-input-json "file://${NEW_TD_JSON}" \
    --query 'taskDefinition.taskDefinitionArn' \
    --output text
)"
echo "Nova task definition registrada: ${NEW_TD_ARN}"

"${AWS_CLI[@]}" ecs update-service \
  --cluster "${ECS_CLUSTER}" \
  --service "${ECS_SERVICE}" \
  --task-definition "${NEW_TD_ARN}" \
  --force-new-deployment \
  --no-cli-pager >/dev/null

echo "Aguardando serviço estabilizar..."
"${AWS_CLI[@]}" ecs wait services-stable \
  --cluster "${ECS_CLUSTER}" \
  --services "${ECS_SERVICE}"

echo "Concluído. Imagem em uso: ${ECR_URI}"
