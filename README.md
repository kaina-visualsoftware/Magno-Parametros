# Catálogo de Parâmetros · MyCommerce

Sistema web público de catálogo dos **~950 parâmetros** da tela
*Utilitários > Configuração > Administração do Sistema* do ERP MyCommerce,
com documentação colaborativa, tags e busca. Construído com **React + Vite +
Supabase + Tailwind CSS** e publicado no **GitHub Pages**.

- **Leitura pública** — catálogo paginado no servidor, busca e filtros compartilháveis por URL.
- **Tema claro/escuro** — escuro por padrão, persistido no navegador e aplicado antes da primeira pintura.
- **Escrita por papel** — `editor` documenta; `administrador` cria parâmetros,
  importa arquivos, gerencia telas/abas e mescla tags (garantido por RLS no Supabase).
- **Importação idempotente** — rodar N vezes não duplica nem sobrescreve
  documentação; conflitos entre origem e edições manuais viram relatório.

## Estrutura

```
magno-parametros/
├─ dados/origem/            # JSON de origem (somente leitura, fonte de verdade)
├─ docs/                    # DECISOES.md · ARQUITETURA.md (checklist SOLID)
├─ migracoes/               # migrações SQL versionadas (npm run migrar)
├─ e2e/                     # fluxos de navegador com Playwright
├─ scripts/importar.ts      # CLI: npm run importar -- --arquivo ... [--dry-run]
├─ src/
│  ├─ dominio/              # entidades, caminho, hash, tipos, mapeador, filtros do catálogo
│  ├─ aplicacao/            # caso de uso de importação + autenticação
│  ├─ servicos/             # casos de uso da interface
│  ├─ dados/                # portas (interfaces) + repositórios Supabase
│  ├─ componentes/ paginas/ # interface
│  └─ raiz-composicao.ts    # único ponto de instanciação concreta (DIP)
├─ supabase/schema.sql      # instalação completa gerada de migracoes/*.sql
└─ .github/workflows/       # deploy automático para o GitHub Pages
```

## Passo a passo de instalação

### 1. Criar o projeto no Supabase

1. Crie um projeto em <https://supabase.com> (plano gratuito serve).
2. Prefira `npm run migrar` após configurar `DATABASE_URL`. Como alternativa,
   abra **SQL Editor** e execute o conteúdo completo de `supabase/schema.sql`.
   Ele cria tabelas, índices, políticas RLS e o trigger de perfis.
3. Em **Project Settings → API**, copie a *Project URL* e a *anon key*.

### 2. Configurar o ambiente

```bash
cp .env.example .env
# preencha:
#   VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
#   VITE_SUPABASE_ANON_KEY=...
#   SUPABASE_URL=https://SEU-PROJETO.supabase.co
#   SUPABASE_SERVICE_ROLE_KEY=...   (só para o CLI de importação)
```

### 3. Criar o usuário administrador e promovê-lo

1. No Supabase: **Authentication → Users → Add user** (e-mail + senha).
2. Ainda no SQL Editor, promova o papel:

```sql
update public.profiles
   set papel = 'administrador'
 where id = (select id from auth.users where email = 'voce@empresa.com.br');
```

Toda conta nova nasce `leitor` automaticamente.

### 4. Migrações e importação

```bash
npm install
npm run migrar        # aplica migracoes/*.sql (rastreio em _migracoes)
npm run gerar-schema  # mantém supabase/schema.sql igual às migrações
npm run importar -- --arquivo dados/origem/parametros_myc_flat.json
```

A migração `0007_catalogo_cursor.sql` é obrigatória para esta versão da
interface: o catálogo usa as RPCs `listar_parametros_catalogo` e
`listar_tags_com_contagem`. Aplique-a **antes** de publicar o frontend.

Saída esperada na primeira carga: **950 novos**, 0 conflitos. Rodando de novo:
**0 novos, 950 inalterados**. Para simular sem gravar, adicione `--dry-run`.
O `.env` precisa de `DATABASE_URL` (conexão Postgres — use a connection string
do painel; projetos novos geralmente ficam no pooler
`aws-1-<região>.pooler.supabase.com`).

### 4.1. Imagens com destaque (retângulo vermelho)

