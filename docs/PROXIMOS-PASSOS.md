# Próximos passos (o que falta para o site funcionar 100%)

## ✅ Já pronto (feito e no ar)

- Banco no Supabase: 5 migrações aplicadas (tabelas, índices, RLS, perfis).
- Usuário admin criado: **admin@magno.com.br / senha `mago`** (papel administrador).
- **950 parâmetros** importados (idempotente: 2ª rodada = 0 novos, 950 inalterados).
- **855 de 950 parâmetros (90%)** com recorte da tela original + retângulo
  vermelho em `public/imagens-parametro/<id>.png` (95 ficaram para revisão —
  ver relatório em `docs/PLANO-IMAGENS.md`).
- Interface exibe o recorte no detalhe do parâmetro ("Localização na tela de origem").

## 🔴 FALTA 1 — chave pública do Supabase (bloqueia o site)

O site no GitHub Pages precisa das chaves públicas para ler o catálogo.
Sem elas ele mostra a tela "Falta configurar a conexão".

1. Supabase → seu projeto → **Project Settings → API Keys**.
2. Copie a chave **anon / publishable** (é pública, pode commitar como secret).
3. No GitHub: repositório **Magno-Parametros → Settings → Secrets and variables
   → Actions → New repository secret**, crie as duas:
   - `VITE_SUPABASE_URL` = `https://dmgmalzqywrjecvzbkjy.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = a chave copiada
4. **Actions → "Publicar no GitHub Pages" → Run workflow** (ou faça qualquer
   push para reexecutar).
5. Local (opcional): preencha `VITE_SUPABASE_ANON_KEY` no `.env`.

## 🟡 Falta 2 — conferir o login admin

1. Abra o site → **Entrar** → `admin@magno.com.br` / `mago`.
2. O badge no topo deve mostrar **administrador** (aí aparecem Importar,
   Novo parâmetro, renomear aba, mesclar tags).

## 🟡 Falta 3 — rotacionar segredos expostos no chat

- **Token do GitHub** `github_pat_11CAR…` — revogue em
  <https://github.com/settings/tokens> (não é mais necessário).
- **Senha do Postgres** (conexão direta) — troque em
  Supabase → **Database → Roles/Reset database password** e atualize o
  `DATABASE_URL` no `.env` local.

## 🟢 Melhorias futuras (fase 2)

1. **95 recortes pendentes**: melhorar casamento do OCR (rótulos truncados/
   compostos) ou marcar manualmente — rodar de novo com `--recarregar` depois
   de ajustar `scripts/marcar-imagens.ts`.
2. Sugestão automática de tags (a partir do caminho/grupo) com aprovação em lote.
3. Aplicar/remover tags em lote na listagem.
4. Exportação do catálogo completo no formato hierárquico de entrada.
5. Fila de documentação dedicada + gráficos de progresso.
6. Testes E2E (Playwright) e repositórios em memória para a suíte de contrato.
7. Senha do admin: trocar `mago` por algo forte em Authentication → Users.

## Comandos úteis

```bash
npm run migrar            # aplica novas migrações
npm run importar          # reimporta (idempotente)
npm run marcar-imagens    # gera recortes pendentes
npm run verificar-banco   # estado do banco
npm test                  # testes do domínio
npm run dev               # desenvolvimento local
```
