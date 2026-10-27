/**
 * Entidades e objetos de valor do domínio (camada mais interna).
 * Não dependem de framework, banco ou biblioteca — apenas TypeScript.
 */

export type Papel = 'leitor' | 'editor' | 'administrador';
export type StatusDocumentacao = 'pendente' | 'documentado' | 'revisado';
export type OrigemItem = 'importado' | 'manual';

export interface Tela {
  id: string;
  nome: string;
  descricao: string | null;
  /** Prefixo de navegação da tela no ERP (ex.: "Utilitários > Configuração > Administração do Sistema"). */
  prefixoCaminho: string;
}

export interface Aba {
  id: string;
  telaId: string;
  /** Nulo quando a aba é raiz da tela. */
  abaPaiId: string | null;
  nome: string;
  /** Nome exatamente como foi importado (preservado quando a aba é renomeada). */
  nomeOriginalImportado: string | null;
  /** Verdadeiro quando o nome veio cortado na tela de origem (ex.: "Condici..."). */
  nomeTruncadoNaTela: boolean;
  ordem: number;
  /** Caminho completo derivado da árvore — nunca digitado. */
  caminho: string;
}

export interface Parametro {
  id: string;
  /** Versão do banco usada para rejeitar gravações de documentação desatualizadas. */
  versao: number;
  abaId: string;
  grupo: string;
  nome: string;
  tipo: string;
  opcoes: string[];
  /** Texto explicativo que vinha na própria tela de origem (somente leitura na interface). */
  descricaoOriginal: string | null;

  // ---- Campos editáveis por pessoas (nunca sobrescritos pela importação) ----
  oQueFaz: string | null;
  impacto: string | null;
  valorPadrao: string | null;
  observacoes: string | null;
  statusDocumentacao: StatusDocumentacao;

  origem: OrigemItem;
  /** SHA-256 dos campos de origem normalizados — base da idempotência da importação. */
  hashOrigem: string | null;
  /** Verdadeiro quando alguém editou manualmente um campo de origem (gera conflito na importação). */
  editadoNaOrigem: boolean;
  ordem: number;
  ativo: boolean;

  /** Caminho completo derivado da árvore (Tela > Aba > ... > Parâmetro) — nunca digitado. */
  caminho: string;
  imagemOrigem: string | null;
  /** Recorte enviado pelo administrador; prevalece sobre o OCR. */
  imagemPersonalizadaPath: string | null;
  /** Verdadeiro quando o recorte com destaque (retângulo vermelho) já foi gerado. */
  imagemMarcada: boolean;
  /** Texto normalizado (sem acentos, minúsculo) usado pela busca. */
  textoBusca: string;
}

export interface TipoParametro {
  codigo: string;
  descricao: string | null;
  /** Componentes de tipos compostos (ex.: checkbox_numero → ['checkbox', 'numero']). */
  componentes: string[];
}

export interface Tag {
  id: string;
  nome: string;
  /** Minúsculo, sem acentos: "orçamento" e "orcamento" geram a mesma tag. */
  slug: string;
  descricao: string | null;
  cor: string | null;
}

export interface VinculoTag {
  parametroId: string;
  tagId: string;
  origem: 'manual' | 'sugerida';
}

export interface EventoHistorico {
  entidade: string;
  entidadeId: string;
  campo: string;
  valorAnterior: string | null;
  valorNovo: string | null;
  usuario: string | null;
  origem: string;
}

export interface LinhaHistorico extends EventoHistorico {
  id: number;
  criadoEm: string;
}
