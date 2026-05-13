# Scripts de segurança de ambiente

## `scripts/check-env-safety.sh`

Script de **checagem de coerência** entre:

- diretório atual (caminho do worktree);
- branch Git;
- nome do perfil AWS (`AWS_PROFILE`);
- região (`AWS_REGION`);
- identidade retornada por `aws sts get-caller-identity` (Account, Arn, UserId — sem chaves de acesso).

Ele **não** altera infraestrutura, **não** faz deploy, **não** roda migrations e **não** grava segredos no repositório.

### Para que serve

Reduz o risco de rodar pipelines, comandos de release ou `supabase db push` no **workspace ou perfil AWS errados**, comparando o alvo declarado (`staging` ou `production`) com o contexto real do terminal.

### Exemplos de uso

Na raiz do repositório (ou em qualquer subpasta do mesmo worktree), com o ambiente shell já configurado (`AWS_PROFILE`, etc.):

```bash
./scripts/check-env-safety.sh production
./scripts/check-env-safety.sh staging
```

Sem argumento ou com argumento inválido, o script imprime o uso e sai com código diferente de zero.

### Por que rodar antes de deploy

Deploy e migrations costumam usar credenciais e URLs do ambiente atual. Um erro clássico é estar em `app60-staging` com credenciais de production (ou o contrário). O script **falha cedo** com mensagem clara quando:

- o caminho não contém o worktree esperado (`app60-prod` vs `app60-staging`);
- a branch não bate com o alvo (`main` vs `staging`);
- o caminho indica pastas proibidas (`APP60.git`, `Work_APP60_OLD`, ou mistura prod/staging no path);
- `AWS_PROFILE` **parece** ser do ambiente oposto (heurística por substring).

Assim, um pipeline pode começar com `./scripts/check-env-safety.sh production` e só continuar se o exit code for `0`.

### Limitações (não substitui atenção humana)

- Heurísticas de nome de perfil podem gerar **falsos positivos** ou **avisos** em perfis neutros (`default`, nomes internos sem `prod`/`staging`).
- A identidade AWS vem das credenciais ativas; **confira** se a conta/ARN corresponde ao ambiente desejado.
- O script não valida URLs de API, `DATABASE_URL` nem buckets — isso continua sendo revisão humana e configuração segura de CI.

### Onde cada ambiente deve ser implantado

- **Production** só deve ser deployada a partir do workspace **`app60-prod`** (branch **`main`**), conforme a matriz em `docs/ENVIRONMENT_MATRIX.md`.
- **Staging** só deve ser deployada a partir do workspace **`app60-staging`** (branch **`staging`**).

### AWS: apenas leitura

O único comando AWS usado é `sts get-caller-identity` (leitura). Não há criação nem alteração de recursos.
