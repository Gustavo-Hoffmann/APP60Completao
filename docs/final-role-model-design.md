# Modelo final de roles, hierarquia e schema (alvo RDS)

## Resumo executivo

Este documento define o **modelo lógico alvo** para substituir o enum legado `ADMIN | PROFESSOR | ALUNO` e o modelo antigo de ownership em participantes. O SQL legado foi removido do repositório na Fase 3; a implementação canónica do schema novo é `API/app60-api/src/db/migrations/001_initial_aws_schema.sql`. É **desenho de produto + dados** para banco zerado na AWS.

**Hierarquia obrigatória (negócio):**

`SuperAdmin > Admin > Institution (sem login) > Gestor > Supervisor > Avaliador/Pesquisador > Participante`

**Regras obrigatórias (produto):**

- **Institution** é entidade lógica **sem conta**; criada pelo **SuperAdmin**.
- **Admin** seleciona **instituição** ao criar contas abaixo na hierarquia (Gestor, Supervisor, Avaliador conforme política de cadastro).
- **Gestor:** vê **todos** os participantes e **todas** as coletas da sua instituição.
- **Supervisor:** vê **todos** os participantes da instituição e **apenas** coletas **próprias** e de **avaliadores vinculados a ele**.
- **Avaliador/Pesquisador:** vê **todos** os participantes da instituição e **apenas** coletas **realizadas por ele**.
- **Participante:** **sem login**; entidade **global** identificada por **CPF** (ou ID único interno estável); sujeito a **histórico de vínculo institucional**.
- Cada **coleta** registra a **instituição vigente** no momento da coleta; coletas históricas **não** mudam instituição retroativamente.
- Política explícita de **continuidade / transferência de histórico** entre instituições (configurável, auditável).

---

## Estado legado (referência histórica — pré hard cut)

O repositório já não contém as migrations Supabase citadas abaixo; mantemos o texto como contexto de desenho.

- Papéis autenticados legados: `ADMIN`, `PROFESSOR`, `ALUNO` em schema antigo.
- “Participante” no legado: linha em `participants`, **não** valor de `user_role` — ver `docs/current-role-model-audit.md` se existir.
- **Implementação atual:** `API/app60-api/src/db/migrations/001_initial_aws_schema.sql` + `docs/authorization-rules-matrix.md`.

---

## Mapeamento conceitual: legado → alvo (orientação de migração conceitual)

> Como não haverá migração de dados, isto serve para **realinhar código mental** e permissões, não para ETL.

| Legado | Alvo sugerido |
|--------|-----------------|
| `ADMIN` | Parte do papel **Admin** (institucional) ou **SuperAdmin** se for dono global do tenant SaaS — **definir** se existe um único SuperAdmin técnico vs Admin de negócio. |
| `PROFESSOR` | Pode mapear para **Supervisor** ou **Avaliador** dependendo se “orienta outros” ou “coleta” — o produto deve fixar regra. |
| `ALUNO` | Papel autenticado subordinado no legado; no alvo, avaliadores podem não ser “alunos” — provável **Avaliador** ou papel removido se fluxo mudar. |

**Cético:** sem regra de produto explícita, não se deve assumir bijeção 1:1 entre `PROFESSOR` e `Supervisor`.

---

## Modelo de dados proposto (PostgreSQL)

### Convenções

- IDs: `uuid` PK, `timestamptz` para auditoria.
- `cognito_sub` (texto único) liga usuário autenticado à linha de perfil de aplicação.
- **Participante** identificado por `cpf_normalized` (11 dígitos) **único global**; opcional `external_id` se necessário fora do Brasil.

### Tabelas núcleo

#### `institutions`

- `id`, `name`, `slug` opcional, `created_at`, `created_by_super_admin_id` (FK para usuário app), `is_active`.
- Sem login — apenas entidade.

#### `app_users` (substitui `profiles` + desacoplamento de `auth.users`)

- `id` (uuid PK), `cognito_sub` (unique), `email`, `full_name`, `role` (enum abaixo), `is_active`, `created_at`, `updated_at`, `created_by_id` (nullable para bootstrap).

**Enum sugerido `app_role`:**  
`SUPER_ADMIN`, `ADMIN`, `GESTOR`, `SUPERVISOR`, `AVALIADOR`

*(SuperAdmin pode ser separado em tabela ou flag `is_platform_super_admin` para evitar enum gigante — alternativa válida.)*

#### `user_institution_scopes`

Amarra usuário autenticado à instituição corrente de atuação (um usuário pode mudar de instituição no futuro com novo vínculo; histórico abaixo).

- `id`, `user_id` FK → `app_users`, `institution_id` FK → `institutions`, `valid_from`, `valid_to` (null = vigente), `created_at`.

