#!/usr/bin/env bash
set -euo pipefail

###############################################################################
# ensure-staging-api-cognito-policy.sh
#
# Garante que a task role da API de staging tenha as permissões administrativas
# mínimas do Cognito usadas pela app para criar e manter usuários.
#
# Uso:
#   ./scripts/ensure-staging-api-cognito-policy.sh
#
# Opcional:
#   AWS_PROFILE=staging \
#   ECS_CLUSTER=ecs-app60-staging \
#   ECS_SERVICE=app60-api-staging \
#   FORCE_NEW_DEPLOYMENT=true \
#   ./scripts/ensure-staging-api-cognito-policy.sh
###############################################################################

AWS_PROFILE_DEFAULT="staging"
AWS_REGION_DEFAULT="us-east-1"
ACCOUNT_ID_DEFAULT="978850043586"
ROLE_NAME_DEFAULT="seniorsense-staging-api-task-role"
POLICY_NAME_DEFAULT="seniorsense-staging-api-cognito-admin"
USER_POOL_ID_DEFAULT="us-east-1_NdFHCZPAt"
ECS_CLUSTER_DEFAULT="ecs-app60-staging"
ECS_SERVICE_DEFAULT="svc-app60-api-staging"
FORCE_NEW_DEPLOYMENT_DEFAULT="false"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE_DEFAULT="$PROJECT_ROOT/.env.deploy.staging"

if [[ -f "$ENV_FILE_DEFAULT" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE_DEFAULT"
  set +a
fi

AWS_PROFILE="${AWS_PROFILE:-$AWS_PROFILE_DEFAULT}"
AWS_REGION="${AWS_REGION:-$AWS_REGION_DEFAULT}"
ACCOUNT_ID="${ACCOUNT_ID:-$ACCOUNT_ID_DEFAULT}"
ROLE_NAME="${ROLE_NAME:-$ROLE_NAME_DEFAULT}"
POLICY_NAME="${POLICY_NAME:-$POLICY_NAME_DEFAULT}"
USER_POOL_ID="${COGNITO_USER_POOL_ID:-${USER_POOL_ID:-$USER_POOL_ID_DEFAULT}}"
FORCE_NEW_DEPLOYMENT="${FORCE_NEW_DEPLOYMENT:-$FORCE_NEW_DEPLOYMENT_DEFAULT}"
ECS_CLUSTER="${ECS_CLUSTER:-$ECS_CLUSTER_DEFAULT}"
ECS_SERVICE="${ECS_SERVICE:-$ECS_SERVICE_DEFAULT}"

USER_POOL_ARN="arn:aws:cognito-idp:${AWS_REGION}:${ACCOUNT_ID}:userpool/${USER_POOL_ID}"
TMP_POLICY_FILE="$(mktemp)"
trap 'rm -f "$TMP_POLICY_FILE"' EXIT

cat > "$TMP_POLICY_FILE" <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CognitoUserPoolAdmin",
      "Effect": "Allow",
      "Action": [
        "cognito-idp:AdminCreateUser",
        "cognito-idp:AdminSetUserPassword",
        "cognito-idp:AdminGetUser",
        "cognito-idp:AdminDisableUser",
        "cognito-idp:AdminEnableUser",
        "cognito-idp:AdminUpdateUserAttributes"
      ],
      "Resource": "${USER_POOL_ARN}"
    }
  ]
}
EOF

echo "Aplicando inline policy '${POLICY_NAME}' na role '${ROLE_NAME}'..."
aws iam put-role-policy \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --role-name "$ROLE_NAME" \
  --policy-name "$POLICY_NAME" \
  --policy-document "file://${TMP_POLICY_FILE}"

echo "Policy aplicada com sucesso para o user pool '${USER_POOL_ID}'."

if [[ "$FORCE_NEW_DEPLOYMENT" == "true" ]]; then
  echo "Disparando novo deploy do servico ECS '${ECS_SERVICE}' no cluster '${ECS_CLUSTER}'..."
  aws ecs update-service \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --cluster "$ECS_CLUSTER" \
    --service "$ECS_SERVICE" \
    --force-new-deployment >/dev/null

  echo "Novo deploy solicitado."
else
  echo "Se a task ja estiver em execucao, rode novamente com FORCE_NEW_DEPLOYMENT=true"
  echo "para renovar as credenciais da task no cluster '${ECS_CLUSTER}'."
fi
