#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Uso: ${0##*/} staging|production" >&2
  exit 1
}

die() {
  echo "ERRO: $*" >&2
  exit 1
}

warn() {
  echo "AVISO: $*" >&2
}

[[ "${1:-}" == "staging" || "${1:-}" == "production" ]] || usage
TARGET="${1}"

CWD=$(pwd -P)

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  die "O diretório atual não parece estar dentro de um repositório Git."
fi

BRANCH=$(git branch --show-current || true)
if [[ -z "${BRANCH}" ]]; then
  die "Branch não detectada (possível detached HEAD). Ajuste o checkout antes de continuar."
fi

AWS_PROFILE_VAL="${AWS_PROFILE:-}"
AWS_REGION_VAL="${AWS_REGION:-}"

cwd_lc=$(printf '%s' "${CWD}" | tr '[:upper:]' '[:lower:]')
profile_lc=$(printf '%s' "${AWS_PROFILE_VAL}" | tr '[:upper:]' '[:lower:]')

profile_suggests_production() {
  local p="${1:-}"
  [[ -z "${p}" ]] && return 1
  [[ "${p}" == *production* ]] && return 0
  [[ "${p}" == prod ]] && return 0
  [[ "${p}" =~ (^|[-_/])prod($|[-_/]) ]] && return 0
  return 1
}

profile_suggests_staging() {
  local p="${1:-}"
  [[ -n "${p}" && "${p}" == *staging* ]] && return 0
  return 1
}

echo "=== check-env-safety (${TARGET}) ==="
echo "Diretório atual: ${CWD}"
echo "Branch atual:    ${BRANCH}"
echo "AWS_PROFILE:     ${AWS_PROFILE_VAL:-"(não definido)"}"
echo "AWS_REGION:      ${AWS_REGION_VAL:-"(não definido)"}"
echo "---"

if ! command -v aws >/dev/null 2>&1; then
  die "AWS CLI não encontrado no PATH."
fi

if [[ "${TARGET}" == "production" ]]; then
  [[ "${cwd_lc}" == *app60-prod* ]] || die "Production exige que o caminho atual contenha 'app60-prod'."
  [[ "${cwd_lc}" != *app60-staging* ]] || die "O caminho contém 'app60-staging'; operação de production bloqueada."
  [[ "${cwd_lc}" != *app60.git* ]] || die "O caminho contém 'APP60.git'; operação bloqueada (não use o bare repo como cwd)."
  [[ "${cwd_lc}" != *work_app60_old* ]] || die "O caminho contém 'Work_APP60_OLD'; operação bloqueada."

  [[ "${BRANCH}" == "main" ]] || die "Production exige branch 'main' (atual: '${BRANCH}')."

  if profile_suggests_staging "${profile_lc}"; then
    die "AWS_PROFILE parece ser de staging ('${AWS_PROFILE_VAL}'); production bloqueado."
  fi
else
  [[ "${cwd_lc}" == *app60-staging* ]] || die "Staging exige que o caminho atual contenha 'app60-staging'."
  [[ "${cwd_lc}" != *app60-prod* ]] || die "O caminho contém 'app60-prod'; operação de staging bloqueada."
  [[ "${cwd_lc}" != *app60.git* ]] || die "O caminho contém 'APP60.git'; operação bloqueada (não use o bare repo como cwd)."
  [[ "${cwd_lc}" != *work_app60_old* ]] || die "O caminho contém 'Work_APP60_OLD'; operação bloqueada."

  [[ "${BRANCH}" == "staging" ]] || die "Staging exige branch 'staging' (atual: '${BRANCH}')."

  if profile_suggests_production "${profile_lc}"; then
    die "AWS_PROFILE parece ser de production ('${AWS_PROFILE_VAL}'); staging bloqueado."
  fi
fi

echo "Conta AWS (aws sts get-caller-identity):"
# Apenas Account, Arn e UserId — não exibe chaves de acesso.
if ! aws sts get-caller-identity --query '{Account:Account,Arn:Arn,UserId:UserId}' --output table; then
  die "Falha ao executar aws sts get-caller-identity (credenciais, rede ou permissões?)."
fi
echo "---"

if [[ "${TARGET}" == "production" ]]; then
  if [[ -z "${AWS_PROFILE_VAL}" ]]; then
    warn "AWS_PROFILE não definido; confirme manualmente se a conta/credencial ativa é de production."
  elif [[ "${profile_lc}" != *prod* && "${profile_lc}" != *production* ]]; then
    warn "AWS_PROFILE não contém 'prod' nem 'production'; confirme se é o perfil correto para production."
  fi
else
  if [[ -z "${AWS_PROFILE_VAL}" ]]; then
    warn "AWS_PROFILE não definido; confirme manualmente se a conta/credencial ativa é de staging."
  elif ! profile_suggests_staging "${profile_lc}"; then
    warn "AWS_PROFILE não contém 'staging'; confirme se é o perfil correto para staging."
  fi
fi

echo "OK: checagens de coerência para '${TARGET}' passaram (revise avisos acima, se houver)."
