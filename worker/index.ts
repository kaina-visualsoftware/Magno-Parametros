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
  GITHUB_ISSUES_TOKEN?: string;
  ISSUE_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
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


/** Endpoint de escrita: somente servidor possui o token do GitHub. */
async function criarSugestao(request: Request, env: Env, origem: string | null): Promise<Response> {
  const cors = origem ? cabecalhosCors(origem, request) : undefined;
  if (!origem || !origemPermitida(origem, env)) return respostaJson({ error: 'Origem não permitida' }, 403);
  if (request.method !== 'POST') return respostaJson({ error: 'Método não permitido' }, 405, cors);
  if (!env.GITHUB_ISSUES_TOKEN || !env.ISSUE_LIMITER) {
    return respostaJson({ error: 'Serviço de sugestões não configurado' }, 503, cors);
  }
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return respostaJson({ error: 'Envie JSON' }, 415, cors);
  }
  const tamanho = Number(request.headers.get('content-length') ?? 0);
  if (tamanho > 10_000) return respostaJson({ error: 'Solicitação muito grande' }, 413, cors);
  let dados: Record<string, unknown>;
  try {
    const texto = await request.text();
    if (texto.length > 10_000) return respostaJson({ error: 'Solicitação muito grande' }, 413, cors);
    const convertido: unknown = JSON.parse(texto);
    if (!convertido || typeof convertido !== 'object' || Array.isArray(convertido)) throw new Error();
    dados = convertido as Record<string, unknown>;
  } catch {
    return respostaJson({ error: 'JSON inválido' }, 400, cors);
  }
  if (typeof dados.descricao !== 'string' || dados.descricao.trim().length < 10 ||
      dados.descricao.length > 4000 || (dados.parametro !== undefined &&
      (typeof dados.parametro !== 'string' || dados.parametro.length > 400))) {
    return respostaJson({ error: 'Informe uma descrição de 10 a 4000 caracteres e uma referência de até 400 caracteres' }, 400, cors);
  }
  // Campo oculto (honeypot) evita bots básicos, sem constranger visitantes legítimos.
  if (dados.site !== undefined && dados.site !== '') {
    return respostaJson({ error: 'Solicitação inválida' }, 400, cors);
  }
  const ip = request.headers.get('CF-Connecting-IP');
  // Sem IP confiável da Cloudflare, não existe chave segura para limite por visitante.
  if (!ip) return respostaJson({ error: 'Origem da solicitação não verificada' }, 403, cors);
  try {
    const limite = await env.ISSUE_LIMITER.limit({ key: ip });
    if (!limite.success) return respostaJson({ error: 'Muitas sugestões. Tente novamente mais tarde.' }, 429, cors);
  } catch {
    return respostaJson({ error: 'Proteção temporariamente indisponível' }, 503, cors);
  }

  const referencia = typeof dados.parametro === 'string' ? dados.parametro.trim() : '';
  const titulo = referencia ? `Sugestão de parâmetro: ${referencia.slice(0, 110)}` : 'Sugestão de parâmetro ou correção';
  const corpo = [
    '## Descrição', dados.descricao.trim(), '',
    referencia ? `**Referência do parâmetro:** ${referencia}` : '',
    '', '---', 'Enviado pelo catálogo público de parâmetros do MyCommerce.',
  ].filter(Boolean).join('\n');

  try {
    const resposta = await fetch('https://api.github.com/repos/kaina-visualsoftware/Myc.config/issues', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.GITHUB_ISSUES_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'magno-parametros-sugestoes/1.0',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ title: titulo, body: corpo }),
    });
    if (!resposta.ok) {
      return respostaJson({ error: resposta.status === 401 || resposta.status === 403
        ? 'Integração GitHub indisponível' : 'Não foi possível registrar a sugestão' }, 502, cors);
    }
    const issue: unknown = await resposta.json();
    if (!issue || typeof issue !== 'object' ||
        typeof (issue as { html_url?: unknown }).html_url !== 'string' ||
        !/^https:\/\/github\.com\/kaina-visualsoftware\/Myc\.config\/issues\/\d+$/.test((issue as { html_url: string }).html_url)) {
      return respostaJson({ error: 'Resposta inesperada do GitHub' }, 502, cors);
    }
    return respostaJson({ url: (issue as { html_url: string }).html_url }, 201, cors);
  } catch {
    return respostaJson({ error: 'Falha ao contatar o GitHub' }, 502, cors);
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

  if (url.pathname === '/api/sugestoes') return criarSugestao(request, env, origem);

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
