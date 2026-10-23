/**
 * Serviços da aplicação usados pela interface (interface → aplicação → domínio).
 * Cada função tem uma responsabilidade única e depende apenas das portas
 * injetadas pela raiz de composição.
 */

import { Aba, EventoHistorico, Parametro, Tag, Tela, TipoParametro } from '../dominio/entidades';
import { calcularCaminhoAba, calcularCaminhoParametro } from '../dominio/calculadora-caminho';
import { calcularHashOrigem } from '../dominio/calculadora-hash';
import { criarSlug, montarTextoBusca } from '../dominio/normalizador';
import { manipuladorDoTipo } from '../dominio/tipos-parametro';
import { FiltrosParametros } from '../dados/portas';
import { ConteudoFlat } from '../dominio/mapeador-arquivo';
import { FonteJsonPlano, importarCatalogo, RelatorioImportacao } from '../aplicacao/caso-uso-importar';
import { LinhaHistorico } from '../dominio/entidades';
import { obterRepositorios } from '../raiz-composicao';

const r = () => obterRepositorios();

// ---------------------------------------------------------------------------
// Árvore e navegação
// ---------------------------------------------------------------------------

export interface NoArvore {
  aba: Aba;
  filhos: NoArvore[];
  contagemPropria: number;
  contagemTotal: number;
}

export async function obterArvore(): Promise<{ telas: Tela[]; raizes: Record<string, NoArvore[]> }> {
  const [telas, abas, contagens] = await Promise.all([
    r().arvoreLeitura.listarTelas(),
    r().arvoreLeitura.listarAbas(),
    r().parametroLeitura.contagemPorAba(),
  ]);

  const filhosPorPai = new Map<string, Aba[]>();
  for (const aba of abas) {
    const chave = aba.abaPaiId ?? `tela:${aba.telaId}`;
    const lista = filhosPorPai.get(chave) ?? [];
    lista.push(aba);
    filhosPorPai.set(chave, lista);
  }

  function montarNo(aba: Aba): NoArvore {
    const filhos = (filhosPorPai.get(aba.id) ?? []).map(montarNo);
    const contagemPropria = contagens[aba.id] ?? 0;
    const contagemTotal = contagemPropria + filhos.reduce((soma, filho) => soma + filho.contagemTotal, 0);
    return { aba, filhos, contagemPropria, contagemTotal };
  }

  const raizes: Record<string, NoArvore[]> = {};
  for (const tela of telas) {
    raizes[tela.id] = (filhosPorPai.get(`tela:${tela.id}`) ?? []).map(montarNo);
  }
  return { telas, raizes };
}

export function idsDeSubarvore(abas: Aba[], abaId: string): string[] {
  const filhosPorPai = new Map<string | null, Aba[]>();
  for (const aba of abas) {
    const lista = filhosPorPai.get(aba.abaPaiId) ?? [];
    lista.push(aba);
    filhosPorPai.set(aba.abaPaiId, lista);
  }
  const ids: string[] = [];
  const pilha = [abaId];
  while (pilha.length > 0) {
    const atual = pilha.pop() as string;
    ids.push(atual);
    for (const filho of filhosPorPai.get(atual) ?? []) pilha.push(filho.id);
  }
  return ids;
}

export async function listarAbas(): Promise<Aba[]> {
  return r().arvoreLeitura.listarAbas();
}

export async function listarTelas(): Promise<Tela[]> {
  return r().arvoreLeitura.listarTelas();
}

export async function listarTipos(): Promise<TipoParametro[]> {
  return r().leituraTipos.listar();
}

export interface TrilhaAba {
  tela: Tela | null;
  trilha: Aba[];
}

export async function obterTrilhaDaAba(abaId: string): Promise<TrilhaAba> {
  const [abas, telas] = await Promise.all([
    r().arvoreLeitura.listarAbas(),
    r().arvoreLeitura.listarTelas(),
  ]);
  const porId = new Map(abas.map((aba) => [aba.id, aba]));
  const trilha: Aba[] = [];
  let atual = porId.get(abaId) ?? null;
  while (atual) {
    trilha.unshift(atual);
    atual = atual.abaPaiId ? (porId.get(atual.abaPaiId) ?? null) : null;
  }
  const tela = trilha.length > 0 ? (telas.find((t) => t.id === trilha[0].telaId) ?? null) : null;
  return { tela, trilha };
}

