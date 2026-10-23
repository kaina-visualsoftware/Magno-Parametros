/**
 * Portas do domínio/aplicação (DIP) — interfaces segregadas por papel (ISP).
 * Infraestrutura (Supabase) implementa estas portas; os casos de uso só
 * dependem das interfaces de que realmente precisam.
 */

import {
  Aba,
  EventoHistorico,
  LinhaHistorico,
  OrigemItem,
  Parametro,
  StatusDocumentacao,
  Tag,
  Tela,
  TipoParametro,
} from '../dominio/entidades';

export interface FiltrosParametros {
  termo?: string;
  telaId?: string;
  abaIds?: string[];
  tipo?: string;
  tagIds?: string[];
  operadorTags?: 'E' | 'OU';
  semTag?: boolean;
  statusDocumentacao?: StatusDocumentacao;
  origem?: OrigemItem;
  ativo?: boolean;
  pagina: number;
  porPagina: number;
  ordenarPor?: 'ordem' | 'nome' | 'grupo' | 'caminho';
  direcao?: 'asc' | 'desc';
}

export interface PaginaParametros {
  itens: Parametro[];
  total: number;
}

// ---------------------------------------------------------------------------
// Parâmetros
// ---------------------------------------------------------------------------

/** Somente leitura de parâmetros. */
export interface ParametroLeitura {
  buscarPorId(id: string): Promise<Parametro | null>;
  listar(filtros: FiltrosParametros): Promise<PaginaParametros>;
  listarPorAbas(abaIds: string[]): Promise<Parametro[]>;
  contagemPorAba(): Promise<Record<string, number>>;
}

/** Porta estreita usada exclusivamente pela importação. */
export interface ParametroImportacao {
  buscarPorIds(ids: string[]): Promise<Parametro[]>;
  salvarEmLote(parametros: Parametro[]): Promise<void>;
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
  listarTodos(): Promise<VinculoTagLista[]>;
  listarPorParametro(parametroId: string): Promise<VinculoTagLista[]>;
  listarPorTag(tagId: string): Promise<VinculoTagLista[]>;
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
