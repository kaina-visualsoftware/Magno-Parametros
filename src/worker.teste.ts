import { afterEach, describe, expect, it, vi } from 'vitest';
import { processarRequisicao, type Env } from '../worker/index';

const env: Env = {
  SUPABASE_URL: 'https://exemplo.supabase.co',
  ALLOWED_ORIGINS: 'https://kaina-visualsoftware.github.io,http://localhost:5173',
};
const origem = 'https://kaina-visualsoftware.github.io';

function requisicao(caminho: string, init: RequestInit = {}): Request {
  return new Request(`https://worker.exemplo.workers.dev${caminho}`, init);
}

describe('Proxy Cloudflare Worker', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('repassa GET com query string, apikey e devolve CORS da origem permitida', async () => {
    const upstream = vi.fn().mockResolvedValue(
      new Response('[{"id":"p"}]', {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'content-range': '0-0/*',
          'access-control-allow-origin': '*',
          'set-cookie': 'x=1',
        },
      }),
    );
    vi.stubGlobal('fetch', upstream);

    const resposta = await processarRequisicao(
      requisicao('/rest/v1/parametros?select=id&limit=1', {
        headers: { Origin: origem, apikey: 'publica', 'x-client-info': 'supabase-js/2' },
      }),
      env,
    );

    expect(upstream).toHaveBeenCalledTimes(1);
    const [url, init] = upstream.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://exemplo.supabase.co/rest/v1/parametros?select=id&limit=1');
    expect(init.method).toBe('GET');
    const cabecalhos = new Headers(init.headers);
    expect(cabecalhos.get('apikey')).toBe('publica');
    expect(cabecalhos.get('origin')).toBeNull();
    expect(cabecalhos.get('host')).toBeNull();
    expect(resposta.status).toBe(200);
    expect(resposta.headers.get('Access-Control-Allow-Origin')).toBe(origem);
    expect(resposta.headers.get('Content-Range')).toBe('0-0/*');
    expect(resposta.headers.get('Set-Cookie')).toBeNull();
  });

  it('responde OPTIONS sem chamar o Supabase', async () => {
    const upstream = vi.fn();
    vi.stubGlobal('fetch', upstream);

    const resposta = await processarRequisicao(
      requisicao('/rest/v1/parametros', {
        method: 'OPTIONS',
        headers: {
          Origin: origem,
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'apikey,authorization,x-client-info',
        },
      }),
      env,
    );

    expect(upstream).not.toHaveBeenCalled();
    expect(resposta.status).toBe(204);
    expect(resposta.headers.get('Access-Control-Allow-Origin')).toBe(origem);
    expect(resposta.headers.get('Access-Control-Allow-Headers')).toBe('apikey,authorization,x-client-info');
  });

  it('bloqueia origem não permitida', async () => {
    const upstream = vi.fn();
    vi.stubGlobal('fetch', upstream);
    const resposta = await processarRequisicao(
      requisicao('/rest/v1/parametros', { headers: { Origin: 'https://invasor.example' } }),
      env,
    );
    expect(resposta.status).toBe(403);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('bloqueia caminho fora de /rest/v1 e /auth/v1', async () => {
    const upstream = vi.fn();
    vi.stubGlobal('fetch', upstream);
    const resposta = await processarRequisicao(requisicao('/admin/segredo', { headers: { Origin: origem } }), env);
    expect(resposta.status).toBe(404);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('repassa POST com corpo e content-type', async () => {
    const upstream = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', upstream);
    const resposta = await processarRequisicao(
      requisicao('/auth/v1/token?grant_type=password', {
        method: 'POST',
        headers: { Origin: origem, apikey: 'publica', 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'a@b.c', password: 'x' }),
      }),
      env,
    );
    expect(resposta.status).toBe(200);
    const init = upstream.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('content-type')).toBe('application/json');
    expect(new TextDecoder().decode(init.body as ArrayBuffer)).toContain('a@b.c');
  });

  it('devolve 502 com CORS quando o Supabase está inacessível', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('rede')));
    const resposta = await processarRequisicao(
      requisicao('/rest/v1/parametros', { headers: { Origin: origem } }),
      env,
    );
    expect(resposta.status).toBe(502);
    expect(resposta.headers.get('Access-Control-Allow-Origin')).toBe(origem);
    expect(await resposta.json()).toEqual({ error: 'Falha ao contatar o Supabase' });
  });

  it('recusa SUPABASE_URL inválida', async () => {
    const upstream = vi.fn();
    vi.stubGlobal('fetch', upstream);
    const resposta = await processarRequisicao(
      requisicao('/rest/v1/parametros', { headers: { Origin: origem } }),
      { ...env, SUPABASE_URL: 'http://localhost:5432' },
    );
    expect(resposta.status).toBe(500);
    expect(upstream).not.toHaveBeenCalled();
  });
});