// ---------------------------------------------------------------------------
// Listagem / busca
// ---------------------------------------------------------------------------

export async function buscarParametros(filtros: FiltrosParametros) {
  return r().parametroLeitura.listar(filtros);
}

// ---------------------------------------------------------------------------
// Detalhe e documentação
// ---------------------------------------------------------------------------

export interface DetalheParametro {
  parametro: Parametro;
  tags: Tag[];
  todasTags: Tag[];
  historico: LinhaHistorico[];
}

export async function detalharParametro(id: string): Promise<DetalheParametro | null> {
  const parametro = await r().parametroLeitura.buscarPorId(id);
  if (!parametro) return null;
  const [vinculos, todasTags, historico] = await Promise.all([
    r().tagVinculo.listarPorParametro(id),
    r().tagLeitura.listar(),
    r().historico.listar('parametro', id),
  ]);
  const mapaTags = new Map(todasTags.map((tag) => [tag.id, tag]));
  const tags = vinculos.map((vinculo) => mapaTags.get(vinculo.tagId)).filter((tag): tag is Tag => Boolean(tag));
  return { parametro, tags, todasTags, historico };
}

/** Salva somente os campos editáveis por pessoas; registra histórico das diferenças. */
export async function salvarDocumentacao(entrada: {
  id: string;
  oQueFaz: string | null;
  impacto: string | null;
  valorPadrao: string | null;
  observacoes: string | null;
  statusDocumentacao: Parametro['statusDocumentacao'];
  usuario: string | null;
}): Promise<Parametro> {
  const antes = await r().parametroLeitura.buscarPorId(entrada.id);
  if (!antes) throw new Error('Parâmetro não encontrado');

  const depois: Parametro = {
    ...antes,
    oQueFaz: entrada.oQueFaz,
    impacto: entrada.impacto,
    valorPadrao: entrada.valorPadrao,
    observacoes: entrada.observacoes,
    statusDocumentacao: entrada.statusDocumentacao,
  };
  depois.textoBusca = montarTextoBusca([
    depois.nome,
    depois.descricaoOriginal,
    depois.oQueFaz,
    depois.grupo,
    depois.caminho,
  ]);
  await r().parametroEscrita.salvar(depois);

  const eventos: EventoHistorico[] = [];
  const campos: Array<[keyof Parametro, string]> = [
    ['oQueFaz', 'oQueFaz'],
    ['impacto', 'impacto'],
    ['valorPadrao', 'valorPadrao'],
    ['observacoes', 'observacoes'],
    ['statusDocumentacao', 'statusDocumentacao'],
  ];
  for (const [campo, rotulo] of campos) {
    if ((antes[campo] ?? null) !== (depois[campo] ?? null)) {
      eventos.push({
        entidade: 'parametro',
        entidadeId: depois.id,
        campo: rotulo,
        valorAnterior: String(antes[campo] ?? ''),
        valorNovo: String(depois[campo] ?? ''),
        usuario: entrada.usuario,
        origem: 'edicao',
      });
    }
  }
  if (eventos.length > 0) await r().historico.registrar(eventos);
  return depois;
}

/**
 * Edita um campo de ORIGEM de um item importado (exige confirmação explícita
 * na interface). Marca editadoNaOrigem — a próxima importação tratará a
 * divergência como conflito, e não sobrescreverá.
 */
