import { describe, expect, it } from 'vitest';
import { escreverFiltros, lerFiltros } from '../catalogo';

describe('Filtros compartilháveis do catálogo', () => {
  it('tem defaults sem árvore, somente ativos e nome crescente', () => {
    expect(lerFiltros(new URLSearchParams())).toMatchObject({ ativo: true, tags: [], ordem: 'nome', direcao: 'asc' });
  });
  it('normaliza enum, UUID, tags duplicadas e termo legado', () => {
    const id = '00000000-0000-0000-0000-000000000001';
    expect(lerFiltros(new URLSearchParams(`termo=ação&tag=${id.toUpperCase()}&tag=${id}&tag=x&ordem=sql&status=sql&direcao=sql`)))
      .toMatchObject({ termo: 'ação', tags: [id], ordem: 'nome', direcao: 'asc', status: undefined });
  });
  it('URL preserva filtros após round trip, semTag exclui tags', () => {
    const f = lerFiltros(new URLSearchParams('q=orcamento&tipo=checkbox&status=revisado&origem=manual&ativo=todos&op=E&ordem=caminho&direcao=desc&semTag=1&tag=00000000-0000-0000-0000-000000000001'));
    expect(lerFiltros(escreverFiltros(f))).toEqual(f);
    expect(f.tags).toEqual([]);
    expect(f.ativo).toBeNull();
  });
});
