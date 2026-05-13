# Matriz de ambientes — APP60 / SeniorSensePlus

Referência única para alinhar URLs, infraestrutura e workspaces locais. Valores de Cognito, buckets e connection strings devem ser obtidos apenas em consoles/secret managers oficiais — não duplicar segredos neste repositório.

## 1. Tabela de ambientes

| Ambiente | Finalidade | Domínio web | Domínio API | Banco | Buckets | Cognito | iOS `bundleIdentifier` | Android `package` | Canal EAS | Worker | Branch recomendada | Workspace local recomendado | Observações de risco |
|----------|------------|-------------|-------------|-------|---------|---------|------------------------|-------------------|-----------|--------|-------------------|----------------------------|----------------------|
| **DEV** | Desenvolvimento local; mobile no cabo; pode apontar para localhost ou staging | `localhost` / Vite dev / Expo dev | `localhost` ou API de **staging** (nunca production) | Local ou **staging** (nunca production) | **Staging** ou local; nunca bucket de production | **Staging** ou desligado em POC | `br.ufpr.app60` (ver `app60/app.json`) | `br.ufpr.app60` (ver `app60/app.json`) | `development` / dev client (conforme `eas.json` quando existir) | Opcional; se usar, apenas worker **staging** | feature branches / `staging` para integração | Qualquer clone; idealmente **`app60-staging`** para não poluir prod | Apontar `DATABASE_URL` ou Supabase de **production** por engano corrompe dados reais. |
| **STAGING** | Validação pré-produção; web pública de homologação; mobile interno (TestFlight/APK) | `https://staging.seniorsenseplus.com` | `https://api-staging.seniorsenseplus.com` | Banco **staging** (ex.: projeto Supabase/Postgres dedicado) | Buckets **staging** | Cognito **staging** | `br.ufpr.app60` (confirmar se time usa bundle distinto para TF) | `br.ufpr.app60` (idem) | `preview` / perfil interno (conforme política EAS do time) | Worker **staging** | **`staging`** | **`WORK_APP60/app60-staging`** | Escrita acidental em bucket/Cognito/banco de **production** vaza ou mistura dados. |
| **PRODUCTION** | Uso real; lojas oficiais; tráfego público | `https://seniorsenseplus.com`, `https://www.seniorsenseplus.com` | `https://api.seniorsenseplus.com` | Banco **production** | Buckets **production** | Cognito **production** | `br.ufpr.app60` | `br.ufpr.app60` | **`production`** (canal de loja) | Worker **production** | **`main`** | **`WORK_APP60/app60-prod`** | Um único `.env` ou URL errada afeta todos os usuários; deploy fora de `app60-prod` aumenta risco de branch/workspace errado. |

> **Mobile:** Os identificadores acima vêm de `app60/app.json`. Se o time adotar bundle/package diferentes entre staging e production, atualize esta tabela e o app config correspondente.

> **EAS:** Não há `eas.json` versionado na raiz atual do monorepo em todos os clones; ao adicionar, documente aqui o mapeamento exato perfil → ambiente.

---

## 2. Estrutura local com git worktree

No disco, a pasta pai costuma ser `Work_APP60` (mesma ideia que `WORK_APP60` nos diagramas).

- **`app60-prod`** — Workspace de **produção**. Deve acompanhar a branch **`main`**. É o único lugar a partir do qual se deve promover/deployar código de production, após checklist e `git status` limpo.

- **`app60-staging`** — Workspace de **staging**. Deve acompanhar a branch **`staging`**. Usado para integração, testes de homologação e builds que falam com API/banco **staging**.

- **`APP60.git`** — Repositório **bare** compartilhado pelos worktrees. O Git grava aqui objetos e refs; **não editar arquivos manualmente** nesta pasta (risco de corromper o repositório).

- **`Work_APP60_OLD`** — Backup antigo do tree. **Não usar para deploy** nem como fonte da verdade do código; apenas arquivo histórico / contingência.

Comandos úteis: ver `docs/LOCAL_WORKTREES.md`.

---

## 3. Regras que nunca devem ser violadas

- **Production** nunca aponta para `api-staging` ou qualquer host de homologação.
- **Production** nunca usa Cognito, buckets, filas ou credenciais de **staging**.
- **Production** nunca usa `DATABASE_URL` (ou URL de projeto Supabase) de **staging**.
- **Production** nunca dispara o **worker** de staging contra filas/tópicos de production (ou o contrário).
- **Staging** nunca grava em banco ou bucket de **production**; jobs e webhooks de staging devem estar namespaced.
- **Segredos reais** (service role, chaves privadas, connection strings completas) **não entram no Git** — usar `.env` local ignorado, CI secrets, Parameter Store / Secrets Manager, etc.
- **Deploy de production** só a partir do workspace **`app60-prod`** (branch `main`, árvore limpa).
- **Deploy de staging** só a partir do workspace **`app60-staging`** (branch `staging`).
- **`APP60.git`** não deve ser editado manualmente fora do fluxo normal do Git.
- **`Work_APP60_OLD`** não deve ser usado para deploy nem como worktree ativo.

---

## 4. Fluxo local recomendado

1. **Desenvolvimento do dia a dia** — Preferir trabalhar em **`app60-staging`**: branch `staging` (ou feature branches que mergeiam em `staging`), apontando app/web para API e banco de **staging** ou para mocks/local conforme a tarefa.

2. **Promoção para production** — Após revisão e testes em staging, integrar na **`main`** (via PR ou política do time) e puxar/atualizar **`app60-prod`**.

3. **Deploy de production** — Executar apenas com o working tree em **`app60-prod`**, na branch **`main`**, com **working tree limpo** (`git status` sem surpresas) e variáveis de ambiente de **production** carregadas no pipeline ou na máquina de release.

4. **Antes de build/deploy em prod** — Confirmar `pwd`, branch `main`, `git status` limpo, e que URLs (API, auth, storage) são as de **production** listadas nesta matriz.
