# Desenvolvimento e operação

[Voltar à apresentação do produto](../README.md)

## Ambiente

- Node.js 22+ e npm; documentação validada com Node.js 24.
- Projeto Supabase com PostgreSQL e Auth.
- Conexão PostgreSQL administrativa para aplicar migrações e importar a origem.

Os comandos devem ser executados na raiz do repositório. A instalação é feita com `npm ci`.

### Variáveis

| Variável | Onde é usada | Finalidade |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Frontend e build | URL do Supabase ou do proxy opcional. |
| `VITE_SUPABASE_ANON_KEY` | Frontend e build | Chave pública `anon` ou publishable. O acesso depende das políticas RLS. |
| `DATABASE_URL` | CLI, em `.env` | Conexão PostgreSQL para migrações e importação. Não é enviada ao frontend. |
| `TEST_DATABASE_URL` | Testes, no ambiente do processo | Banco PostgreSQL **local e descartável**, com nome terminado em `_test`. |
| `TEST_SCHEMA_SQL` | Testes, no ambiente do processo | `1` testa o esquema consolidado; sem a variável, a suíte aplica as migrações. |

O Vite carrega `.env` e `.env.local`; o segundo tem precedência. Os scripts CLI usam `process.loadEnvFile()` para carregar **somente `.env`**. A suíte de banco lê as variáveis do processo, sem esse carregador.

