import { afterEach, describe, expect, it, vi } from 'vitest';

describe('Configuração pública', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

  it.each([
    ['', ''], ['https://exemplo.supabase.co', ''], ['', 'publica'],
    ['url-invalida', 'publica'], ['javascript:alert(1)', 'publica'],
  ])('não inicializa configuração ausente ou inválida: %s', async (url, chave) => {
    vi.stubEnv('VITE_SUPABASE_URL', url);
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', chave);
    const { configuracaoPresente } = await import('./raiz-composicao');
    expect(configuracaoPresente()).toBe(false);
  });

  it('aceita URL HTTP local e chave pública para desenvolvimento', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'publica');
    const { configuracaoPresente } = await import('./raiz-composicao');
    expect(configuracaoPresente()).toBe(true);
  });
});
