# Git worktrees locais — APP60

Guia rápido para não confundir **staging** e **production** ao usar [git worktree](https://git-scm.com/docs/git-worktree).

Ajuste `WORK_APP60` ao caminho real da sua máquina (ex.: `/Users/.../Work_APP60`).

---

## Listar worktrees

Sempre que abrir um terminal novo, confira onde você está:

```bash
pwd
git worktree list
```

Saída esperada (exemplo):

- `.../APP60.git` — bare
- `.../app60-prod` — branch `main`
- `.../app60-staging` — branch `staging`

---

## Conferir a branch do workspace atual

```bash
git branch --show-current
```

- Em **`app60-prod`** → deve ser **`main`**.
- Em **`app60-staging`** → deve ser **`staging`**.

---

## Atualizar staging (`app60-staging`)

```bash
cd WORK_APP60/app60-staging
git branch --show-current   # staging
git fetch origin
git pull --ff-only origin staging
```

Se estiver em outra branch, volte antes do pull:

```bash
git switch staging
git pull --ff-only origin staging
```

---

## Atualizar production (`app60-prod`)

```bash
cd WORK_APP60/app60-prod
git branch --show-current   # main
git fetch origin
git pull --ff-only origin main
```

Só continue com build/release se `git status` estiver **limpo**.

---

## Evitar usar o workspace errado

1. **Olhe o prompt / path** — O final do caminho deve ser `app60-prod` ou `app60-staging`, não a pasta bare nem o backup.
2. **`git branch --show-current`** — `main` só em `app60-prod`; `staging` em `app60-staging`.
3. **Aliases (opcional)** — Ex.: `alias gcdprod='cd WORK_APP60/app60-prod'` e `alias gcdstg='cd WORK_APP60/app60-staging'`.
4. **Variáveis de ambiente** — Arquivos `.env` em um worktree não se aplicam ao outro; não copie `.env` de staging para prod sem revisão linha a linha.

---

## O que não usar como workspace de trabalho

| Caminho | Motivo |
|---------|--------|
| **`APP60.git`** | Repositório **bare**; não é checkout editável para desenvolvimento; não editar manualmente. |
| **`Work_APP60_OLD`** | Backup antigo; **não** usar para deploy nem como base de branch ativa. |

---

## Checagem mínima antes de alterar código ou fazer release

```bash
cd WORK_APP60/app60-prod    # ou app60-staging
pwd
git branch --show-current
git status
```

Em **production**: só prossiga se pasta for `app60-prod`, branch `main` e status limpo (ou alterações explicitamente intencionais).
