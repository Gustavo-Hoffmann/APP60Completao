# Plano de bootstrap do banco (hard cut, zerado)

## Pré-requisitos

- Instância RDS PostgreSQL provisionada na **conta do ambiente** (staging ou production).
- Usuário SQL com permissão `CREATE` no schema alvo (normalmente `public` em baseline simples).
- Nenhuma migração de dados do Supabase: **baseline única** no arquivo de migração da API.

## Passos

1. **Criar database** (se ainda não existir), ex.: `app60`.
2. **Aplicar SQL baseline**:
   ```bash
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f API/app60-api/src/db/migrations/001_initial_aws_schema.sql
   ```
3. **Cognito**: criar o primeiro usuário humano no pool (convite ou console); o sub Cognito será referenciado após o bootstrap da API.
4. **Bootstrap da aplicação**: com a API rodando e `BOOTSTRAP_SECRET` definido, executar **uma vez**:
   - `POST /bootstrap/first-super-admin` com header `x-app60-bootstrap-secret` e corpo contendo e-mail, nome, `cognito_sub` do usuário criado no passo 3 (ver rota em `API/app60-api/src/routes/bootstrap.ts`).
5. **Desligar ou rotacionar** o segredo de bootstrap após existir `SUPER_ADMIN` ativo.
6. **Demais usuários**: criados via fluxo web/API (ADMIN com instituição, GESTOR, etc.), alinhado a `docs/final-role-model-design.md`.

## Ordem de dependências

1. RDS + migration  
2. Cognito user (sub conhecido)  
3. `POST /bootstrap/first-super-admin`  
4. Login web/mobile + CRUD de instituições/usuários

## Riscos

- Executar a migration duas vezes no mesmo banco falhará (tipos/tabelas já existentes).
- `BOOTSTRAP_SECRET` exposto permite criar super admin: trate como segredo de infraestrutura de curta vida.