#### `supervision_edges` (Supervisor → Avaliador)

- `id`, `supervisor_user_id` FK, `evaluator_user_id` FK, `institution_id` FK, `valid_from`, `valid_to`, `created_at`.
- Garantir que ambos os usuários tenham scope na mesma `institution_id` na vigência.

#### `participants` (globais, sem login)

- `id` uuid PK, `cpf_normalized` char(11) UNIQUE NOT NULL, `full_name`, demais dados demográficos/endereço, `created_at`, `updated_at`.
- **Não** possui `cognito_sub`.

#### `participant_institution_history`

Histórico de vínculo participante ↔ instituição.

- `id`, `participant_id`, `institution_id`, `valid_from`, `valid_to` (null = vigente na instituição), `reason` (enum/texto: `ENROLL`, `TRANSFER`, `DISCHARGE`, …), `requested_by_user_id`, `approved_by_user_id` (nullable conforme política), `created_at`.

**Regra:** transferência **não** reescreve coletas passadas; apenas abre novo vínculo com `valid_from` e fecha o anterior com `valid_to`.

#### `data_continuity_policies` (opcional mas alinhado ao requisito)

Define **o que** permanece visível após transferência (ex.: somente coletas enquanto vínculo ativo vs carreira inteira).

- `id`, `institution_id` (ou global), `policy_key`, `jsonb` rules, `effective_from`, `created_by`, etc.

Implementação de consulta: a API aplica `policy` + `participant_institution_history` + papel do usuário para montar datasets.

#### `collections` (substitui conceito de `test_sessions` + resultados)

Nome genérico para “coleta de teste”; pode permanecer `test_sessions` se preferir continuidade de código.

Campos mínimos sugeridos:

- `id`, `participant_id`, `institution_id_at_collection` (**snapshot** — NOT NULL), `performed_by_user_id` (Avaliador; nullable só se regra futura permitir sistema), `supervisor_user_id` nullable (denormalizado opcional para performance de filtro), `test_type`, `session_number`, `performed_at`, `raw_s3_bucket`, `raw_s3_key`, `processing_status`, `processing_error`, `created_at`, `updated_at`.

**Invariante:** `institution_id_at_collection` imutável após insert.

#### `collection_results`

- `id`, `collection_id` UNIQUE (1:1 ou 1:N se versões), `metrics_json`, `plot_json`, `updated_at`.

---

## Regras de autorização (enforcement)

Recomendação: **API** como ponto único de verdade; pseudocódigo por papel:

- **SuperAdmin:** CRUD `institutions`; criar **Admin** global (se aplicável).
- **Admin:** criar usuários com role ≤ Gestor e atribuir `institution_id` obrigatório para papéis operacionais.
- **Gestor:** escopo `institution_id = X`; SELECT participantes que possuem vínculo vigente **ou** histórico conforme política; SELECT todas as coletas com `institution_id_at_collection = X`.
- **Supervisor:** mesma instituição; participantes como Gestor; coletas onde `performed_by_user_id` ∈ { self } ∪ { avaliadores vinculados via `supervision_edges` vigentes }.
- **Avaliador:** mesma instituição para participantes; coletas onde `performed_by_user_id = self`.
- **Participante:** sem API autenticada; apenas dados cadastrais manipulados por papéis autorizados.

---

## Índices sugeridos

- `collections (institution_id_at_collection, performed_by_user_id, test_type)`.
- `participant_institution_history (participant_id, valid_to)` parcial onde `valid_to IS NULL`.
- `user_institution_scopes (user_id)` onde `valid_to IS NULL`.
- `app_users (cognito_sub)` unique.

---

## Impacto em código (futuro)

- Substituir `Role` em `app60web/src/types/auth.ts` e `app60/src/models/auth.ts`.
- Reescrever `app60web/src/lib/auth/permissions.ts` e `app60web/src/app/router.tsx`.
- Eliminar `owner_professor_id` / `owner_student_id` do modelo mobile `app60/src/services/participants.ts` em favor de regras institucionais + vínculo histórico.
- Edge Function / fluxo de criação de usuário passa a API + Cognito.

---

## Riscos

- **Complexidade de política de continuidade** — mal especificada vira litígio de dados entre instituições.
- **CPF como chave global** — duplicidade falsa (homônimos, erro de digitação) exige fluxo de revisão humana.
- **Performance de joins** histórico + coletas — exige índices e queries testadas.

---

## Próximo passo de especificação

1. Validar com stakeholders se **SuperAdmin** é papel único técnico ou há vários.
2. Fixar matriz “quem cria quem” (Admin cria Gestor/Supervisor/Avaliador?).
3. Traduzir este modelo para **migration inicial única** do RDS (Flyway/Liquibase/sqitch) na conta Staging.
