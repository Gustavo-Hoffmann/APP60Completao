# Plano de validação em Staging

Ambiente: **conta AWS Staging** (isolada de Production), conforme `docs/deployment-envs.md` e `docs/final-target-architecture.md`.

**Worker no Render:** o serviço Python continua no Render (ou equivalente); apenas a **stack de dados** deixa de ser Supabase e passa a **RDS + S3** via `DATABASE_URL` e credenciais AWS no painel do Render. Não há variáveis `SUPABASE_*`.

---

## 1. Autenticação

| Passo | Validação |
|-------|-----------|
| Login web | Cognito Hosted UI ou fluxo SPA; token JWT nas chamadas `Authorization: Bearer`. |
| Login mobile | `expo.extra` aponta para o **mesmo** pool/região de staging; `signIn` + `/api/me`. |
| Token expirado | Esperado: 401 nas rotas da API; front deve pedir novo login ou refresh conforme implementação Cognito. |

**Erros esperados:** `401` com segredo/bootstrap inválido; utilizador inativo em `/api/me`.

---

## 2. Criação de contas

| Fluxo | Como validar |
|-------|----------------|
| Primeiro SUPER_ADMIN | `POST /bootstrap/first-super-admin` (uma vez, com `BOOTSTRAP_SECRET`). |
| ADMIN / GESTOR / … | Web: fluxo de criação que chama `POST /api/users` (ver `UserCreatePage.tsx`). |
| Cognito | Utilizador aparece no pool; `app_users.cognito_sub` preenchido. |

**Erros esperados:** `409` bootstrap com DB não vazio; `403` papel sem permissão para criar; `400` CPF/e-mail inválidos.

---

## 3. Institutions

| Passo | Validação |
|-------|-----------|
| SUPER_ADMIN cria | `POST /api/institutions`; linha em `institutions` com `created_by_super_admin_id`. |
| ADMIN lista | `GET /api/institutions` retorna só a própria instituição. |

---

## 4. Participantes

| Passo | Validação |
|-------|-----------|
| Criar | `POST /api/participants` como ADMIN/GESTOR/SUPERVISOR/AVALIADOR na instituição. |
| Listar | `GET /api/participants` retorna só participantes com vínculo aberto na instituição (exceto SUPER_ADMIN). |
| SUPER_ADMIN | Lista global; criação via `POST` pode falhar com 400 até existir fluxo explícito (ver `docs/authorization-rules-matrix.md`). |

---

## 5. Coletas e storage

| Passo | Validação |
|-------|-----------|
| `GET .../next-session/...` | Número de sessão coerente. |
| `POST .../collections/reserve` | 201 com `uploadUrl` e `rawS3Key`; linha `collections` com `processing_status` adequado. |
| PUT S3 | Objeto aparece no bucket de staging. |
| `POST .../finalize-upload` | Status avança para fila do worker (`pending`). |
| Worker | Logs no Render: transição para `done`, linha em `collection_results`. |

**Erros esperados:** `404` participante sem vínculo na instituição; `400` SUPER_ADMIN sem instituição em `reserve`; falha de PUT se `Content-Type` não bater com a assinatura.

---

## 6. Visibilidade por papel

Executar cenários com utilizadores de teste (mesma instituição):

- **GESTOR:** vê todas as coletas da instituição nos resultados agregados.
- **SUPERVISOR:** só coletas suas + de avaliadores em `supervision_edges`.
- **AVALIADOR:** só coletas com `performed_by_user_id` = si.

Referência SQL em `participants.ts` (`collectionVisibilityClause`).

---

## 7. Dashboards e web

- Dashboards que usam mocks continuam independentes do backend; telas ligadas à API devem refletir dados reais de staging após seed manual mínimo.
- Validar listagens de utilizadores e participantes com cada papel.

---

## 8. APIs (smoke)

```bash
# Com TOKEN JWT válido de staging
curl -sS -H "Authorization: Bearer $TOKEN" "$API/api/me"
curl -sS -H "Authorization: Bearer $TOKEN" "$API/api/institutions"
curl -sS -H "Authorization: Bearer $TOKEN" "$API/api/participants"
curl -sS -H "Authorization: Bearer $TOKEN" "$API/api/users"
```

---

## 9. Critério de “staging aprovado”

- [ ] Bootstrap + pelo menos 1 instituição + 1 ADMIN + 1 avaliador com coleta completa S3 → worker `done`.
- [ ] Matriz de visibilidade testada para GESTOR / SUPERVISOR / AVALIADOR.
- [ ] Nenhum cliente aponta para URL Supabase; worker sem `SUPABASE_*` no painel Render.
