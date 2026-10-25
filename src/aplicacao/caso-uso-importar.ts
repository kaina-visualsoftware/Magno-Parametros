/**
 * Caso de uso: importar parâmetros de uma fonte de dados (seção 5.3).
 *
 * Idempotente: rodar duas vezes não duplica nem sobrescreve dados editados
 * por pessoas. Aceita dry-run (pré-visualização) e valida o total esperado.
 *
 * DIP: recebe apenas portas (interfaces) — não conhece Supabase nem arquivos.
 * OCP: a fonte é uma interface (FonteDeParametros); novas fontes (CSV, API)
 * entram como novas implementações, sem alterar este caso de uso.
 */

import { compararParametros } from '../dominio/comparador-importacao';
import { ErroImportacao } from '../dominio/erros';
import { ConteudoFlat, mapearArquivoFlat } from '../dominio/mapeador-arquivo';
import { PortasDeDados } from '../dados/portas';

export interface FonteDeParametros {
  readonly nome: string;
  ler(): Promise<ConteudoFlat>;
}

/** Implementação da fonte JSON plano (parametros_myc_flat.json). */
export class FonteJsonPlano implements FonteDeParametros {
  readonly nome = 'JSON plano';

  constructor(private readonly conteudo: ConteudoFlat) {}

  async ler(): Promise<ConteudoFlat> {
    return this.conteudo;
  }
}

export type PortasImportacao = Pick<
  PortasDeDados,
  | 'leituraTipos'
  | 'escritaTipos'
  | 'arvoreLeitura'
  | 'arvoreEscrita'
  | 'parametroImportacao'
  | 'parametroEscrita'
  | 'historico'
>;

export interface RelatorioImportacao {
  fonte: string;
  totalLido: number;
  telasNovas: number;
  abasNovas: number;
  tiposNovos: string[];
  novos: number;
  alterados: number;
  inalterados: number;
  conflitos: string[];
  naoEncontradosNaOrigem: string[];
  alertas: string[];
  dryRun: boolean;
}

export interface OpcoesImportacao {
  dryRun?: boolean;
  /** Quando informado, falha se o arquivo não tiver exatamente este total (ex.: 950 na primeira carga). */
  exigirTotal?: number | null;
}

export async function importarCatalogo(
  fonte: FonteDeParametros,
  portas: PortasImportacao,
  opcoes: OpcoesImportacao = {},
): Promise<RelatorioImportacao> {
  const conteudo = await fonte.ler();
  const mapeado = await mapearArquivoFlat(conteudo);

  const esperado = opcoes.exigirTotal ?? null;
  if (esperado !== null && mapeado.parametros.length !== esperado) {
    throw new ErroImportacao(
      `O arquivo contém ${mapeado.parametros.length} parâmetros, mas o esperado é ${esperado}. ` +
        'Importação abortada — verifique o arquivo de origem.',
    );
  }

  // Tipos novos (cadastro extensível — são dados, não código).
  const tiposExistentes = new Set((await portas.leituraTipos.listar()).map((t) => t.codigo));
  const tiposNovos = [...new Set(mapeado.parametros.map((p) => p.tipo))].filter((c) => !tiposExistentes.has(c));

  // Árvore nova.
  const [telasExistentes, abasExistentes] = await Promise.all([
    portas.arvoreLeitura.listarTelas(),
    portas.arvoreLeitura.listarAbas(),
  ]);
  const idsTelas = new Set(telasExistentes.map((t) => t.id));
  const idsAbas = new Set(abasExistentes.map((a) => a.id));
  const telasNovas = mapeado.telas.filter((t) => !idsTelas.has(t.id));
  const abasNovas = mapeado.abas.filter((a) => !idsAbas.has(a.id));

  // Parâmetros: novo / inalterado / alterado / conflito.
  const existentes = await portas.parametroImportacao.buscarPorIds(mapeado.parametros.map((p) => p.id));
  const mapaExistentes = new Map(existentes.map((p) => [p.id, p]));
  const comparacao = compararParametros(mapeado.parametros, mapaExistentes);

  // Alerta: itens importados que não vieram no arquivo novo (nunca são apagados).
  const idsDaOrigem = new Set(mapeado.parametros.map((p) => p.id));
  const naoEncontradosNaOrigem = (await portas.parametroImportacao.listarIdsImportados())
    .filter((id) => !idsDaOrigem.has(id));

  if (!opcoes.dryRun) {
    if (tiposNovos.length > 0) {
      await portas.escritaTipos.salvarEmLote(tiposNovos.map((codigo) => ({ codigo, descricao: null, componentes: [] })));
    }
    if (telasNovas.length > 0) await portas.arvoreEscrita.salvarTelas(telasNovas);
    if (abasNovas.length > 0) await portas.arvoreEscrita.salvarAbas(abasNovas);
    if (comparacao.paraSalvar.length > 0) await portas.parametroEscrita.salvarEmLote(comparacao.paraSalvar);
    if (comparacao.eventosHistorico.length > 0) await portas.historico.registrar(comparacao.eventosHistorico);
  }

  return {
    fonte: fonte.nome,
    totalLido: mapeado.parametros.length,
    telasNovas: telasNovas.length,
    abasNovas: abasNovas.length,
    tiposNovos,
    novos: comparacao.novos,
    alterados: comparacao.alterados,
    inalterados: comparacao.inalterados,
    conflitos: comparacao.conflitos.map((p) => p.id),
    naoEncontradosNaOrigem,
    alertas: mapeado.alertas,
    dryRun: Boolean(opcoes.dryRun),
  };
}
