/**
 * OCP — Registro de tipos de parâmetro.
 *
 * O conjunto de tipos NÃO é fixo no código: cada tipo é atendido por um
 * ManipuladorTipo registrado. Adicionar um tipo novo = registrar um
 * manipulador novo, sem editar condicionais existentes. Tipos desconhecidos
 * caem no ManipuladorTipoGenerico (nunca quebram o fluxo — LSP).
 */

export interface ManipuladorTipo {
  readonly codigo: string;
  /** Partes que compõem o campo (para tipos compostos, ex.: checkbox_numero). */
  componentes(): string[];
  /** Retorna null quando as opções são válidas; mensagem de erro caso contrário. */
  validarOpcoes(opcoes?: string[] | null): string | null;
  descreverParaTela(dados: { nome: string; opcoes: string[] }): string;
}

/** Tipos de campo simples (checkbox, numero, texto, moeda, ...). */
export class ManipuladorTipoSimples implements ManipuladorTipo {
  constructor(
    readonly codigo: string,
    private readonly descricao: string,
  ) {}

  componentes(): string[] {
    return [];
  }

  validarOpcoes(): string | null {
    return null;
  }

  descreverParaTela(dados: { nome: string }): string {
    return `${dados.nome} — ${this.descricao}.`;
  }
}

/** Tipos que exigem lista de opções (select, radio, multi_select). */
export class ManipuladorListaOpcoes implements ManipuladorTipo {
  constructor(readonly codigo: string) {}

  componentes(): string[] {
    return [];
  }

  validarOpcoes(opcoes?: string[] | null): string | null {
    return opcoes && opcoes.length > 0 ? null : `Tipo "${this.codigo}" exige ao menos uma opção.`;
  }

  descreverParaTela(dados: { nome: string; opcoes: string[] }): string {
    return `${dados.nome} — escolha entre: ${dados.opcoes.join(', ')}.`;
  }
}

/**
 * Fallback para qualquer tipo novo/desconhecido (inclusive tipos compostos
 * futuros encontrados na importação). Nunca endurece pré-condições.
 */
export class ManipuladorTipoGenerico implements ManipuladorTipo {
  constructor(readonly codigo: string) {}

  componentes(): string[] {
    return [];
  }

  validarOpcoes(): string | null {
    return null;
  }

  descreverParaTela(dados: { nome: string }): string {
    return `${dados.nome} — parâmetro do tipo "${this.codigo}".`;
  }
}

const registro = new Map<string, ManipuladorTipo>();

export function registrarTipoParametro(manipulador: ManipuladorTipo): void {
  registro.set(manipulador.codigo, manipulador);
}

export function temTipoRegistrado(codigo: string): boolean {
  return registro.has(codigo);
}

export function manipuladorDoTipo(codigo: string): ManipuladorTipo {
  return registro.get(codigo) ?? new ManipuladorTipoGenerico(codigo);
}

export function tiposRegistrados(): string[] {
  return [...registro.keys()];
}

/** Indica se o formulário deve exibir o editor de opções. */
export function tipoExigeOpcoes(codigo: string): boolean {
  return manipuladorDoTipo(codigo) instanceof ManipuladorListaOpcoes;
}

// ---- Registro inicial (ponto de partida; extensível sem editar nada acima) ----
const tiposSimples: Array<[string, string]> = [
  ['checkbox', 'caixa de marcação'],
  ['numero', 'campo numérico'],
  ['percentual', 'campo percentual'],
  ['moeda', 'campo monetário'],
  ['texto', 'campo de texto'],
  ['senha', 'campo de senha'],
  ['botao', 'botão de ação'],
  ['grid', 'grade de registros'],
  ['codigo_descricao', 'código e descrição'],
  ['arquivo', 'seleção de arquivo'],
  ['hora', 'campo de hora'],
];
for (const [codigo, descricao] of tiposSimples) {
  registrarTipoParametro(new ManipuladorTipoSimples(codigo, descricao));
}
for (const codigo of ['select', 'radio', 'multi_select']) {
  registrarTipoParametro(new ManipuladorListaOpcoes(codigo));
}
