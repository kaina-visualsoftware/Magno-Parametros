/**
 * Infraestrutura: implementa as portas (DIP) sobre o Supabase.
 * Nenhuma regra de negócio aqui — apenas tradução entre Postgres e domínio.
 * Recebe o cliente Supabase por injeção (raiz de composição decide a instância).
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { PaginaCursor } from '../dominio/catalogo';
import {
  Aba,
  EventoHistorico,
  LinhaHistorico,
  Parametro,
  StatusDocumentacao,
  Tag,
  Tela,
  TipoParametro,
} from '../dominio/entidades';
import { criarSlug } from '../dominio/normalizador';
import {
  ArvoreEscrita,
  ArvoreLeitura,
  EscritaTipos,
  LeituraTipos,
  ParametroEscrita,
  ParametroImportacao,
  ParametroLeitura,
  PortasDeDados,
  RegistradorHistorico,
  TagEscrita,
  TagLeitura,
  TagVinculo,
  VinculoTagLista,
} from './portas';

type Linha = Record<string, unknown>;

function deLinhaParametro(linha: Linha): Parametro {
  return {
    id: String(linha.id),
    versao: Number(linha.versao ?? 0),
    abaId: String(linha.aba_id),
    grupo: String(linha.grupo ?? ''),
    nome: String(linha.nome),
    tipo: String(linha.tipo),
    opcoes: (linha.opcoes as string[] | null) ?? [],
    descricaoOriginal: (linha.descricao_original as string | null) ?? null,
    oQueFaz: (linha.o_que_faz as string | null) ?? null,
    impacto: (linha.impacto as string | null) ?? null,
    valorPadrao: (linha.valor_padrao as string | null) ?? null,
    observacoes: (linha.observacoes as string | null) ?? null,
    statusDocumentacao: (linha.status_documentacao as StatusDocumentacao) ?? 'pendente',
    origem: (linha.origem as Parametro['origem']) ?? 'importado',
    hashOrigem: (linha.hash_origem as string | null) ?? null,
    editadoNaOrigem: Boolean(linha.editado_na_origem),
    ordem: Number(linha.ordem ?? 0),
    ativo: linha.ativo !== false,
    caminho: String(linha.caminho ?? ''),
    imagemOrigem: (linha.imagem_origem as string | null) ?? null,
    imagemPersonalizadaPath: (linha.imagem_personalizada_path as string | null) ?? null,
    imagemMarcada: Boolean(linha.imagem_marcada),
    textoBusca: String(linha.texto_busca ?? ''),
  };
}

function paraLinhaParametro(p: Parametro): Linha {
  return {
    id: p.id,
    versao: p.versao,
    aba_id: p.abaId,
    grupo: p.grupo,
    nome: p.nome,
    tipo: p.tipo,
    opcoes: p.opcoes,
    descricao_original: p.descricaoOriginal,
    o_que_faz: p.oQueFaz,
    impacto: p.impacto,
    valor_padrao: p.valorPadrao,
    observacoes: p.observacoes,
    status_documentacao: p.statusDocumentacao,
    origem: p.origem,
    hash_origem: p.hashOrigem,
    editado_na_origem: p.editadoNaOrigem,
    ordem: p.ordem,
    ativo: p.ativo,
    caminho: p.caminho,
    imagem_origem: p.imagemOrigem,
    imagem_personalizada_path: p.imagemPersonalizadaPath,
    imagem_marcada: p.imagemMarcada,
    texto_busca: p.textoBusca,
  };
}

function deLinhaAba(linha: Linha): Aba {
  return {
    id: String(linha.id),
    telaId: String(linha.tela_id),
    abaPaiId: (linha.aba_pai_id as string | null) ?? null,
    nome: String(linha.nome),
    nomeOriginalImportado: (linha.nome_original_importado as string | null) ?? null,
    nomeTruncadoNaTela: Boolean(linha.nome_truncado_na_tela),
    ordem: Number(linha.ordem ?? 0),
    caminho: String(linha.caminho ?? ''),
  };
}

function deLinhaTela(linha: Linha): Tela {
  return {
    id: String(linha.id),
    nome: String(linha.nome),
    descricao: (linha.descricao as string | null) ?? null,
    prefixoCaminho: String(linha.prefixo_caminho ?? ''),
  };
}

function deLinhaTag(linha: Linha): Tag {
  return {
    id: String(linha.id),
    nome: String(linha.nome),
    slug: String(linha.slug),
    descricao: (linha.descricao as string | null) ?? null,
    cor: (linha.cor as string | null) ?? null,
  };
}

function emBlocos<T>(itens: T[], tamanho: number): T[][] {
  const blocos: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) {
    blocos.push(itens.slice(i, i + tamanho));
  }
  return blocos;
}

export function criarRepositoriosSupabase(cliente: SupabaseClient): PortasDeDados {
  // ---------------- Parâmetros ----------------

  async function buscarPorId(id: string): Promise<Parametro | null> {
    const { data, error } = await cliente.from('parametros').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? deLinhaParametro(data) : null;
  }

  async function listarPorAbas(abaIds: string[]): Promise<Parametro[]> {
    if (abaIds.length === 0) return [];
    const saida: Parametro[] = [];
    for (const bloco of emBlocos(abaIds, 200)) {
      const { data, error } = await cliente
        .from('parametros')
        .select('*')
        .in('aba_id', bloco)
        .order('ordem', { ascending: true });
      if (error) throw error;
      saida.push(...(data ?? []).map(deLinhaParametro));
    }
    return saida;
  }

  async function contagemPorAba(): Promise<Record<string, number>> {
    const { data, error } = await cliente.from('parametros').select('aba_id').eq('ativo', true);
    if (error) throw error;
    const contagens: Record<string, number> = {};
    for (const linha of data ?? []) {
      const id = String(linha.aba_id);
      contagens[id] = (contagens[id] ?? 0) + 1;
    }
    return contagens;
  }

  async function buscarPorIds(ids: string[]): Promise<Parametro[]> {
    if (ids.length === 0) return [];
    const saida: Parametro[] = [];
    for (const bloco of emBlocos(ids, 200)) {
      const { data, error } = await cliente.from('parametros').select('*').in('id', bloco);
      if (error) throw error;
      saida.push(...(data ?? []).map(deLinhaParametro));
    }
    return saida;
  }

  async function salvarEmLote(parametros: Parametro[]): Promise<void> {
    for (const bloco of emBlocos(parametros, 200)) {
      const { error } = await cliente
        .from('parametros')
        .upsert(bloco.map(paraLinhaParametro));
      if (error) throw error;
    }
  }

  async function salvar(parametro: Parametro): Promise<void> {
    const { error } = await cliente.from('parametros').upsert(paraLinhaParametro(parametro));
    if (error) throw error;
  }

  async function desativar(id: string): Promise<void> {
    const { error } = await cliente.from('parametros').update({ ativo: false }).eq('id', id);
    if (error) throw error;
  }

  const parametroLeitura: ParametroLeitura = { buscarPorId, listarPorAbas, contagemPorAba };
  const parametroImportacao: ParametroImportacao = {
    buscarPorIds,
    salvarEmLote,
    async listarIdsImportados() {
      const ids: string[] = [];
      const tamanho = 500;
      for (let inicio = 0; ; inicio += tamanho) {
        const { data, error } = await cliente.from('parametros').select('id')
          .eq('origem', 'importado').order('id').range(inicio, inicio + tamanho - 1);
        if (error) throw error;
        ids.push(...(data ?? []).map((linha) => String(linha.id)));
        if (!data || data.length < tamanho) return ids;
      }
    },
  };
  const parametroEscrita: ParametroEscrita = { ...parametroImportacao, salvar, desativar };

  // ---------------- Árvore ----------------

  const arvoreLeitura: ArvoreLeitura = {
    async listarTelas() {
      const { data, error } = await cliente.from('telas').select('*').order('nome');
      if (error) throw error;
      return (data ?? []).map(deLinhaTela);
    },
    async listarAbas() {
      const { data, error } = await cliente.from('abas').select('*').order('ordem');
      if (error) throw error;
      return (data ?? []).map(deLinhaAba);
    },
  };

  const arvoreEscrita: ArvoreEscrita = {
    async salvarTelas(telas) {
      const { error } = await cliente.from('telas').upsert(
        telas.map((t) => ({ id: t.id, nome: t.nome, descricao: t.descricao, prefixo_caminho: t.prefixoCaminho })),
      );
      if (error) throw error;
    },
    async salvarAbas(abas) {
      const { error } = await cliente.from('abas').upsert(
        abas.map((a) => ({
          id: a.id,
          tela_id: a.telaId,
          aba_pai_id: a.abaPaiId,
          nome: a.nome,
          nome_original_importado: a.nomeOriginalImportado,
          nome_truncado_na_tela: a.nomeTruncadoNaTela,
          ordem: a.ordem,
          caminho: a.caminho,
        })),
      );
      if (error) throw error;
    },
    async renomearAba(abaId, nome) {
      const { error } = await cliente.from('abas').update({ nome }).eq('id', abaId);
      if (error) throw error;
    },
  };

  // ---------------- Tipos ----------------

  const leituraTipos: LeituraTipos = {
    async listar() {
      const { data, error } = await cliente.from('tipos_parametro').select('*').order('codigo');
      if (error) throw error;
      return (data ?? []).map(
        (linha): TipoParametro => ({
          codigo: String(linha.codigo),
          descricao: (linha.descricao as string | null) ?? null,
          componentes: (linha.componentes as string[] | null) ?? [],
        }),
      );
    },
  };

  const escritaTipos: EscritaTipos = {
    async salvarEmLote(tipos) {
      const { error } = await cliente
        .from('tipos_parametro')
        .upsert(tipos.map((t) => ({ codigo: t.codigo, descricao: t.descricao, componentes: t.componentes })));
      if (error) throw error;
    },
  };

  // ---------------- Tags ----------------

  const tagLeitura: TagLeitura = {
    async listarComContagem() {
      const { data, error } = await cliente.rpc('listar_tags_com_contagem');
      if (error) throw new Error(error.message);
      if (!Array.isArray(data)) throw new Error('Resposta de tags inválida.');
      return data.map(linha => ({ ...deLinhaTag(linha), totalVinculos: Number(linha.totalVinculos) }));
    },
    async listarVinculadas(parametroId) {
      const { data, error } = await cliente.from('tags').select('*,parametro_tags!inner(parametro_id)').eq('parametro_tags.parametro_id', parametroId).order('nome');
      if (error) throw new Error(error.message);
      return (data ?? []).map(deLinhaTag);
    },
    async listar() {
      const { data, error } = await cliente.from('tags').select('*').order('nome');
      if (error) throw error;
      return (data ?? []).map(deLinhaTag);
    },
    async buscarPorSlug(slug) {
      const { data, error } = await cliente.from('tags').select('*').eq('slug', slug).maybeSingle();
      if (error) throw error;
      return data ? deLinhaTag(data) : null;
    },
  };

  const tagEscrita: TagEscrita = {
    // Idempotente: nomes diferentes com o mesmo slug resultam na MESMA tag.
    async criar(nome, cor = null) {
      const slug = criarSlug(nome);
      const { data: existente } = await cliente.from('tags').select('*').eq('slug', slug).maybeSingle();
      if (existente) return deLinhaTag(existente);
      const { data, error } = await cliente
        .from('tags')
        .insert({ nome: nome.trim(), slug, descricao: null, cor })
        .select('*')
        .single();
      if (error) throw error;
      return deLinhaTag(data);
    },
    async renomear(id, nome) {
      const { error } = await cliente.from('tags').update({ nome: nome.trim() }).eq('id', id);
      if (error) throw error;
    },
    async excluir(id) {
      const { error } = await cliente.from('tags').delete().eq('id', id);
      if (error) throw error;
    },
  };

  const tagVinculo: TagVinculo = {
    async listarPorParametro(parametroId) {
      const { data, error } = await cliente.from('parametro_tags').select('parametro_id, tag_id, origem').eq('parametro_id', parametroId);
      if (error) throw error;
      return (data ?? []).map(
        (linha): VinculoTagLista => ({
          parametroId: String(linha.parametro_id),
          tagId: String(linha.tag_id),
          origem: String(linha.origem ?? 'manual'),
        }),
      );
    },
    async aplicar(parametroId, tagId) {
      const { error } = await cliente
        .from('parametro_tags')
        .upsert({ parametro_id: parametroId, tag_id: tagId, origem: 'manual' });
      if (error) throw error;
    },
    async remover(parametroId, tagId) {
      const { error } = await cliente
        .from('parametro_tags')
        .delete()
        .eq('parametro_id', parametroId)
        .eq('tag_id', tagId);
      if (error) throw error;
    },
    async substituirVinculos(tagIdOrigem, tagIdDestino) {
      const { data, error } = await cliente.from('parametro_tags').select('parametro_id').eq('tag_id', tagIdOrigem);
      if (error) throw error;
      const vinculos = data ?? [];
      if (vinculos.length > 0) {
        const { error: erroInsercao } = await cliente
          .from('parametro_tags')
          .upsert(
            vinculos.map((linha) => ({ parametro_id: linha.parametro_id, tag_id: tagIdDestino, origem: 'manual' })),
            { onConflict: 'parametro_id,tag_id', ignoreDuplicates: true },
          );
        if (erroInsercao) throw erroInsercao;
        const { error: erroRemocao } = await cliente.from('parametro_tags').delete().eq('tag_id', tagIdOrigem);
        if (erroRemocao) throw erroRemocao;
      }
    },
  };

  // ---------------- Histórico ----------------

  const historico: RegistradorHistorico = {
    async registrar(eventos: EventoHistorico[]) {
      if (eventos.length === 0) return;
      for (const bloco of emBlocos(eventos, 200)) {
        const { error } = await cliente.from('historico_alteracoes').insert(
          bloco.map((evento) => ({
            entidade: evento.entidade,
            entidade_id: evento.entidadeId,
            campo: evento.campo,
            valor_anterior: evento.valorAnterior,
            valor_novo: evento.valorNovo,
            usuario: evento.usuario,
            origem: evento.origem,
          })),
        );
        if (error) throw error;
      }
    },
    async listar(entidade, entidadeId) {
      const { data, error } = await cliente
        .from('historico_alteracoes')
        .select('*')
        .eq('entidade', entidade)
        .eq('entidade_id', entidadeId)
        .order('criado_em', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []).map(
        (linha): LinhaHistorico => ({
          id: Number(linha.id),
          entidade: String(linha.entidade),
          entidadeId: String(linha.entidade_id),
          campo: String(linha.campo),
          valorAnterior: (linha.valor_anterior as string | null) ?? null,
          valorNovo: (linha.valor_novo as string | null) ?? null,
          usuario: (linha.usuario as string | null) ?? null,
          origem: String(linha.origem ?? ''),
          criadoEm: String(linha.criado_em ?? ''),
        }),
      );
    },
  };

  return {
    catalogoCursor: {
      async listar(filtros, cursor, signal) {
        let consulta = cliente.rpc('listar_parametros_catalogo', { p_filtros: filtros, p_cursor: cursor, p_limite: 50 });
        if (signal) consulta = consulta.abortSignal(signal);
        const { data, error } = await consulta;
        if (error) throw new Error(error.code === 'PGRST202'
          ? 'Catálogo indisponível: a migração 0007 precisa ser aplicada pelo administrador.' : error.message);
        if (!data || !Array.isArray(data.itens) || !('proximoCursor' in data)
          || data.itens.some((p: Record<string, unknown>) => !p || typeof p.id !== 'string' || typeof p.nome !== 'string')) {
          throw new Error('Resposta do catálogo inválida.');
        }
        return data as PaginaCursor;
      },
    },
    documentacao: {
      async salvar(entrada) {
        const { data, error } = await cliente.rpc('salvar_documentacao', {
          p_id: entrada.id,
          p_versao_esperada: entrada.versaoEsperada,
          p_o_que_faz: entrada.oQueFaz,
          p_impacto: entrada.impacto,
          p_valor_padrao: entrada.valorPadrao,
          p_observacoes: entrada.observacoes,
          p_status: entrada.statusDocumentacao,
        });
        if (error) throw new Error(error.message);
        if (!data) throw new Error('O servidor não retornou a documentação salva.');
        return deLinhaParametro(data);
      },
    },
    parametroLeitura,
    parametroImportacao,
    parametroEscrita,
    arvoreLeitura,
    arvoreEscrita,
    leituraTipos,
    escritaTipos,
    tagLeitura,
    tagEscrita,
    tagVinculo,
    historico,
  };
}
