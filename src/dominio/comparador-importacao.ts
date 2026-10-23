/**
 * SRP: única responsabilidade — decidir, para cada parâmetro da origem,
 * se ele é novo, inalterado, alterado ou conflito (regras da seção 5.3).
 * A importação nunca apaga itens ausentes no arquivo e nunca sobrescreve
 * campos editados manualmente.
 */

import { EventoHistorico, Parametro } from './entidades';

export interface ResultadoComparacao {
  /** Novos + alterados, prontos para persistir (campos editáveis preservados). */
  paraSalvar: Parametro[];
  novos: number;
  alterados: number;
  inalterados: number;
  /** Parâmetros com divergência entre edição manual e origem — exigem decisão humana. */
  conflitos: Parametro[];
  eventosHistorico: EventoHistorico[];
}

const CAMPOS_DE_ORIGEM = ['nome', 'tipo', 'grupo', 'descricaoOriginal', 'caminho'] as const;

export function compararParametros(
  entradas: Parametro[],
  existentes: Map<string, Parametro>,
): ResultadoComparacao {
  const paraSalvar: Parametro[] = [];
  const conflitos: Parametro[] = [];
  const eventosHistorico: EventoHistorico[] = [];
  let novos = 0;
  let alterados = 0;
  let inalterados = 0;

  for (const entrada of entradas) {
    const existente = existentes.get(entrada.id);

    if (!existente) {
      novos++;
      paraSalvar.push(entrada);
      eventosHistorico.push({
        entidade: 'parametro',
        entidadeId: entrada.id,
        campo: 'criado',
        valorAnterior: null,
        valorNovo: entrada.nome,
        usuario: null,
        origem: 'importacao',
      });
      continue;
    }

    if (existente.hashOrigem && entrada.hashOrigem === existente.hashOrigem) {
      inalterados++;
      continue;
    }

    // Origem mudou E alguém editou um campo de origem manualmente → conflito.
    if (existente.editadoNaOrigem) {
      conflitos.push(entrada);
      continue;
    }

    // Alterado na origem: atualiza SOMENTE campos de origem, preservando os
    // campos editáveis por pessoas e as tags (que não fazem parte da entidade).
    alterados++;
    const mesclado: Parametro = {
      ...existente,
      nome: entrada.nome,
      tipo: entrada.tipo,
      opcoes: entrada.opcoes,
      grupo: entrada.grupo,
      descricaoOriginal: entrada.descricaoOriginal,
      abaId: entrada.abaId,
      caminho: entrada.caminho,
      imagemOrigem: entrada.imagemOrigem,
      hashOrigem: entrada.hashOrigem,
      textoBusca: entrada.textoBusca,
    };
    paraSalvar.push(mesclado);

    for (const campo of CAMPOS_DE_ORIGEM) {
      const anterior = existente[campo];
      const novoValor = entrada[campo];
      if ((anterior ?? null) !== (novoValor ?? null)) {
        eventosHistorico.push({
          entidade: 'parametro',
          entidadeId: entrada.id,
          campo,
          valorAnterior: anterior ?? null,
          valorNovo: novoValor ?? null,
          usuario: null,
          origem: 'importacao',
        });
      }
    }
  }

  return { paraSalvar, novos, alterados, inalterados, conflitos, eventosHistorico };
}