describe('Criação de sugestões pelo Worker', () => {
  const envSugestoes: Env = {
    ...env,
    GITHUB_ISSUES_TOKEN: 'token-apenas-no-worker',
    ISSUE_LIMITER: { limit: vi.fn().mockResolvedValue({ success: true }) },
  };
  function pedido(dados: Record<string, unknown>, origemPedido: string = origem): Request {
    return requisicao('/api/sugestoes', {
      method: 'POST',
      headers: {
        Origin: origemPedido,
        'CF-Connecting-IP': '203.0.113.4',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dados),
    });
  }
  afterEach(() => vi.unstubAllGlobals());

  it('cria issue sem expor token e retorna link verificado', async () => {
    const upstream = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      html_url: 'https://github.com/kaina-visualsoftware/Myc.config/issues/123',
    }), { status: 201, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', upstream);
    const resposta = await processarRequisicao(pedido({
      descricao: 'Ajustar descrição do parâmetro no catálogo.',
      parametro: 'Produtos > Descontos',
    }), envSugestoes);
    expect(resposta.status).toBe(201);
    expect(await resposta.json()).toEqual({ url: 'https://github.com/kaina-visualsoftware/Myc.config/issues/123' });
    expect(resposta.headers.get('Access-Control-Allow-Origin')).toBe(origem);
    const [url, init] = upstream.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.github.com/repos/kaina-visualsoftware/Myc.config/issues');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer token-apenas-no-worker');
    const corpo = JSON.parse(String(init.body));
    expect(corpo.body).toContain('Ajustar descrição');
    expect(corpo.body).toContain('Produtos > Descontos');
    expect(JSON.stringify({ url: 'https://github.com/kaina-visualsoftware/Myc.config/issues/123' })).not.toContain('token-apenas-no-worker');
  });

  it('bloqueia origem desconhecida antes de chamar GitHub', async () => {
    const upstream = vi.fn();
    vi.stubGlobal('fetch', upstream);
    const resposta = await processarRequisicao(pedido({ descricao: 'Teste de origem inválida.' }, 'https://invasor.example'), envSugestoes);
    expect(resposta.status).toBe(403);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('rejeita descrição vazia e JSON inválido', async () => {
    const upstream = vi.fn();
    vi.stubGlobal('fetch', upstream);
    expect((await processarRequisicao(pedido({ descricao: 'curto' }), envSugestoes)).status).toBe(400);
    const req = requisicao('/api/sugestoes', {
      method: 'POST',
      headers: { Origin: origem, 'CF-Connecting-IP': '203.0.113.4', 'Content-Type': 'application/json' },
      body: '{',
    });
    expect((await processarRequisicao(req, envSugestoes)).status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('retorna 429 ao atingir o limite', async () => {
    const upstream = vi.fn();
    vi.stubGlobal('fetch', upstream);
    const resposta = await processarRequisicao(pedido({ descricao: 'Solicitação válida para limite.' }),
      { ...envSugestoes, ISSUE_LIMITER: { limit: async () => ({ success: false }) } });
    expect(resposta.status).toBe(429);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('não registra sucesso em falha do GitHub', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('erro', { status: 401 })));
    const resposta = await processarRequisicao(pedido({ descricao: 'Solicitação válida para falha.' }), envSugestoes);
    expect(resposta.status).toBe(502);
    expect((await resposta.json()) as { url?: string }).not.toHaveProperty('url');
  });

  it('recusa envio sem configuração de token e rate limit', async () => {
    const resposta = await processarRequisicao(pedido({ descricao: 'Solicitação válida mas sem configuração.' }), env);
    expect(resposta.status).toBe(503);
  });
});
