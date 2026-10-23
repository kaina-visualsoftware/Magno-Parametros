/**
 * SRP: única responsabilidade — calcular caminhos de navegação do ERP
 * a partir da árvore (Tela > Aba > Subaba > Parâmetro).
 * O caminho é sempre derivado, nunca digitado.
 */

export const SEPARADOR_CAMINHO = ' > ';

export function calcularCaminhoAba(prefixoTela: string, nomesAbas: string[]): string {
  const segmentos = prefixoTela ? [prefixoTela, ...nomesAbas] : [...nomesAbas];
  return segmentos.join(SEPARADOR_CAMINHO);
}

export function calcularCaminhoParametro(
  prefixoTela: string,
  nomesAbas: string[],
  nomeParametro: string,
): string {
  const segmentos = prefixoTela ? [prefixoTela, ...nomesAbas, nomeParametro] : [...nomesAbas, nomeParametro];
  return segmentos.join(SEPARADOR_CAMINHO);
}
