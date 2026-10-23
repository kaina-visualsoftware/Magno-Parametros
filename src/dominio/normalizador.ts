/**
 * Normalização de textos — SRP: uma única razão para mudar (regras de normalização).
 * Usada por slugs de tag, busca textual e hash de origem.
 */

/** Remove acentos/diacríticos de uma cadeia de caracteres. */
export function removerAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Minúsculo + sem acentos, para comparação de busca. */
export function normalizarParaBusca(texto: string): string {
  return removerAcentos(texto.toLowerCase().trim());
}

/**
 * Slug: minúsculo, sem acentos, sem espaços.
 * Garante que "Orçamento", "orcamento" e "ORÇAMENTO" resultem na mesma tag.
 */
export function criarSlug(nome: string): string {
  return normalizarParaBusca(nome)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Concatena campos relevantes para a coluna de busca textual. */
export function montarTextoBusca(campos: Array<string | null | undefined>): string {
  return normalizarParaBusca(campos.filter((campo): campo is string => Boolean(campo)).join(' '));
}
