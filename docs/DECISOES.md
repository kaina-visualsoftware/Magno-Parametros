# Decisões e premissas (ADR resumido)

Registro das decisões técnicas tomadas na construção, em ordem de impacto.
Quando o enunciado original (arquitetura Fastify/NestJS + Postgres autogerenciado)
entrava em conflito com a stack solicitada pelo usuário (React + Supabase + GitHub
Pages), valeu a instrução final do usuário.

## 1. Stack

| Tema | Decisão |
| --- | --- |
| Front-end | React 18 + Vite + TypeScript (strict) + TanStack Query + React Router (HashRouter) |
| Backend | **Sem backend próprio.** Supabase (Postgres gerenciado + Auth + RLS) |
| Hospedagem | GitHub Pages (estático), workflow `deploy.yml` |
| Segurança | RLS no banco: leitura pública; escrita por papel (`leitor`/`editor`/`administrador`) via `profiles` |

**Por quê:** pedido explícito do usuário — "usando apenas react e supabase" e
"deve rodar no github pages, a principio deve ser publico, mas para criar um
parametro tem q ter usuario adm". A proteção de escrita fica nas políticas RLS
(a UI apenas esconde botões; o banco é quem garante).

## 2. Roteamento com HashRouter

O GitHub Pages não executa regras de rewrite (`404.html` hack é frágil). Com
`HashRouter`, rotas como `/#/parametro/:id` funcionam sem configuração de
servidor. Custo: URLs carregam `#` — aceitável para um catálogo interno.

## 3. Idempotência da importação (desvio consciente da seção 5.3)

O enunciado pedia "transação única: ou entra tudo ou nada". O cliente Supabase
não expõe transações multi-tabela. **Premissa adotada:** idempotência por
convergência — cada item é identificado por `id` (chave primária) e atualizado
via `upsert` condicionado ao `hash_origem` (SHA-256 dos campos de origem
normalizados). Rodar a importação N vezes leva sempre ao mesmo estado:

- novo → cria (`origem=importado`, `status_documentacao=pendente`);
- mesmo hash → ignora;
- hash diferente sem edição manual → atualiza **somente campos de origem**,
  preservando `o_que_faz`, `impacto`, `valor_padrao`, `observacoes`, status e tags;
- hash diferente **com** edição manual de origem (`editado_na_origem=true`) →
  **conflito**: não sobrescreve, lista no relatório;
- ausente no arquivo → nunca é apagado; vira alerta "não encontrado na origem".

A primeira carga valida `meta.total_parametros` (950): se o arquivo não tiver
exatamente esse total, a importação **falha** com relatório claro.

## 4. Busca textual sem `unaccent` em coluna gerada

`unaccent()` não é `IMMUTABLE`, logo não pode compor uma coluna gerada no
Postgres. **Premissa:** a coluna `parametros.texto_busca` é escrita pela
aplicação (domínio: `montarTextoBusca`) com nome + descrição original +
o_que_faz + grupo + caminho, normalizados (minúsculo, sem acentos). A busca usa
`ILIKE '%termo%'` sobre essa coluna com índice GIN `pg_trgm`. Vantagem: sem
dependência de extensões por projeto Supabase. Volume (≈950 linhas) torna a
solução imediata; migração para `tsvector`+`unaccent` fica documentada como
evolução possível.

## 5. Caminhos derivados, nunca digitados

`caminho` de abas e parâmetros é sempre recalculado a partir da árvore
(`CalculadoraCaminho`), nunca armazenado como entrada do usuário. Na importação,
o caminho calculado **prevalece** sobre o importado e divergências viram alertas.
Renomear uma aba recalcula o caminho de todos os descendentes e dos parâmetros
afetados, preservando `nome_original_importado`.

## 6. Detecção de abas truncadas

O arquivo flat não traz a flag `nome_truncado_na_tela` (ela existe só no
hierárquico). **Premissa:** aba cujo nome importado termina literalmente em
`...` (ex.: `Condici...`, `Caixa / ...`, `Financei...`) é marcada como truncada
e o nome original é preservado. Não é invenção de dados — apenas sinalização
do texto existente.

## 7. Identidade e ids estáveis

- Parâmetro: o `id` do arquivo é a identidade (nomes repetem-se em lugares
  diferentes e isso é esperado — ex.: "Bloquear Lançamento para cliente código 1").
