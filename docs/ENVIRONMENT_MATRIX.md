# Matriz de ambientes — APP60 / SeniorSensePlus

Referência única para alinhar URLs, infraestrutura e workspaces locais. Valores de Cognito, buckets e connection strings devem ser obtidos apenas em consoles/secret managers oficiais — não duplicar segredos neste repositório.

## 1. Tabela de ambientes

| Ambiente | Finalidade | Domínio web | Domínio API | Banco | Buckets | Cognito | iOS `bundleIdentifier` | Android `package` | Canal EAS | Worker | Branch recomendada | Workspace local recomendado | Observações de risco |
|----------|------------|-------------|-------------|-------|---------|---------|------------------------|-------------------|-----------|--------|-------------------|----------------------------|----------------------|
| **DEV** | Desenvolvimento local; mobile no cabo; pode apontar para localhost ou staging | `localhost` / Vite dev / Expo dev | `localhost` ou API de **staging** (nunca production) | Local ou **staging** (nunca production) | **Staging** ou local; nunca bucket de production | **Staging** ou desligado em POC | `br.ufpr.app60` (ver `app60/app.json`) | `br.ufpr.app60` (ver `app60/app.json`) | `development` / dev client (conforme `eas.json` quando existir) | Opcional; se usar, apenas worker **staging** | feature branches / `staging` para integração | Qualquer clone; idealmente **`app60-staging`** para não poluir prod | Apontar `DATABASE_URL` ou Supabase de **production** por engano corrompe dados reais. |
| **STAGING** | Validação pré-produção; web pública de homologação; mobile interno (TestFlight/APK) | `https://staging.seniorsenseplus.com` | `https://api-staging.seniorsenseplus.com` | Banco **staging** (ex.: projeto Supabase/Postgres dedicado) | Buckets **staging** | Cognito **staging** | `br.ufpr.app60.staging` (ver `app60/app.json`) | `br.ufpr.app60` (ver `app60/app.json`) | `preview` / perfil interno (conforme política EAS do time) | Worker **staging** | **`staging`** | **`WORK_APP60/app60-staging`** | Escrita acidental em bucket/Cognito/banco de **production** vaza ou mistura dados. |
| **PRODUCTION** | Uso real; lojas oficiais; tráfego público | `https://seniorsenseplus.com`, `https://www.seniorsenseplus.com` | `https://api.seniorsenseplus.com` | Banco **production** | Buckets **production** | Cognito **production** | `br.ufpr.app60` (bundle de loja; sem sufixo `.staging`) | `br.ufpr.app60` | **`production`** (canal de loja) | Worker **production** | **`main`** | **`WORK_APP60/app60-prod`** | Um único `.env` ou URL errada afeta todos os usuários; deploy fora de `app60-prod` aumenta risco de branch/workspace errado; **antes de release**, confirmar que `app60/app.json` (e EAS) não apontam para `api-staging` nem pool Cognito de staging. |

> **Mobile:** Os identificadores acima vêm de `app60/app.json`. Se o time adotar bundle/package diferentes entre staging e production, atualize esta tabela e o app config correspondente.

> **EAS:** Existe `app60/eas.json`; confirme no ficheiro o mapeamento perfil/canal → ambiente e mantenha esta tabela alinhada.

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

- **Production** nunca aponta para `api-staging` (nem qualquer host só de homologação).
- **Production** nunca usa Cognito de **staging**.
- **Production** nunca usa bucket de **staging**.
- **Production** nunca usa `DATABASE_URL` (ou equivalente) de **staging**.
- **Production** nunca usa **worker** de staging (filas, tópicos ou credenciais de processamento de homologação).
- **Staging** nunca escreve em **banco** nem **bucket** de production.
- **Segredos reais** não entram no Git — usar `.env` local ignorado, secrets de CI, Parameter Store / Secrets Manager, etc.
- **Deploy de production** só pelo workspace **`app60-prod`** (branch `main`, árvore limpa).
- **Deploy de staging** só pelo workspace **`app60-staging`** (branch `staging`).
- **`APP60.git`** não deve ser editado manualmente.
- **`Work_APP60_OLD`** não deve ser usado para deploy.

---

## 4. Fluxo local recomendado

1. **Desenvolvimento do dia a dia** — Preferir trabalhar em **`app60-staging`**: branch `staging` (ou feature branches que mergeiam em `staging`), apontando app/web para API e banco de **staging** ou para mocks/local conforme a tarefa.

2. **Promoção para production** — Após revisão e testes em staging, integrar na **`main`** (via PR ou política do time) e puxar/atualizar **`app60-prod`**.

3. **Deploy de production** — Executar apenas com o working tree em **`app60-prod`**, na branch **`main`**, com **working tree limpo** (`git status` sem surpresas) e variáveis de ambiente de **production** carregadas no pipeline ou na máquina de release.

4. **Antes de build/deploy em prod** — Confirmar `pwd`, branch `main`, `git status` limpo, e que URLs (API, auth, storage) são as de **production** listadas nesta matriz.
