# Proxy Cloudflare Worker

Alternativa para redes/navegadores que bloqueiam chamadas diretas ao
`supabase.co`. O navegador fala com o Worker em `workers.dev`; o Worker
repassa `/rest/v1/*` e `/auth/v1/*` ao Supabase e devolve os headers CORS
para a origem do catálogo.

O proxy de Supabase não usa segredos: a chave publishable continua sendo enviada
pelo cliente e repassada ao Supabase. O RLS continua protegendo os dados.\nO endpoint de sugestões usa um segredo GitHub exclusivo do Worker (veja abaixo).

## Pré-requisitos

- Conta Cloudflare com Workers habilitado.
- Acesso ao repositório para trocar a secret `VITE_SUPABASE_URL`.

## Deploy

```bash
cd worker
npx wrangler login
npx wrangler deploy
```

Anote a URL publicada, por exemplo:

```text
https://magno-parametros-proxy.SEU-SUBDOMINIO.workers.dev
```

Depois, no GitHub do catálogo:

1. **Settings → Secrets and variables → Actions**.
2. Edite `VITE_SUPABASE_URL` para a URL do Worker.
3. Rode o workflow **Publicar no GitHub Pages**.
4. Recarregue o site.

O frontend não precisa de alteração: `@supabase/supabase-js` usa a URL base e
concatena `/rest/v1` e `/auth/v1`.

## Desenvolvimento local

```bash
cd worker
npx wrangler dev
```

O `ALLOWED_ORIGINS` padrão inclui `http://localhost:5173`.

## Limitações e riscos

- O Worker em `workers.dev` é outra origem; o CORS é resolvido por ele, mas
  redes que bloqueiam `workers.dev` também podem falhar. Domínio customizado
  reduz esse risco, com custo/configuração extra.
- OAuth que dependa de redirect direto ao Supabase pode exigir ajuste; o app
  usa login por senha (`signInWithPassword`).
- O plano gratuito do Workers tem limite de requisições. O tráfego do catálogo
  deve ser baixo; monitore em Cloudflare → Workers → Metrics.
- O Worker é público e aceita chamadas sem `Origin` (curl/testes), mas só
  repassa caminhos permitidos. A autorização real continua no Supabase (RLS).
- Não coloque `service_role` no Worker nem no frontend.

## Verificação

Com o Worker no ar, no navegador:

```text
https://SEU-WORKER.workers.dev/rest/v1/parametros?select=id&limit=1
```

Com a `apikey` correta, deve retornar dados e headers CORS da origem do site.
Para testar o preflight:

```bash
curl -i -X OPTIONS \
  -H 'Origin: https://kaina-visualsoftware.github.io' \
  -H 'Access-Control-Request-Method: GET' \
  https://SEU-WORKER.workers.dev/rest/v1/parametros
```


## Enviar sugestões como Issues (sem login GitHub)

O Worker também disponibiliza `POST /api/sugestoes`, acessível somente pelo
formulário na origem definida em `ALLOWED_ORIGINS`. Recebe JSON
`{ "descricao": "texto com pelo menos 10 caracteres", "parametro": "referência opcional" }`.
Retorna status `201` e a URL real da issue quando o GitHub confirmar a criação.

**Configuração obrigatória no Cloudflare (no diretório `worker/`):**

1. Crie um token **fine-grained** no GitHub, limitado somente ao repositório
   `kaina-visualsoftware/Myc.config`, com permissão **Issues: Read and write**.
   Não conceda Contents ou permissões de organização. O token deve ser guardado
   somente como segredo do Worker, nunca em `VITE_*` ou `wrangler.toml`.
2. Execute `npx wrangler secret put GITHUB_ISSUES_TOKEN` e cole o valor quando solicitado.
3. Execute `npx wrangler deploy` para publicar o endpoint atualizado.
4. No repositório GitHub, acesse **Settings → Secrets and variables → Actions → Variables**
   e defina `VITE_ISSUES_API_URL` com a URL base do Worker, como
   `https://magno-parametros-proxy.SEU-SUBDOMINIO.workers.dev`.
   Se `VITE_SUPABASE_URL` já aponta para esse Worker, a configuração extra é opcional.
5. Publique novamente o GitHub Pages após atualizar a variável.

O Worker usa um binding Cloudflare de **3 envios por minuto por IP e localização**,
valida corpo e tamanhos, rejeita origens de outros sites e usa um honeypot.
O limite do Cloudflare é regional e não é uma proteção global infalível; monitore
as Issues, configure regras de segurança adicionais (como Turnstile/WAF) se
houver abuso, e ajuste os limites antes de ampliar o tráfego.

Sem o segredo ou o binding, o endpoint responde `503` e não cria issues;
nenhum token é incluído na resposta. O Worker atual precisa ser redeployado:
apenas alterar o frontend no GitHub Pages não ativa a integração.