O `.env.example` também contém `VITE_GITHUB_TOKEN`, referenciado pelo formulário de relato de problemas. **Não preencha esse campo com um token privado:** o Vite o incorpora ao bundle público. Use as [issues do repositório](https://github.com/kaina-visualsoftware/Myc.config/issues) diretamente. Essa integração precisa ser revista antes de ser habilitada com credenciais.

## Preparar um projeto Supabase

### Aplicar o esquema

Em um projeto Supabase destinado ao seu ambiente de desenvolvimento, obtenha a URL e a chave pública. Configure as duas variáveis `VITE_SUPABASE_*` descritas no README e acrescente a conexão administrativa ao `.env`:

```dotenv
DATABASE_URL=postgresql://USUARIO:SENHA@HOST:5432/postgres
```

Copie a conexão do painel do Supabase. Se a rede não tiver IPv6, use o pooler em **modo sessão**, quando disponível. Caracteres especiais na senha devem ser codificados na URL.

```bash
npm run migrar
```

O comando aplica `migracoes/*.sql` em ordem, registra cada arquivo em `public._migracoes` e usa advisory lock para coordenar execuções concorrentes. Cada migração é transacional. Ele cria tabelas, perfis, políticas RLS e funções utilizadas pelo catálogo.

As migrações são o caminho de instalação e atualização. O arquivo `supabase/schema.sql` é uma versão consolidada; não o aplique em paralelo ao fluxo de migrações no mesmo banco.

### Importar a origem

```bash
npm run verificar-origem
npm run importar -- --arquivo dados/origem/parametros_myc_flat.json --dry-run
```

O primeiro comando valida o JSON sem conexão ao banco. O segundo lê o estado do banco e calcula uma prévia. Revise os conflitos e, para gravar no seu ambiente de desenvolvimento, execute:

```bash
npm run importar -- --arquivo dados/origem/parametros_myc_flat.json
```

O importador identifica registros por ID e hash dos campos de origem. Ele preserva os campos de documentação, sinaliza conflitos de origem editada manualmente e não apaga registros ausentes no arquivo. A execução converge ao reimportar; **não há uma única transação envolvendo toda a importação**.

O arquivo distribuído foi validado com 950 parâmetros, 55 abas e 29 tipos, sem alertas. Esses números descrevem a origem versionada, não o volume atual do site público.

### Criar o primeiro administrador

Depois das migrações, crie um usuário pelo painel **Authentication → Users** do Supabase, com e-mail e senha definidos por você. O trigger cria seu perfil como `leitor`.

No SQL Editor do mesmo projeto, promova **somente a conta escolhida**, substituindo o e-mail do exemplo:

```sql
update public.profiles as perfil
set papel = 'administrador'
from auth.users as usuario
where perfil.id = usuario.id
  and usuario.email = 'seu-email@example.com'
returning perfil.id, perfil.papel;
```

Confira se o retorno corresponde ao usuário esperado. Entre na aplicação com essa conta. Para conceder edição de documentação a outra pessoa, atribua `editor` ao seu perfil pelo mesmo procedimento.

| Acesso | Uso na aplicação |
| --- | --- |
| Visitante | Consulta pública do catálogo, detalhes e tags. |
| Leitor autenticado | Consulta e acesso ao histórico. |
| Editor | Documentação e criação/associação de tags. |
| Administrador | Criação de parâmetros, administração de abas, importação e gestão de tags. |

A autorização de dados é feita pelas políticas e funções do banco. O papel deve estar corretamente definido em `profiles`.

## Desenvolvimento e build

```bash
npm run dev
npm run typecheck
npm run build
npm run preview
```

- Desenvolvimento: `http://localhost:5173/`.
- Prévia de produção: `http://localhost:4173/Myc.config/`.
- Saída do build: `dist/`.
- Rotas internas usam `#`, por exemplo `/#/parametro/:id`.

O frontend precisa da conexão Supabase configurada. Não existe um modo demonstrativo offline na aplicação.

## Testes e limitações conhecidas

### Testes sem banco

```bash
npm test
npm run verificar-origem
```

Na revisão desta documentação, `npm test` concluiu com **38 testes aprovados e 41 pulados**. Os pulados pertencem à suíte de integração PostgreSQL, habilitada por `TEST_DATABASE_URL`. O build também passou, com um aviso do Vite sobre o tamanho do chunk principal acima de 500 kB.

### Integração PostgreSQL

Use uma instância local descartável, vazia, com usuário autorizado a criar roles e esquemas. A suíte cria `anon`, `authenticated`, `auth` e as tabelas de teste; não a aponte para um projeto Supabase compartilhado.

```bash
TEST_DATABASE_URL='postgresql://USUARIO:SENHA@localhost:5432/catalogo_test' npm test
```

O teste rejeita hosts remotos e nomes de banco que não terminam em `_test`. Para testar `supabase/schema.sql`, use `TEST_SCHEMA_SQL=1` em **outra instância limpa**.

### Navegador

A suíte funcional está em `e2e/catalogo.spec.ts` e usa respostas HTTP locais de teste. Instale o Chromium do Playwright, se necessário:

```bash
npx playwright install chromium
npm run test:e2e -- e2e/catalogo.spec.ts
```

**Pendência de configuração:** `playwright.config.ts` ainda usa `/Magno-Parametros/`, enquanto `vite.config.ts` gera e serve o build em `/Myc.config/`. Os caminhos de `use.baseURL` e `webServer.url` precisam ser alinhados ao Vite antes de executar a suíte com sucesso. As capturas do README são independentes dessa configuração e usam o site público real.

Na revisão, a tentativa de executar o cenário “tema persiste” terminou por timeout na espera do `webServer`, antes de iniciar o teste.

### Publicação

O workflow [Publicar no GitHub Pages](../.github/workflows/deploy.yml) instala dependências, executa testes, gera o build e publica `dist/` em pushes na `main` ou por acionamento manual.

No repositório de destino:

1. Selecione **GitHub Actions** como fonte do GitHub Pages.
2. Configure os secrets `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
3. Confira se `base` em `vite.config.ts` corresponde ao caminho do site.

O workflow atual ainda declara Node.js 20, abaixo do mínimo Node.js 22 exigido pelo SDK Supabase no lockfile atual. Alinhar o runtime do CI é uma pendência de manutenção. O build local desta revisão foi validado com Node.js 24.

## Imagens e recursos opcionais

- [Pipeline de OCR e destaque](PLANO-IMAGENS.md): usa imagens em `dados/imagens-origem/`, gera recortes em `public/imagens-parametro/` e atualiza os registros correspondentes no banco. Execute no ambiente que você administra.
- [Cloudflare Worker](../worker/README.md): proxy opcional para redes com restrição de acesso ao Supabase.
- [Produção visual do README](assets/README.md): capturas públicas e composições reproduzíveis.

### Escopo da validação desta documentação

Instalação conferida com `npm ci --dry-run`; testes sem banco, validação da origem e build executados. Os servidores de desenvolvimento e preview responderam nos caminhos documentados, mas a configuração local existente apontava para um backend em `127.0.0.1` indisponível (`ERR_CONNECTION_REFUSED`). Portanto, o carregamento local de dados não foi validado; a navegação com dados foi verificada no site público usado nas capturas.

Migrações, importação com gravação e promoção de usuário foram conferidas no código, sem execução contra o banco remoto. A integração PostgreSQL depende da instância descartável descrita acima.
