/** Correspondências provenientes do arquivo parametros_myc_banco.json fornecido pelo usuário. */
export type ConfiancaBanco = 'alta' | 'media' | 'baixa';
export interface CorrespondenciaBanco {
  colunas: string[];
  confianca: ConfiancaBanco;
  observacao?: string;
}
export interface BaseCorrespondenciasBanco {
  meta: { tabela: string; total: number };
  mapeamentos: Record<string, CorrespondenciaBanco>;
  semColuna: string[];
  colunasCompartilhadas: string[];
}
export type ResultadoCorrespondencia =
  | { estado: 'mapeado'; tabela: string; correspondencia: CorrespondenciaBanco; compartilhadas: string[] }
  | { estado: 'sem-coluna'; tabela: string }
  | { estado: 'nao-listado'; tabela: string };

export function encontrarCorrespondencia(base: BaseCorrespondenciasBanco, id: string): ResultadoCorrespondencia {
  const correspondencia = Object.hasOwn(base.mapeamentos, id) ? base.mapeamentos[id] : undefined;
  if (correspondencia) {
    const compartilhadas = correspondencia.colunas.filter(coluna => base.colunasCompartilhadas.includes(coluna));
    return { estado:'mapeado', tabela:base.meta.tabela, correspondencia, compartilhadas };
  }
  if (base.semColuna.includes(id)) return { estado:'sem-coluna', tabela:base.meta.tabela };
  return { estado:'nao-listado', tabela:base.meta.tabela };
}

/** Consulta apenas leitura, sem presumir valor de ativação nem identificador de linha. */
export function gerarConsultaLeitura(tabela: string, colunas: string[]): string {
  if (!colunas.length) throw new Error('Nenhuma coluna informada');
  const quote = (identificador:string) => {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identificador)) throw new Error('Identificador SQL inesperado');
    return '\`'+identificador+'\`';
  };
  return `SELECT ${colunas.map(quote).join(', ')} FROM ${quote(tabela)} LIMIT 10;`;
}