```bash
# extraia o zip "parametros myc" em dados/imagens-origem/
npm run marcar-imagens          # OCR + recorte com retângulo vermelho
```

Gera `public/imagens-parametro/<id>.png` e marca `imagem_marcada` — o detalhe
do parâmetro passa a mostrar a foto com o parâmetro destacado.

### 5. Desenvolvimento

```bash
npm run dev        # http://localhost:5173
npm run typecheck  # TypeScript sem emitir
npm test           # testes unitários + integração SQL (se TEST_DATABASE_URL estiver definido)
npm run test:e2e   # Playwright (build + preview locais)
npm run build      # tsc --noEmit + build de produção
```

## Funcionalidades

- **Catálogo** em lista única, sem menu lateral: busca com debounce, filtros por
  tipo, documentação, origem, tags (`E`/`OU`), parâmetros sem tag e
  ativos/inativos; ordenação e filtros ficam na URL e sobrevivem a recarregar.
- **Paginação por cursor** com “Carregar mais”, sem `count` exato nem download
  de todos os vínculos de tags. A RPC roda como `security invoker` e respeita a RLS.
- **Breadcrumb do ERP** em formato `Utilitários > Configuração > …` com
  *copiar caminho* (breadcrumb e por linha no catálogo).
- **Busca** sem diferença de acento/maiúscula em nome, descrição, "o que faz",
  grupo e caminho; `%` e `_` são tratados como texto literal.
- **Tema** claro/escuro com ícones Lucide, layout responsivo de 320 px a telas
  grandes, foco visível e diálogos nativos acessíveis.
- **Documentação**: campos de origem (somente leitura) vs. campos editáveis
  (`o_que_faz`, `impacto`, `valor_padrao`, `observacoes`, status) com
  **histórico de alterações** carregado somente ao abrir e para usuários autenticados.
- **Tags**: criar, renomear, aplicar/remover e mesclar (com histórico); página da
  tag com o mesmo catálogo paginado e **exportação explícita dos itens carregados**.
  `Orçamento`, `orcamento` e `ORÇAMENTO` são a mesma tag.
- **Telas e abas** (admin): página dedicada para renomear abas truncadas, sem
  árvore como menu lateral no catálogo.
- **Importação com dry-run** (na interface, admin) ou CLI; relatório com novos,
  alterados, inalterados, conflitos e alertas.
- **Novo parâmetro** (admin): seletor hierárquico de aba com pré-visualização
  em tempo real do caminho resultante.
- **Renomear aba** (admin, página Abas): recalcula o caminho de todos os
  descendentes e preserva o nome original importado (abas truncadas como `Condici...`).

## Deploy no GitHub Pages

1. Repositório `magno-parametros` com o código na branch `main`.
2. Secrets do repositório: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
3. **Settings → Pages → Source: GitHub Actions**.
4. O workflow `.github/workflows/deploy.yml` publica a cada push em `main`.

## Configuração de produção

Ao implantar a aplicação em um domínio diferente (por exemplo, GitHub Pages), adicione o URL da sua aplicação à lista **Redirect URLs** e **Site URL** nas configurações do Supabase Auth (Dashboard → Authentication → Settings). Caso contrário, as requisições de login sofrerão erro CORS como o apresentado.

## Segurança

- Documentação usa RPC com autorização, versão e auditoria atômica. Editores não
  podem atualizar diretamente parâmetros nem abas. Upserts administrativos
  também rejeitam versões desatualizadas.
- Instalações anteriores: siga `docs/PROXIMOS-PASSOS.md` para rotacionar as
  credenciais expostas e aplicar as migrações 0006 e 0007 antes de publicar o frontend.
- O catálogo não expõe `service_role`; a chave pública só lê o que a RLS permite.
  O histórico de parâmetros exige sessão autenticada.
- Testes locais e integração em banco descartável: `docs/TESTES.md`.

- RLS: `select` público; escrita conforme papel (`profiles.papel`).
- Nenhum segredo no repositório (`.env` no `.gitignore`; secrets no GitHub).
- O catálogo guarda **definições** de parâmetros — nunca valores configurados
  de clientes, senhas ou tokens.

> **Nota:** o token do GitHub usado na configuração inicial deste repositório
> ficou exposto na conversa — revogue-o em
> <https://github.com/settings/tokens> após confirmar o acesso.
