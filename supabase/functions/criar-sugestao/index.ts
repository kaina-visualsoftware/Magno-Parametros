// Supabase Edge Function pública para sugestões de parâmetros.
// Configurar GITHUB_ISSUES_TOKEN em Edge Functions > Secrets.
const ORIGENS = new Set([
  'https://kaina-visualsoftware.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
]);

function resposta(corpo: Record<string, unknown>, status: number, origem?: string): Response {
  const headers = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  if (origem) {
    headers.set('access-control-allow-origin', origem);
    headers.set('vary', 'Origin');
    headers.set('access-control-allow-methods', 'POST, OPTIONS');
    headers.set('access-control-allow-headers', 'content-type, apikey, authorization, x-client-info');
  }
  return new Response(JSON.stringify(corpo), { status, headers });
}

async function hashIdentificador(valor: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(valor));
  return [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (request) => {
  const origem = request.headers.get('origin');
  if (!origem || !ORIGENS.has(origem)) return resposta({ error: 'Origem não permitida' }, 403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: {
    'access-control-allow-origin': origem, 'vary': 'Origin',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type, apikey, authorization, x-client-info',
    'access-control-max-age': '86400',
  } });
  if (request.method !== 'POST') return resposta({ error: 'Método não permitido' }, 405, origem);
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return resposta({ error: 'Envie JSON' }, 415, origem);
  }
  if (Number(request.headers.get('content-length') || '0') > 9000) {
    return resposta({ error: 'Solicitação muito grande' }, 413, origem);
  }

  let corpo: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 9000) return resposta({ error: 'Solicitação muito grande' }, 413, origem);
    const entrada: unknown = JSON.parse(raw);
    if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) throw new Error('JSON inválido');
    corpo = entrada as Record<string, unknown>;
  } catch {
    return resposta({ error: 'JSON inválido' }, 400, origem);
  }
  const descricao = typeof corpo.descricao === 'string' ? corpo.descricao.trim() : '';
  const parametro = typeof corpo.parametro === 'string' ? corpo.parametro.trim() : '';
  if (descricao.length < 10 || descricao.length > 4000 || parametro.length > 400 ||
      (corpo.parametro !== undefined && typeof corpo.parametro !== 'string')) {
    return resposta({ error: 'Descrição entre 10 e 4000 caracteres e referência de até 400 caracteres.' }, 400, origem);
  }
  if (corpo.site) return resposta({ error: 'Solicitação inválida' }, 400, origem);

  const token = Deno.env.get('GITHUB_ISSUES_TOKEN');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serverKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!token || !supabaseUrl || !serverKey) {
    return resposta({ error: 'Envio automático ainda não configurado.' }, 503, origem);
  }

  // O endereço vem da borda do serviço, nunca do formulário.
  const ip = request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim();
  if (!ip || ip.length > 128) return resposta({ error: 'Não foi possível verificar o limite de envios.' }, 403, origem);

  const hash = await hashIdentificador(ip);
  try {
    const limite = await fetch(`${supabaseUrl}/rest/v1/rpc/consumir_limite_sugestao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': serverKey, 'Authorization': `Bearer ${serverKey}` },
      body: JSON.stringify({ p_chave: hash }),
      signal: AbortSignal.timeout(8000),
    });
    if (!limite.ok) return resposta({ error: 'Não foi possível verificar o limite de envios.' }, 503, origem);
    if (await limite.json() !== true) return resposta({ error: 'Limite de sugestões atingido. Tente novamente mais tarde.' }, 429, origem);
  } catch {
    return resposta({ error: 'Serviço temporariamente indisponível.' }, 503, origem);
  }

  const titulo = parametro
    ? `Sugestão de parâmetro: ${parametro.slice(0, 110)}`
    : 'Sugestão de parâmetro ou correção';
  const body = ['## Descrição', descricao,
    parametro ? `**Referência do parâmetro:** ${parametro}` : '',
    '', '---', 'Enviado pelo catálogo público de parâmetros do MyCommerce.',
  ].filter(Boolean).join('\n');

  try {
    const gh = await fetch('https://api.github.com/repos/kaina-visualsoftware/Myc.config/issues', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'myc-config-sugestoes/1.0',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ title: titulo, body }),
      signal: AbortSignal.timeout(12000),
    });
    if (!gh.ok) return resposta({ error: 'Não foi possível criar a issue no GitHub.' }, 502, origem);
    const criado: unknown = await gh.json();
    const url = (criado as { html_url?: unknown })?.html_url;
    if (typeof url !== 'string' ||
      !/^https:\/\/github\.com\/kaina-visualsoftware\/Myc\.config\/issues\/\d+$/.test(url)) {
      return resposta({ error: 'Resposta inesperada do GitHub.' }, 502, origem);
    }
    return resposta({ url }, 201, origem);
  } catch {
    return resposta({ error: 'Falha temporária ao acessar o GitHub.' }, 502, origem);
  }
});