- Aba: id determinístico = slug(`telaId/trilha/de/nomes`), estável entre
  importações. Parâmetros manuais novos: id = slug(`abaId--nome`).

## 8. Papéis e primeiro administrador

Toda conta nova nasce `leitor` (trigger no `auth.users`). O **primeiro
administrador é promovido via SQL** no painel do Supabase (comando documentado
no `schema.sql` e no README) — não há auto-cadastro de admin.

## 9. Tipos de parâmetro são dados, não código (OCP)

Tipos vivem na tabela `tipos_parametro` e, em memória, no registro de
`ManipuladorTipo`. Tipos desconhecidos vindos do arquivo (os 29 encontrados
incluem compostos como `checkbox_numero`, `cor_ordem_numero`) são criados
automaticamente e atendidos pelo `ManipuladorTipoGenerico`. Nenhum
`switch (tipo)` existe fora do registro.

## 10. Evidência de origem

`imagem_origem` é exibida como **referência textual** (nome do arquivo de
captura). Os PNGs não fazem parte do repositório; se um dia forem hospedados
(estático ou Supabase Storage), o campo está pronto para virar link.

## 11. Escopo da v1 e pendências

Entregue: árvore + breadcrumb + copiar caminho, listagens com filtros/paginação,
busca textual, documentação com histórico, tags (criar/renomear/aplicar/remover/
mesclar/página da tag com exportação CSV/JSON), importação idempotente com
dry-run (UI + CLI), criação manual de parâmetros (admin), renomeação de abas com
recálculo, papéis.

Pendências declaradas (fase 2): sugestão automática de tags com aprovação em
lote, aplicação/remoção de tags em lote na listagem, exportação do catálogo
completo no formato hierárquico de entrada, "fila de documentação" dedicada
(hoje acessível pelo filtro de status), suíte E2E com Playwright e a fonte JSON
hierárquica (a interface `FonteDeParametros` já está pronta para recebê-la).

## 12. Segredos

Nenhum segredo no repositório: `.env` está no `.gitignore`; o workflow de deploy
lê `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` de secrets do GitHub. A chave
`service_role` só é usada localmente pelo CLI de importação. O token GitHub
fornecido pelo usuário foi usado apenas para criar/push do repositório e deve
ser **revogado** após o uso.

## 13. Migrações e conexão direta (Postgres)

- O gerenciamento do banco passou a ser feito por **migrações versionadas**
  (`migracoes/*.sql`) aplicadas por `npm run migrar` via **conexão direta**
  (`DATABASE_URL`), com rastreio em `public._migracoes` e advisory lock.
- O host direto do projeto é **IPv6-only** e a rede local não tem IPv6; o
  Supavisor (pooler) do projeto está em `aws-1-sa-east-1.pooler.supabase.com`
  (modo sessão, porta 5432). A credencial fica apenas no `.env` local — nunca
  no repositório.
- A importação via CLI (`npm run importar`) usa um **segundo adaptador** de
  infraestrutura (`scripts/repositorio-pg.ts`, node-postgres) implementando as
  mesmas portas — mesmo domínio, mesmo caso de uso, outra infra (DIP/LSP).
- O **usuário administrador inicial** é criado pela migração 0004
  (`admin@magno.com.br` / senha `mago`), com inserção defensiva em `auth.users`
  + `auth.identities` (compatível com schemas novos e antigos do GoTrue) e
  papel promovido em `profiles`.

## 14. Recorte de imagem com destaque (melhoria)

Cada parâmetro passa a ter, quando possível, **a foto da tela original com um
retângulo vermelho em volta dele** — o usuário vê onde o parâmetro está sem
precisar ler nada. Pipeline (`npm run marcar-imagens`, detalhado em
`docs/PLANO-IMAGENS.md`): OCR da captura (cache por imagem) → correspondência
do rótulo por janela deslizante de palavras (variantes "grupo: item", cauda de
uma linha + trecho da seguinte para telas com duas colunas) → retângulo
desenhado com `sharp` → recorte com contexto salvo em
`public/imagens-parametro/<id>.png` → `parametros.imagem_marcada = true`.
A página de detalhe exibe o recorte automaticamente; os arquivos são servidos
pelo próprio GitHub Pages (sem storage adicional).
