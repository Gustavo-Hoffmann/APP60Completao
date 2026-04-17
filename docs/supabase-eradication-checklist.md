# Checklist de erradicação do Supabase (Fase 3)

## Objetivo

Confirmar que **nenhum runtime** (apps, API, worker, dependências npm/pip) depende do Supabase.

## Verificação automatizada sugerida

Na raiz do repositório (excluindo `node_modules` e caches):

```bash
rg -i "supabase|@supabase" --glob '!**/node_modules/**' --glob '!**/.git/**'
```

## Resultado esperado no código executável

| Área | Estado |
|------|--------|
| `app60/package.json` | Sem `@supabase/supabase-js`. |
| `app60web/package.json` | Sem `@supabase/supabase-js`. |
| `Worker/requirements.txt` | Sem pacote `supabase`; usar `psycopg`, `boto3`. |
| Clientes TS/TSX/Py | Sem `import` de SDK Supabase. |
| Diretório `API/supabase-backend/` | **Removido** na Fase 3. |
| `app60web/supabase/` (CLI) | **Removido** na Fase 3. |

## Onde a palavra “Supabase” ainda pode aparecer (aceitável)

- **`docs/*.md`**: documentação histórica (`docs/aws-hard-cut-audit.md`, `docs/supabase-dependency-inventory.md`, `docs/aws-cutover-plan.md`, `docs/env-mapping-aws-only.md`, etc.) — referências ao legado ou ao contraste “antes/depois”.
- **`docs/supabase-removal-log.md`** e este ficheiro — registo explícito da remoção.

## Funções e comentários renomeados (Fase 3)

- Em `app60/src/services/tests/uploadTestJson.ts`, exports e helpers que continham `Supabase` no nome foram renomeados para `*ToCollection` / `*ToCollectionInternal` (upload via API + S3 presignado).

## Conclusão

- **Dependência de produto do Supabase:** **nenhuma** no código ativo listado acima.
- **Histórico no Git:** commits antigos ainda contêm o legado; o **HEAD** atual não inclui `API/supabase-backend/`.