export async function editarCampoOrigem(entrada: {
  id: string;
  campo: 'nome' | 'grupo' | 'descricaoOriginal';
  valor: string;
  usuario: string | null;
}): Promise<Parametro> {
  const antes = await r().parametroLeitura.buscarPorId(entrada.id);
  if (!antes) throw new Error('Parâmetro não encontrado');

  const depois: Parametro = { ...antes, [entrada.campo]: entrada.valor, editadoNaOrigem: true };
  const { tela, trilha } = await obterTrilhaDaAba(depois.abaId);
  const nomesAbas = trilha.map((aba) => aba.nome);
  depois.caminho = calcularCaminhoParametro(tela?.prefixoCaminho ?? '', nomesAbas, depois.nome);
  depois.hashOrigem = await calcularHashOrigem({
    nome: depois.nome,
    tipo: depois.tipo,
    opcoes: depois.opcoes,
    grupo: depois.grupo,
    descricaoOriginal: depois.descricaoOriginal,
    caminho: depois.caminho,
  });
  depois.textoBusca = montarTextoBusca([depois.nome, depois.descricaoOriginal, depois.oQueFaz, depois.grupo, depois.caminho]);

  await r().parametroEscrita.salvar(depois);
  await r().historico.registrar([
    {
      entidade: 'parametro',
      entidadeId: depois.id,
      campo: entrada.campo,
      valorAnterior: String(antes[entrada.campo] ?? ''),
      valorNovo: entrada.valor,
      usuario: entrada.usuario,
      origem: 'edicao-origem',
    },
  ]);
  return depois;
}

/** Cria um parâmetro manual (requer papel administrador — garantido por RLS e pela UI). */
export async function criarParametro(entrada: {
  abaId: string;
  nome: string;
  tipo: string;
  opcoes: string[];
  grupo: string;
  usuario: string | null;
}): Promise<Parametro> {
  const { tela, trilha } = await obterTrilhaDaAba(entrada.abaId);
  if (!tela || trilha.length === 0) throw new Error('Selecione uma aba válida para o novo parâmetro');

  // OCP: a validação vem do manipulador do tipo — nunca de um switch.
  const erroOpcoes = manipuladorDoTipo(entrada.tipo).validarOpcoes(entrada.opcoes);
  if (erroOpcoes) throw new Error(erroOpcoes);

  const caminho = calcularCaminhoParametro(tela.prefixoCaminho, trilha.map((aba) => aba.nome), entrada.nome);
  const id = criarSlug(`${trilha[trilha.length - 1].id}--${entrada.nome}`);
  const existente = await r().parametroLeitura.buscarPorId(id);
  if (existente) throw new Error('Já existe um parâmetro com esse nome nesta aba');

  // Tipo novo? Cadastre automaticamente (tipos são dados, não código).
  const tipos = await r().leituraTipos.listar();
  if (!tipos.some((t) => t.codigo === entrada.tipo)) {
    await r().escritaTipos.salvarEmLote([{ codigo: entrada.tipo, descricao: null, componentes: [] }]);
  }

  const hashOrigem = await calcularHashOrigem({
    nome: entrada.nome,
    tipo: entrada.tipo,
    opcoes: entrada.opcoes,
    grupo: entrada.grupo,
    descricaoOriginal: null,
    caminho,
  });

  const parametro: Parametro = {
    id,
    abaId: entrada.abaId,
    grupo: entrada.grupo,
    nome: entrada.nome,
    tipo: entrada.tipo,
    opcoes: entrada.opcoes,
    descricaoOriginal: null,
    oQueFaz: null,
    impacto: null,
    valorPadrao: null,
    observacoes: null,
    statusDocumentacao: 'pendente',
    origem: 'manual',
    hashOrigem,
    editadoNaOrigem: false,
    ordem: 0,
    ativo: true,
    caminho,
    imagemOrigem: null,
    textoBusca: montarTextoBusca([entrada.nome, entrada.grupo, caminho]),
  };
  await r().parametroEscrita.salvar(parametro);
  await r().historico.registrar([
    {
      entidade: 'parametro',
      entidadeId: id,
      campo: 'criado',
      valorAnterior: null,
      valorNovo: entrada.nome,
      usuario: entrada.usuario,
      origem: 'manual',
    },
  ]);
  return parametro;
}

/**
 * Renomeia uma aba: recalcula o caminho da aba e de todos os descendentes,
 * atualiza o caminho/texto de busca dos parâmetros afetados e registra histórico.
 * O nome original importado é preservado.
 */
