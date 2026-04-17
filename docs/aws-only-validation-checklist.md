# Checklist de validação AWS-only (Fase 3)

Use este documento como **gate** antes de declarar staging pronto ou antes de promover para production.

## A. Código e dependências

- [ ] `rg -i "@supabase|from ['\"]@supabase"` em `app60`, `app60web`, `API/app60-api/src`, `Worker` — **zero** resultados em código fonte.
- [ ] `app60/package.json` e `app60web/package.json` sem `@supabase/supabase-js`.
- [ ] `Worker/requirements.txt` sem pacote `supabase`.
- [ ] Diretório `API/supabase-backend/` **ausente** no checkout atual.
- [ ] Uploads mobile usam funções `upload*ToCollection` (não `*Supabase`).

## B. Configuração

- [ ] API: `DATABASE_URL`, `AWS_REGION`, `COGNITO_*`, `S3_RAW_BUCKET` definidos (staging).
- [ ] Web: `VITE_API_BASE_URL`, `VITE_COGNITO_*` apontam para recursos de **staging**.
- [ ] Mobile: `app.json` / EAS `extra` com URLs e pool de **staging**.
- [ ] Worker (Render): `DATABASE_URL` = RDS staging; AWS creds com acesso ao bucket staging; **sem** `SUPABASE_URL`.

## C. Schema e dados

- [ ] Migration `001_initial_aws_schema.sql` aplicada uma vez.
- [ ] Tabelas `institutions`, `app_users`, `participants`, `participant_institution_history`, `collections`, `collection_results`, `supervision_edges` presentes.

## D. Fluxos funcionais mínimos

- [ ] Bootstrap SUPER_ADMIN (ou utilizador inicial) + login.
- [ ] Criar instituição (SUPER_ADMIN).
- [ ] Criar ADMIN + AVALIADOR (com ou sem supervisor).
- [ ] Criar participante + vínculo `ENROLL`.
- [ ] Coleta: reserve → PUT S3 → finalize → worker `done`.
- [ ] Visibilidade: GESTOR vs SUPERVISOR vs AVALIADOR conforme `docs/authorization-rules-matrix.md`.

## E. Documentação

- [ ] `docs/bootstrap-from-zero.md` lido pela equipa de ops.
- [ ] `docs/cutover-checklist.md` atualizado com branches reais do vosso CI.

## F. Sign-off

- [ ] Responsável técnico assina staging OK.
- [ ] Data e commit SHA registados no sistema de tickets.

---

## Lista curta de validação manual (staging)

1. Login web com utilizador de teste Cognito.  
2. `GET /api/me` retorna `role` e `institution_id` esperados.  
3. Criar instituição (super admin) e depois ADMIN.  
4. Como ADMIN, criar GESTOR e AVALIADOR (com `supervisorId` se aplicável).  
5. Criar participante; confirmar vínculo na instituição.  
6. Mobile ou script: reservar coleta, fazer PUT no S3, finalizar; ver objeto no bucket.  
7. Worker processa e `collections.processing_status` = `done`.  
8. Comparar listagem de resultados entre GESTOR (vê tudo na instituição) e AVALIADOR (vê só o próprio).  
9. Tentativa de `POST /participants` como SUPER_ADMIN — esperar 400 até haver evolução documentada.  
10. Confirmar painel Render **sem** variáveis Supabase.

---

## Promover para production

Seguir **exatamente** `docs/cutover-checklist.md` secção “Promover staging → production”: merge para `main`, pipeline com envs **da conta production**, bootstrap separado se DB vazio, smoke tests, DNS/CORS.
