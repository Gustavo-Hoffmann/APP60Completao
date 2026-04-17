# Matriz de autorização (implementação atual na API)

Fontes no código: `API/app60-api/src/lib/authz.ts`, rotas em `API/app60-api/src/routes/users.ts`, `institutions.ts`, `participants.ts`, `collections.ts`.

Papéis no enum PostgreSQL / aplicação: `SUPER_ADMIN`, `ADMIN`, `GESTOR`, `SUPERVISOR`, `AVALIADOR`. **Instituição** e **Participante** não são papéis de login.

---

## 1. Quem pode criar quem (utilizadores)

| Criador | Pode criar (API `creatableRolesByActor` + `POST /api/users`) | `institutionId` |
|---------|--------------------------------------------------------------|-----------------|
| **SUPER_ADMIN** | `ADMIN`, `GESTOR`, `SUPERVISOR`, `AVALIADOR` | Obrigatório no corpo (`createSchema`). |
| **ADMIN** | `GESTOR`, `SUPERVISOR`, `AVALIADOR` | Forçado para `primary_institution_id` do ADMIN. |
| **GESTOR**, **SUPERVISOR**, **AVALIADOR** | Ninguém | — |

**SUPER_ADMIN** inicial: não via `POST /api/users`; usar `POST /bootstrap/first-super-admin` com `BOOTSTRAP_SECRET` e `app_users` vazio (`bootstrap.ts`).

**AVALIADOR** com supervisor opcional: se `supervisorId` for enviado, insere linha em `supervision_edges` (`users.ts`).

---

## 2. Instituições (entidade sem login)

| Ação | Quem |
|------|------|
| `POST /api/institutions` | Só **SUPER_ADMIN** (`canManageInstitutions`). |
| `GET /api/institutions` | **SUPER_ADMIN**: todas ativas; outros com `primary_institution_id`: só a sua. |

---

## 3. Participantes (globais) — quem vê quem

| Papel | Lista (`GET /api/participants`) | Detalhe (`GET /api/participants/:id`) |
|-------|----------------------------------|----------------------------------------|
| **SUPER_ADMIN** | Todos os registos em `participants`. | Qualquer id. |
| Com `primary_institution_id` (ADMIN, GESTOR, SUPERVISOR, AVALIADOR) | Participantes com vínculo aberto em `participant_institution_history` (`valid_to IS NULL`) para essa instituição. | Só se existir esse vínculo aberto; caso contrário 404. |

**Escrita** (`POST /api/participants`): `canWriteParticipants` inclui todos os papéis autenticados exceto regra especial — **SUPER_ADMIN** recebe **400** com mensagem de fluxo “em evolução” (não pode criar/vincular participante só como super admin neste endpoint). Implementação: `participants.ts` linhas ~241–244.

**DELETE** participante: só **SUPER_ADMIN**.

---

## 4. Coletas e resultados agregados na lista de participantes

A visibilidade de linhas em `collections` / `collection_results` junto à listagem segue `collectionVisibilityClause` em `participants.ts`:

| Papel | Coletas visíveis |
|-------|------------------|
| **SUPER_ADMIN** | Todas. |
| **ADMIN** ou **GESTOR** | `institution_id_at_collection` = instituição do utilizador. |
| **SUPERVISOR** | Mesma instituição **e** (`performed_by_user_id` = supervisor **ou** avaliador ligado em `supervision_edges` com `valid_to IS NULL`). |
| **AVALIADOR** | Mesma instituição **e** `performed_by_user_id` = próprio. |

**Reserva de coleta** (`POST /api/collections/reserve` em `collections.ts`): exige utilizador com instituição; **SUPER_ADMIN** sem instituição recebe erro de negócio (coleta requer instituição).

---

## 5. Utilizadores — listar / ver / editar

| Ação | Regra |
|------|--------|
| `GET /api/users` | **SUPER_ADMIN**: todos; **ADMIN**: só mesma `primary_institution_id`. |
| `GET /api/users/:id` | Próprio; ou **SUPER_ADMIN**; ou **ADMIN** se alvo na mesma instituição. **GESTOR**/**SUPERVISOR**/**AVALIADOR** não veem perfis de terceiros por esta rota (403). |
| `PATCH /api/users/:id` | Próprio; ou **SUPER_ADMIN**; ou **ADMIN** na mesma instituição. Alteração de `role` por terceiros: **SUPER_ADMIN** ou **ADMIN**; ADMIN não pode promover a ADMIN. |

---

## 6. Alinhamento com o desenho de produto (`docs/final-role-model-design.md`)

- **Gestor vê todas as coletas da instituição:** coberto (ADMIN e GESTOR com a mesma cláusula de instituição).
- **Supervisor vê coletas próprias + avaliadores vinculados:** coberto.
- **Avaliador vê só as próprias coletas:** coberto.
- **Participante sem login:** coberto no modelo de dados; a API não autentica participante.
- **SUPER_ADMIN cria instituições:** coberto.
- **ADMIN seleciona instituição ao criar contas:** na prática o ADMIN está preso à sua instituição ao criar subordinados; **SUPER_ADMIN** define `institutionId` ao criar ADMIN e restantes.

---

## Lacunas conhecidas (documentar, não esconder)

1. **SUPER_ADMIN** não usa `POST /api/participants` neste estado (erro 400).
2. **Transferência institucional** (`reason = TRANSFER`, fecho de `valid_to`): tipo e tabela existem no SQL; **não há** rota dedicada documentada na API para transferir participante entre instituições — apenas `ENROLL` na criação/atualização com vínculo aberto.

---

## Participante global (validação de modelo)

| Conceito | Onde está no sistema |
|----------|----------------------|
| **Participante global** | Tabela `participants` com `cpf_normalized` único (`001_initial_aws_schema.sql`). Uma pessoa = um registo, independentemente da instituição. |
| **Sem login** | Não existe `cognito_sub` em `participants`; autenticação só para `app_users`. |
| **Vínculo atual** | `participant_institution_history` com `valid_to IS NULL` por par `(participant_id, institution_id)` em uso na API para listagens e para `POST /participants` (garante `ENROLL`). |
| **Histórico** | Linhas com `valid_to` preenchido e `reason` (`ENROLL`, `TRANSFER`, …) — **persistência pronta**; lógica de **transferência** entre instituições via API ainda a formalizar (ver lacuna acima). |
| **Coleta com instituição no momento** | `collections.institution_id_at_collection` NOT NULL — snapshot no insert (`collections.ts` reserve). Não altera retroativamente. |
| **Continuidade / políticas** | Tabela `data_continuity_policies` criada no schema; **regras de consulta** por política podem ser evolução futura da API. |
