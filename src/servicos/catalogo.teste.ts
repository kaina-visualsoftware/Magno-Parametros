import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PortasDeDados } from '../dados/portas';
import { abaTeste, parametroTeste } from '../dominio/testes/fixtures';
import { obterRepositorios } from '../raiz-composicao';
import { renomearAba, salvarDocumentacao } from './catalogo';

vi.mock('../raiz-composicao', () => ({ obterRepositorios: vi.fn() }));

describe('Serviços do catálogo', () => {
  const portas = {
    documentacao: { salvar: vi.fn() },
    arvoreLeitura: { listarAbas: vi.fn(), listarTelas: vi.fn() },
    arvoreEscrita: { salvarAbas: vi.fn() },
    parametroLeitura: { listarPorAbas: vi.fn(), buscarPorId: vi.fn() },
    parametroEscrita: { salvarEmLote: vi.fn(), salvar: vi.fn() },
    historico: { registrar: vi.fn() },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(obterRepositorios).mockReturnValue(portas as unknown as PortasDeDados);
  });

  it('envia versão do rascunho à porta atômica sem buscar outra versão', async () => {
    const entrada = {
      id: 'p', versaoEsperada: 4, oQueFaz: 'Teste', impacto: null,
      valorPadrao: null, observacoes: null, statusDocumentacao: 'documentado' as const,
    };
    portas.documentacao.salvar.mockResolvedValue(parametroTeste({ versao: 5 }));
    expect((await salvarDocumentacao(entrada)).versao).toBe(5);
    expect(portas.documentacao.salvar).toHaveBeenCalledWith(entrada);
    expect(portas.parametroLeitura.buscarPorId).not.toHaveBeenCalled();
    expect(portas.parametroEscrita.salvar).not.toHaveBeenCalled();
    expect(portas.historico.registrar).not.toHaveBeenCalled();
  });

  it('propaga conflito sem retry ou gravação alternativa', async () => {
    portas.documentacao.salvar.mockRejectedValue(new Error('Conflito de edição'));
    await expect(salvarDocumentacao({
      id: 'p', versaoEsperada: 0, oQueFaz: null, impacto: null, valorPadrao: null,
      observacoes: null, statusDocumentacao: 'pendente',
    })).rejects.toThrow('Conflito');
    expect(portas.documentacao.salvar).toHaveBeenCalledTimes(1);
  });

  it.each(['raiz', 'filha', 'neta'])('renomeia %s preservando ancestrais, origem e documentação', async (id) => {
    const abas = [abaTeste('raiz', 'Raiz', null), abaTeste('filha', 'Filha', 'raiz'), abaTeste('neta', 'Neta', 'filha')];
    portas.arvoreLeitura.listarAbas.mockResolvedValue(abas);
    portas.arvoreLeitura.listarTelas.mockResolvedValue([{ id: 'tela', nome: 'Tela', descricao: null, prefixoCaminho: 'ERP' }]);
    portas.parametroLeitura.listarPorAbas.mockResolvedValue([
      parametroTeste({ abaId: 'neta', oQueFaz: 'Não perder', versao: 7 }),
    ]);
    await renomearAba({ abaId: id, novoNome: 'Novo', usuario: null });
    const nomes = ['Raiz', 'Filha', 'Neta'];
    nomes[['raiz', 'filha', 'neta'].indexOf(id)] = 'Novo';
    expect(portas.parametroEscrita.salvarEmLote).toHaveBeenCalledWith([
      expect.objectContaining({ caminho: `ERP > ${nomes.join(' > ')} > Parâmetro`, oQueFaz: 'Não perder', versao: 7 }),
    ]);
    expect(portas.arvoreEscrita.salvarAbas).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ id, nome: 'Novo', nomeOriginalImportado: abas.find(a => a.id === id)?.nome }),
    ]));
  });
});
