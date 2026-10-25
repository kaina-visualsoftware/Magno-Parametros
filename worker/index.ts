/**
 * Proxy Cloudflare Worker para o Supabase.
 *
 * O navegador fala com este Worker (origem do GitHub Pages) e o Worker fala
 * com o Supabase. Assim o CORS é controlado aqui, sem depender da configuração
 * do projeto Supabase. A chave publishable continua vindo do cliente; o Worker
 * não armazena segredos.
 */

export interface Env {
  SUPABASE_URL: string;
  ALLOWED_ORIGINS: string;
}

const CAMINHOS_PERMITIDOS = ['/rest/v1', '/auth/v1'];
const METODOS_PERMITIDOS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);

// Headers do navegador/Cloudflare que não devem ser repassados ao Supabase.
const CABECALHOS_REMOVER = new Set([
  'host',
  'connection',
  'content-length',
  'origin',
  'referer',
  'cookie',
  'cf-connecting-ip',
  'cf-ipcountry',
  'cf-ray',
  'cf-visitor',
  'x-forwarded-for',
  'x-forwarded-proto',
  'x-real-ip',
]);

// Headers do Supabase que não devem ser repassados ao navegador.
const CABECALHOS_RESPOSTA_REMOVER = new Set([
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'connection',
  'set-cookie',
]);

function origensPermitidas(env: Env): string[] {
  return (env.ALLOWED_ORIGINS || 'https://kaina-visualsoftware.github.io')
    .split(',')
    .map((origem) => origem.trim())
    .filter(Boolean);
}

function origemPermitida(origem: string | null, env: Env): boolean {
  return origem !== null && origensPermitidas(env).includes(origem);
}

function cabecalhosCors(origem: string, request: Request): Headers {
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', origem);
  headers.set('Vary', 'Origin');
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS');
  headers.set(
    'Access-Control-Allow-Headers',
    request.headers.get('Access-Control-Request-Headers') ||
      'authorization, apikey, content-type, x-client-info, prefer, x-supabase-api-version',
  );
  headers.set(
    'Access-Control-Expose-Headers',
    'Content-Encoding, Content-Location, Content-Range, Content-Type, Date, Location, Server, Transfer-Encoding, Range-Unit',
  );
  headers.set('Access-Control-Max-Age', '86400');
  return headers;
}

function respostaJson(corpo: unknown, status: number, cors?: Headers): Response {
  const headers = new Headers(cors);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(corpo), { status, headers });
}

function validarSupabaseUrl(valor: string): URL | null {
  try {
    const url = new URL(valor);
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co')) return null;
    return url;
  } catch {
    return null;
  }
}

export async function processarRequisicao(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const origem = request.headers.get('Origin');
  const permitida = origemPermitida(origem, env);

  if (origem && !permitida) {
    return respostaJson({ error: 'Origem não permitida' }, 403);
  }

  if (!METODOS_PERMITIDOS.has(request.method)) {
    return respostaJson({ error: 'Método não permitido' }, 405, permitida ? cabecalhosCors(origem!, request) : undefined);
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: permitida ? cabecalhosCors(origem!, request) : undefined,
    });
  }

  const caminhoPermitido = CAMINHOS_PERMITIDOS.some(
    (caminho) => url.pathname === caminho || url.pathname.startsWith(`${caminho}/`),
  );
  if (!caminhoPermitido) {
    return respostaJson({ error: 'Caminho não permitido' }, 404, permitida ? cabecalhosCors(origem!, request) : undefined);
  }

  const base = validarSupabaseUrl(env.SUPABASE_URL);
  if (!base) {
    return respostaJson({ error: 'SUPABASE_URL ausente ou inválida' }, 500, permitida ? cabecalhosCors(origem!, request) : undefined);
  }

  const destino = new URL(url.pathname + url.search, base);
  const cabecalhos = new Headers(request.headers);
  for (const cabecalho of CABECALHOS_REMOVER) cabecalhos.delete(cabecalho);
  cabecalhos.set('User-Agent', 'magno-parametros-proxy/1.0');

  const init: RequestInit = {
    method: request.method,
    headers: cabecalhos,
    redirect: 'manual',
  };
  if (!['GET', 'HEAD'].includes(request.method)) {
    init.body = await request.arrayBuffer();
  }

  let resposta: Response;
  try {
    resposta = await fetch(destino.toString(), init);
  } catch {
    return respostaJson(
      { error: 'Falha ao contatar o Supabase' },
      502,
      permitida ? cabecalhosCors(origem!, request) : undefined,
    );
  }

  const cabecalhosResposta = new Headers(resposta.headers);
  for (const cabecalho of CABECALHOS_RESPOSTA_REMOVER) cabecalhosResposta.delete(cabecalho);
  for (const cabecalho of [...cabecalhosResposta.keys()]) {
    if (cabecalho.startsWith('access-control-')) cabecalhosResposta.delete(cabecalho);
  }
  if (permitida) {
    for (const [nome, valor] of cabecalhosCors(origem!, request)) {
      cabecalhosResposta.set(nome, valor);
    }
  }

  return new Response(resposta.body, {
    status: resposta.status,
    statusText: resposta.statusText,
    headers: cabecalhosResposta,
  });
}

export default {
  fetch: processarRequisicao,
};
