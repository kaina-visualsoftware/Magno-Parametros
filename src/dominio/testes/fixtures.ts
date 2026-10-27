import { Aba, Parametro } from '../entidades';

export function parametroTeste(alteracoes: Partial<Parametro> = {}): Parametro {
  return {
    id: 'p', versao: 0, abaId: 'filha', nome: 'Parâmetro', grupo: 'Geral',
    tipo: 'checkbox', opcoes: [], descricaoOriginal: null, oQueFaz: null,
    impacto: null, valorPadrao: null, observacoes: null, statusDocumentacao: 'pendente',
    origem: 'importado', hashOrigem: 'hash', editadoNaOrigem: false, ordem: 0,
    ativo: true, caminho: 'ERP > Raiz > Filha > Parâmetro', imagemOrigem: null, imagemPersonalizadaPath: null,
    imagemMarcada: false, textoBusca: 'parametro', ...alteracoes,
  };
}

export function abaTeste(id: string, nome: string, abaPaiId: string | null): Aba {
  return {
    id, nome, abaPaiId, telaId: 'tela', nomeOriginalImportado: nome,
    nomeTruncadoNaTela: false, ordem: 0, caminho: '',
  };
}
