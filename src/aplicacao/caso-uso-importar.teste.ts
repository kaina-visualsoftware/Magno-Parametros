import { describe, expect, it, vi } from 'vitest';
import { FonteJsonPlano, importarCatalogo, PortasImportacao } from './caso-uso-importar';
import { mapearArquivoFlat, ConteudoFlat } from '../dominio/mapeador-arquivo';

describe('Importação completa', () => {
  const conteudo: ConteudoFlat = { parametros: [{
    id: 'p', nome: 'Parâmetro', descricao: null, tipo: 'checkbox', grupo: 'Geral',
    caminho: 'ERP > Aba > Parâmetro', tela: 'Tela', abas: ['Aba'],
    caminho_lista: ['ERP', 'Aba', 'Parâmetro'], imagem_origem: '',
  }] };

  it('relata importado ausente, mantém documentação e segunda rodada idempotente', async () => {
    const mapeado = await mapearArquivoFlat(conteudo);
    const salvo = { ...mapeado.parametros[0], oQueFaz: 'Documentado manualmente', versao: 8 };
    const escrita = vi.fn();
    const portas: PortasImportacao = {
      leituraTipos: { listar: async () => [{ codigo: 'checkbox', descricao: null, componentes: [] }] },
      escritaTipos: { salvarEmLote: escrita },
      arvoreLeitura: { listarTelas: async () => mapeado.telas, listarAbas: async () => mapeado.abas },
      arvoreEscrita: { salvarTelas: escrita, salvarAbas: escrita, renomearAba: escrita },
      parametroImportacao: {
        buscarPorIds: async () => [salvo], listarIdsImportados: async () => ['p', 'ausente'], salvarEmLote: escrita,
      },
      parametroEscrita: {
        buscarPorIds: async () => [salvo], listarIdsImportados: async () => ['p', 'ausente'],
        salvarEmLote: escrita, salvar: escrita, desativar: escrita,
      },
      historico: { registrar: escrita, listar: async () => [] },
    };
    for (const dryRun of [true, false, false]) {
      const relatorio = await importarCatalogo(new FonteJsonPlano(conteudo), portas, { dryRun });
      expect(relatorio.naoEncontradosNaOrigem).toEqual(['ausente']);
      expect(relatorio.inalterados).toBe(1);
      expect(relatorio.novos).toBe(0);
    }
    expect(escrita).not.toHaveBeenCalled();
    expect(salvo.oQueFaz).toBe('Documentado manualmente');
  });
});