export async function renomearAba(entrada: { abaId: string; novoNome: string; usuario: string | null }): Promise<void> {
  const [abas, telas] = await Promise.all([
    r().arvoreLeitura.listarAbas(),
    r().arvoreLeitura.listarTelas(),
  ]);
  const porId = new Map(abas.map((aba) => [aba.id, aba]));
  const aba = porId.get(entrada.abaId);
  if (!aba) throw new Error('Aba não encontrada');
  const tela = telas.find((t) => t.id === aba.telaId) ?? null;
  if (!tela) throw new Error('Tela da aba não encontrada');

  // Trilha da aba (do root até ela) com o novo nome no fim.
  const trilhaNomes: string[] = [];
  let atual: Aba | undefined = aba;
  while (atual) {
    trilhaNomes.unshift(atual.nome);
    atual = atual.abaPaiId ? porId.get(atual.abaPaiId) : undefined;
  }
  trilhaNomes[trilhaNomes.length - 1] = entrada.novoNome;

  // Cópia dos valores estreitados para uso seguro dentro de percorrer().
  const idDaAba = aba.id;
  const prefixoDaTela = tela.prefixoCaminho;
  const nomeNovo = entrada.novoNome;

  // Recalcula caminhos da própria aba e de todos os descendentes.
  const abasAtualizadas: Aba[] = [];
  const abasAfetadasIds: string[] = [];

  const filhosPorPai = new Map<string | null, Aba[]>();
  for (const candidata of abas) {
    const lista = filhosPorPai.get(candidata.abaPaiId) ?? [];
    lista.push(candidata);
    filhosPorPai.set(candidata.abaPaiId, lista);
  }

  function percorrer(abaAtual: Aba, nomesAcumulados: string[]): void {
    const nomesComEla = [...nomesAcumulados, abaAtual.id === idDaAba ? nomeNovo : abaAtual.nome];
    const caminhoNovo = calcularCaminhoAba(prefixoDaTela, nomesComEla);
    const atualizada: Aba = {
      ...abaAtual,
      nome: abaAtual.id === idDaAba ? nomeNovo : abaAtual.nome,
      nomeTruncadoNaTela:
        abaAtual.id === idDaAba ? /\.\.\.$/.test(nomeNovo) : abaAtual.nomeTruncadoNaTela,
      caminho: caminhoNovo,
    };
    abasAtualizadas.push(atualizada);
    abasAfetadasIds.push(atualizada.id);
    for (const filho of filhosPorPai.get(abaAtual.id) ?? []) {
      percorrer(filho, nomesComEla);
    }
  }

  percorrer(aba, []);

  await r().arvoreEscrita.salvarAbas(abasAtualizadas);

  // Parâmetros afetados: novo caminho + texto de busca.
  const parametrosAfetados = await r().parametroLeitura.listarPorAbas(abasAfetadasIds);
  const caminhosPorAba = new Map(abasAtualizadas.map((a) => [a.id, a.caminho]));
  const eventos: EventoHistorico[] = [];
  const paraSalvar: Parametro[] = parametrosAfetados.map((parametro) => {
    const caminhoNovo = `${caminhosPorAba.get(parametro.abaId) ?? ''} > ${parametro.nome}`;
    if (caminhoNovo !== parametro.caminho) {
      eventos.push({
        entidade: 'parametro',
        entidadeId: parametro.id,
        campo: 'caminho',
        valorAnterior: parametro.caminho,
        valorNovo: caminhoNovo,
        usuario: entrada.usuario,
        origem: 'renomeacao-aba',
      });
    }
    return {
      ...parametro,
      caminho: caminhoNovo,
      textoBusca: montarTextoBusca([parametro.nome, parametro.descricaoOriginal, parametro.oQueFaz, parametro.grupo, caminhoNovo]),
    };
  });
  eventos.push({
    entidade: 'aba',
    entidadeId: aba.id,
    campo: 'nome',
    valorAnterior: aba.nome,
    valorNovo: entrada.novoNome,
    usuario: entrada.usuario,
    origem: 'renomeacao-aba',
  });
  if (paraSalvar.length > 0) await r().parametroEscrita.salvarEmLote(paraSalvar);
  if (eventos.length > 0) await r().historico.registrar(eventos);
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export interface TagComContagem extends Tag {
  totalVinculos: number;
}

export async function listarTags(): Promise<TagComContagem[]> {
  const [tags, vinculos] = await Promise.all([
    r().tagLeitura.listar(),
    r().tagVinculo.listarTodos(),
  ]);
  const contagens = new Map<string, number>();
  for (const vinculo of vinculos) {
    contagens.set(vinculo.tagId, (contagens.get(vinculo.tagId) ?? 0) + 1);
  }
  return tags.map((tag) => ({ ...tag, totalVinculos: contagens.get(tag.id) ?? 0 }));
}

export async function criarTag(nome: string, cor: string | null = null): Promise<Tag> {
  return r().tagEscrita.criar(nome, cor);
}

export async function renomearTag(id: string, nome: string): Promise<void> {
  await r().tagEscrita.renomear(id, nome);
}

/** Mescla a tag de origem na de destino: move todos os vínculos e registra histórico. */
export async function mesclarTags(tagOrigemId: string, tagDestinoId: string, usuario: string | null): Promise<void> {
  await r().tagVinculo.substituirVinculos(tagOrigemId, tagDestinoId);
  await r().tagEscrita.excluir(tagOrigemId);
  await r().historico.registrar([
    {
      entidade: 'tag',
      entidadeId: tagDestinoId,
      campo: 'mesclada',
      valorAnterior: tagOrigemId,
      valorNovo: tagDestinoId,
      usuario,
      origem: 'mesclagem',
    },
  ]);
}

export async function aplicarTag(parametroId: string, tagId: string): Promise<void> {
  await r().tagVinculo.aplicar(parametroId, tagId);
}

export async function removerTag(parametroId: string, tagId: string): Promise<void> {
  await r().tagVinculo.remover(parametroId, tagId);
}

export async function parametrosDaTag(
  slug: string,
): Promise<{ tag: Tag; parametros: Parametro[] } | null> {
  const tag = await r().tagLeitura.buscarPorSlug(slug);
  if (!tag) return null;
  const vinculos = await r().tagVinculo.listarPorTag(tag.id);
  const parametros = await r().parametroImportacao.buscarPorIds(vinculos.map((vinculo) => vinculo.parametroId));
  parametros.sort((a, b) => a.caminho.localeCompare(b.caminho, 'pt-BR'));
  return { tag, parametros };
}

// ---------------------------------------------------------------------------
// Exportação (página da tag)
// ---------------------------------------------------------------------------

function escaparCsv(valor: string): string {
  return `"${valor.replace(/"/g, '""')}"`;
}

export function exportarCsv(parametros: Parametro[]): string {
  const colunas = ['id', 'nome', 'tipo', 'grupo', 'caminho', 'statusDocumentacao', 'oQueFaz'];
  const linhas = [colunas.join(';')];
  for (const p of parametros) {
    linhas.push(
      [p.id, p.nome, p.tipo, p.grupo, p.caminho, p.statusDocumentacao, p.oQueFaz ?? '']
        .map((valor) => escaparCsv(String(valor)))
        .join(';'),
    );
  }
  return linhas.join('\n');
}

export function exportarJson(parametros: Parametro[]): string {
  return JSON.stringify(parametros, null, 2);
}

export function baixarArquivo(nome: string, conteudo: string, tipoMime: string): void {
  const blob = new Blob([`\ufeff${conteudo}`], { type: tipoMime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  link.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Importação (delegada ao caso de uso — DIP)
// ---------------------------------------------------------------------------

export async function importarCatalogoAtual(
  conteudo: ConteudoFlat,
  opcoes: { dryRun: boolean; usuario: string | null },
): Promise<RelatorioImportacao> {
  return importarCatalogo(
    new FonteJsonPlano(conteudo),
    {
      leituraTipos: r().leituraTipos,
      escritaTipos: r().escritaTipos,
      arvoreLeitura: r().arvoreLeitura,
      arvoreEscrita: r().arvoreEscrita,
      parametroImportacao: r().parametroImportacao,
      parametroEscrita: r().parametroEscrita,
      historico: r().historico,
    },
    { dryRun: opcoes.dryRun, exigirTotal: conteudo.meta?.total_parametros ?? null },
  );
}

export async function desativarParametro(id: string, usuario: string | null): Promise<void> {
  await r().parametroEscrita.desativar(id);
  await r().historico.registrar([
    {
      entidade: 'parametro',
      entidadeId: id,
      campo: 'ativo',
      valorAnterior: 'true',
      valorNovo: 'false',
      usuario,
      origem: 'edicao',
    },
  ]);
}
