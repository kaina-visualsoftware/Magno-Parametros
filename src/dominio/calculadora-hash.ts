/**
 * SRP: única responsabilidade — calcular o hash de origem de um parâmetro.
 * O hash (SHA-256) cobre apenas os campos que vêm do arquivo de origem,
 * normalizados, e é a base da idempotência da importação.
 */

export interface CamposDeOrigem {
  nome: string;
  tipo: string;
  opcoes: string[];
  grupo: string;
  descricaoOriginal: string | null;
  caminho: string;
}

function ordenarOpcoes(opcoes: string[]): string {
  return [...opcoes].sort((a, b) => a.localeCompare(b, 'pt-BR')).join('|');
}

export async function calcularHashOrigem(campos: CamposDeOrigem): Promise<string> {
  const base = JSON.stringify({
    nome: campos.nome.toLowerCase(),
    tipo: campos.tipo,
    opcoes: ordenarOpcoes(campos.opcoes),
    grupo: campos.grupo,
    descricaoOriginal: (campos.descricaoOriginal ?? '').toLowerCase(),
    caminho: campos.caminho,
  });
  const bytes = new TextEncoder().encode(base);
  const digesto = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digesto))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
