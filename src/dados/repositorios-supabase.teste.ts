import { describe, expect, it, vi } from 'vitest';
import { SupabaseClient } from '@supabase/supabase-js';
import { criarRepositoriosSupabase } from './repositorios-supabase';
import { parametroTeste } from '../dominio/testes/fixtures';
import { lerFiltros } from '../dominio/catalogo';

describe('Adaptador Supabase', () => {
  it('catálogo usa RPC resumida e cancelável, nunca select/count', async () => {
    const resposta = { data: { itens: [], proximoCursor: null }, error: null };
    const abortSignal = vi.fn().mockResolvedValue(resposta);
    const rpc = vi.fn().mockReturnValue({ abortSignal });
    const from = vi.fn();
    const repo = criarRepositoriosSupabase({ rpc, from } as unknown as SupabaseClient);
    const filtros = lerFiltros(new URLSearchParams());
    const sinal = new AbortController().signal;
    expect(await repo.catalogoCursor.listar(filtros, null, sinal)).toEqual(resposta.data);
    expect(rpc).toHaveBeenCalledWith('listar_parametros_catalogo', { p_filtros: filtros, p_cursor: null, p_limite: 50 });
    expect(abortSignal).toHaveBeenCalledWith(sinal);
    expect(from).not.toHaveBeenCalled();
  });
  it('RPC ausente orienta rollout, sem fallback lento silencioso', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: { code: 'PGRST202' } });
    const repo = criarRepositoriosSupabase({ rpc } as unknown as SupabaseClient);
    await expect(repo.catalogoCursor.listar(lerFiltros(new URLSearchParams()), null)).rejects.toThrow('0007');
  });
  it('documentação usa somente RPC, retornando versão e propagando erro legível', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: 'p', versao: 3 }, error: null });
    const from = vi.fn();
    const repositorios = criarRepositoriosSupabase({ rpc, from } as unknown as SupabaseClient);
    const entrada = {
      id: 'p', versaoEsperada: 2, oQueFaz: 'Descrição', impacto: null,
      valorPadrao: null, observacoes: null, statusDocumentacao: 'documentado' as const,
    };
    expect((await repositorios.documentacao.salvar(entrada)).versao).toBe(3);
    expect(rpc).toHaveBeenCalledWith('salvar_documentacao', {
      p_id: 'p', p_versao_esperada: 2, p_o_que_faz: 'Descrição', p_impacto: null,
      p_valor_padrao: null, p_observacoes: null, p_status: 'documentado',
    });
    expect(from).not.toHaveBeenCalled();
    rpc.mockResolvedValue({ data: null, error: { message: 'Conflito de edição' } });
    await expect(repositorios.documentacao.salvar(entrada)).rejects.toThrow('Conflito');
  });

  it('pagina todos os IDs importados em ordem estável', async () => {
    const pagina = Array.from({ length: 500 }, (_, i) => ({ id: `p${i}` }));
    const range = vi.fn().mockResolvedValueOnce({ data: pagina }).mockResolvedValueOnce({ data: [{ id: 'ultimo' }] });
    const order = vi.fn().mockReturnValue({ range });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    const repo = criarRepositoriosSupabase({ from: () => ({ select }) } as unknown as SupabaseClient);
    const ids = await repo.parametroImportacao.listarIdsImportados();
    expect(ids).toHaveLength(501);
    expect(ids.at(-1)).toBe('ultimo');
    expect(eq).toHaveBeenCalledWith('origem', 'importado');
    expect(order).toHaveBeenCalledWith('id');
    expect(range.mock.calls).toEqual([[0, 499], [500, 999]]);
  });

  it('upsert administrativo envia a versão do snapshot', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const repo = criarRepositoriosSupabase({ from: () => ({ upsert }) } as unknown as SupabaseClient);
    await repo.parametroEscrita.salvar(parametroTeste({ versao: 9 }));
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ versao: 9 }));
  });
});
