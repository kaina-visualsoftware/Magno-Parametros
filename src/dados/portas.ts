/**
 * Portas do domínio/aplicação (DIP) — interfaces segregadas por papel (ISP).
 * Infraestrutura (Supabase) implementa estas portas; os casos de uso só
 * dependem das interfaces de que realmente precisam.
 */

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
import type { CursorCatalogo, FiltrosCatalogo, PaginaCursor } from '../dominio/catalogo';

// ---------------------------------------------------------------------------
// Parâmetros
// ---------------------------------------------------------------------------

/** Somente leitura de parâmetros fora da listagem paginada do catálogo. */
export interface ParametroLeitura {
  buscarPorId(id: string): Promise<Parametro | null>;
  listarPorAbas(abaIds: string[]): Promise<Parametro[]>;
  contagemPorAba(): Promise<Record<string, number>>;
}

/** Porta estreita usada exclusivamente pela importação. */
export interface ParametroImportacao {
  buscarPorIds(ids: string[]): Promise<Parametro[]>;
  listarIdsImportados(): Promise<string[]>;
  salvarEmLote(parametros: Parametro[]): Promise<void>;
}

export interface DocumentacaoParametro {
  id: string;
  versaoEsperada: number;
  oQueFaz: string | null;
  impacto: string | null;
  valorPadrao: string | null;
  observacoes: string | null;
  statusDocumentacao: StatusDocumentacao;
}

/** Escrita completa (cadastro/edição). */
export interface ParametroEscrita extends ParametroImportacao {
  salvar(parametro: Parametro): Promise<void>;
  desativar(id: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Árvore (telas + abas)
// ---------------------------------------------------------------------------

export interface ArvoreLeitura {
  listarTelas(): Promise<Tela[]>;
  listarAbas(): Promise<Aba[]>;
}

export interface ArvoreEscrita {
  salvarTelas(telas: Tela[]): Promise<void>;
  salvarAbas(abas: Aba[]): Promise<void>;
  renomearAba(abaId: string, nome: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Tipos de parâmetro (cadastro extensível — dados, não código)
// ---------------------------------------------------------------------------

export interface LeituraTipos {
  listar(): Promise<TipoParametro[]>;
}

export interface EscritaTipos {
  salvarEmLote(tipos: TipoParametro[]): Promise<void>;
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export interface TagLeitura {
  listarComContagem(): Promise<Array<Tag & { totalVinculos: number }>>;
  listarVinculadas(parametroId: string): Promise<Tag[]>;
  listar(): Promise<Tag[]>;
  buscarPorSlug(slug: string): Promise<Tag | null>;
}

export interface TagEscrita {
  criar(nome: string, cor?: string | null): Promise<Tag>;
  renomear(id: string, nome: string): Promise<void>;
  excluir(id: string): Promise<void>;
}

export interface VinculoTagLista {
  parametroId: string;
  tagId: string;
  origem: string;
}

export interface TagVinculo {
  listarPorParametro(parametroId: string): Promise<VinculoTagLista[]>;
  aplicar(parametroId: string, tagId: string): Promise<void>;
  remover(parametroId: string, tagId: string): Promise<void>;
  /** Usado pela mesclagem de tags: move todos os vínculos. */
  substituirVinculos(tagIdOrigem: string, tagIdDestino: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Auditoria
// ---------------------------------------------------------------------------

export interface RegistradorHistorico {
  registrar(eventos: EventoHistorico[]): Promise<void>;
  listar(entidade: string, entidadeId: string): Promise<LinhaHistorico[]>;
}

// ---------------------------------------------------------------------------
// Conjunto completo de portas (implementado pela infraestrutura)
// ---------------------------------------------------------------------------

export interface PortasDeDados {
  catalogoCursor: {
    listar(filtros: FiltrosCatalogo, cursor: CursorCatalogo | null, signal?: AbortSignal): Promise<PaginaCursor>;
  };
  /** Atualização parcial, com versão e histórico atômicos no servidor. */
  documentacao: { salvar(entrada: DocumentacaoParametro): Promise<Parametro> };
  parametroLeitura: ParametroLeitura;
  parametroImportacao: ParametroImportacao;
  parametroEscrita: ParametroEscrita;
  arvoreLeitura: ArvoreLeitura;
  arvoreEscrita: ArvoreEscrita;
  leituraTipos: LeituraTipos;
  escritaTipos: EscritaTipos;
  tagLeitura: TagLeitura;
  tagEscrita: TagEscrita;
  tagVinculo: TagVinculo;
  historico: RegistradorHistorico;
}
