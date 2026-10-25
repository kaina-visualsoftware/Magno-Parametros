# Catálogo de Parâmetros · MyCommerce

Sistema web público de catálogo dos **~950 parâmetros** da tela
*Utilitários > Configuração > Administração do Sistema* do ERP MyCommerce,
com documentação colaborativa, tags e busca. Construído com **React + Supabase**
e publicado no **GitHub Pages**.

- **Leitura pública** — qualquer pessoa navega, busca e copia caminhos.
- **Escrita por papel** — `editor` documenta; `administrador` cria parâmetros,
  importa arquivos, gerencia telas/abas e mescla tags (garantido por RLS no Supabase).
- **Importação idempotente** — rodar N vezes não duplica nem sobrescreve
  documentação; conflitos entre origem e edições manuais viram relatório.

## Estrutura

```
magno-parametros/
├─ dados/origem/            # JSON de origem (somente leitura, fonte de verdade)
├─ docs/                    # DECISOES.md · ARQUITETURA.md (checklist SOLID)
├─ scripts/importar.ts      # CLI: npm run importar -- --arquivo ... [--dry-run]
├─ src/
│  ├─ dominio/              # entidades, calculadora de caminho, hash, tipos, mapeador, comparador, testes
│  ├─ aplicacao/            # caso de uso de importação + autenticação
│  ├─ servicos/             # casos de uso da interface
│  ├─ dados/                # portas (interfaces) + repositórios Supabase
│  ├─ componentes/ paginas/ # interface
│  └─ raiz-composicao.ts    # único ponto de instanciação concreta (DIP)
├─ supabase/schema.sql      # tabelas, RLS, trigger de perfis
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
npm run importar -- --arquivo dados/origem/parametros_myc_flat.json
```

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
npm test           # testes unitários do domínio
npm run build      # tsc --noEmit + build de produção
```

## Funcionalidades

- **Árvore** Tela → Aba → Subaba com contagem por nó e seletor de subabas.
- **Breadcrumb do ERP** em formato `Utilitários > Configuração > …` com
  *copiar caminho* (breadcrumb e por linha na página da tag).
- **Busca** sem diferença de acento/maiúscula em nome, descrição, "o que faz",
  grupo e caminho; filtros por tipo, status de documentação e origem.
- **Documentação**: campos de origem (somente leitura) vs. campos editáveis
  (`o_que_faz`, `impacto`, `valor_padrao`, `observacoes`, status) com
  **histórico de alterações** completo.
- **Tags**: criar, renomear, aplicar/remover, mesclar (com histórico), página da
  tag com caminho completo de cada parâmetro e **exportação CSV/JSON**.
  `Orçamento`, `orcamento` e `ORÇAMENTO` são a mesma tag.
- **Importação com dry-run** (na interface, admin) ou CLI; relatório com novos,
  alterados, inalterados, conflitos e alertas.
- **Novo parâmetro** (admin): seletor hierárquico de aba com pré-visualização
  em tempo real do caminho resultante.
- **Renomear aba** (admin): recalcula o caminho de todos os descendentes e
  preserva o nome original importado (abas truncadas como `Condici...`).

## Deploy no GitHub Pages

1. Repositório `magno-parametros` com o código na branch `main`.
2. Secrets do repositório: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
3. **Settings → Pages → Source: GitHub Actions**.
4. O workflow `.github/workflows/deploy.yml` publica a cada push em `main`.

## Segurança

- Documentação usa RPC com autorização, versão e auditoria atômica. Editores não
  podem atualizar diretamente parâmetros nem abas. Upserts administrativos
  também rejeitam versões desatualizadas.
- Instalações anteriores: siga `docs/PROXIMOS-PASSOS.md` para rotacionar as
  credenciais expostas e aplicar a migração 0006 antes de publicar o frontend.
- Testes locais e integração em banco descartável: `docs/TESTES.md`.

- RLS: `select` público; escrita conforme papel (`profiles.papel`).
- Nenhum segredo no repositório (`.env` no `.gitignore`; secrets no GitHub).
- O catálogo guarda **definições** de parâmetros — nunca valores configurados
  de clientes, senhas ou tokens.

> **Nota:** o token do GitHub usado na configuração inicial deste repositório
> ficou exposto na conversa — revogue-o em
> <https://github.com/settings/tokens> após confirmar o acesso.
