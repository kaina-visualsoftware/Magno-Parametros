/**
 * SRP: transformar o conteúdo do arquivo de origem (JSON plano) em objetos de
 * domínio — telas, árvore de abas e parâmetros — recalculando os caminhos
 * a partir da árvore e comparando com os caminhos importados (alertas).
 */

import { Aba, Parametro, Tela } from './entidades';
import { calcularCaminhoAba, calcularCaminhoParametro, SEPARADOR_CAMINHO } from './calculadora-caminho';
import { calcularHashOrigem } from './calculadora-hash';
import { criarSlug, montarTextoBusca } from './normalizador';
import { ManipuladorTipoGenerico, temTipoRegistrado, registrarTipoParametro } from './tipos-parametro';

export interface ItemParametroFlat {
  id: string;
  nome: string;
  descricao: string | null;
  tipo: string;
  opcoes?: string[];
  grupo: string;
  caminho: string;
  tags?: string[];
  tela: string;
  abas: string[];
  caminho_lista: string[];
  imagem_origem: string;
}

export interface ConteudoFlat {
  meta?: { sistema?: string; caminho_base?: string; total_parametros?: number };
  parametros: ItemParametroFlat[];
}

export interface ResultadoMapeamento {
  telas: Tela[];
  abas: Aba[];
  parametros: Parametro[];
  alertas: string[];
}

export async function mapearArquivoFlat(conteudo: ConteudoFlat): Promise<ResultadoMapeamento> {
  const alertas: string[] = [];
  const telasPorId = new Map<string, Tela>();
  const abasPorChave = new Map<string, Aba>();
  const abas: Aba[] = [];
  const parametros: Parametro[] = [];
  const idsVistos = new Set<string>();
  let ordemParametro = 0;

  for (const item of conteudo.parametros) {
    if (idsVistos.has(item.id)) {
      alertas.push(`Id duplicado ignorado: ${item.id}`);
      continue;
    }
    idsVistos.add(item.id);

    const telaId = criarSlug(item.tela);
    const trilha = item.abas ?? [];
    if (trilha.length === 0) {
      alertas.push(`Parâmetro sem trilha de abas ignorado: ${item.id}`);
      continue;
    }

    // Prefixo da tela: segmentos do caminho completo que não são aba nem parâmetro.
    const lista = item.caminho_lista ?? item.caminho.split(SEPARADOR_CAMINHO);
    const comprimentoBase = Math.max(0, lista.length - trilha.length - 1);
    const prefixoTela = lista.slice(0, comprimentoBase).join(SEPARADOR_CAMINHO);

    if (!telasPorId.has(telaId)) {
      telasPorId.set(telaId, {
        id: telaId,
        nome: item.tela,
        descricao: null,
        prefixoCaminho: prefixoTela,
      });
    }

    // Constrói a árvore de abas a partir da trilha.
    let paiId: string | null = null;
    const nomesAcumulados: string[] = [];
    for (const nomeAba of trilha) {
      nomesAcumulados.push(nomeAba);
      const chave = `${telaId}|${nomesAcumulados.join('|')}`;
      let aba = abasPorChave.get(chave);
      if (!aba) {
        const truncada = /\.\.\.$/.test(nomeAba);
        aba = {
          id: criarSlug([telaId, ...nomesAcumulados].join('/')),
          telaId,
          abaPaiId: paiId,
          nome: nomeAba,
          nomeOriginalImportado: truncada ? nomeAba : null,
          nomeTruncadoNaTela: truncada,
          ordem: abas.length,
          caminho: calcularCaminhoAba(prefixoTela, nomesAcumulados),
        };
        abasPorChave.set(chave, aba);
        abas.push(aba);
      }
      paiId = aba.id;
    }
    const abaId = paiId;
    if (!abaId) {
      alertas.push(`Parâmetro sem aba destino ignorado: ${item.id}`);
      continue;
    }

    // Regra 4.4: o caminho calculado a partir da árvore prevalece; divergências viram alertas.
    const caminhoCalculado = calcularCaminhoParametro(prefixoTela, trilha, item.nome);
    if (item.caminho !== caminhoCalculado) {
      alertas.push(
        `Caminho divergente em "${item.id}": importado "${item.caminho}" ≠ calculado "${caminhoCalculado}". Prevalece o calculado.`,
      );
    }

    // OCP: qualquer tipo novo presente no arquivo passa a existir no registro,
    // sem quebrar a importação.
    if (!temTipoRegistrado(item.tipo)) {
      registrarTipoParametro(new ManipuladorTipoGenerico(item.tipo));
    }

    const hashOrigem = await calcularHashOrigem({
      nome: item.nome,
      tipo: item.tipo,
      opcoes: item.opcoes ?? [],
      grupo: item.grupo,
      descricaoOriginal: item.descricao ?? null,
      caminho: caminhoCalculado,
    });

    parametros.push({
      id: item.id,
      abaId,
      grupo: item.grupo,
      nome: item.nome,
      tipo: item.tipo,
      opcoes: item.opcoes ?? [],
      descricaoOriginal: item.descricao ?? null,
      oQueFaz: null,
      impacto: null,
      valorPadrao: null,
      observacoes: null,
      statusDocumentacao: 'pendente',
      origem: 'importado',
      hashOrigem,
      editadoNaOrigem: false,
      ordem: ordemParametro++,
      ativo: true,
      caminho: caminhoCalculado,
      imagemOrigem: item.imagem_origem ?? null,
      imagemMarcada: false,
      textoBusca: montarTextoBusca([item.nome, item.descricao, item.grupo, caminhoCalculado]),
    });
  }

  return { telas: [...telasPorId.values()], abas, parametros, alertas };
}
