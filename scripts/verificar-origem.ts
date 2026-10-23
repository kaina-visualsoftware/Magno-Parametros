/**
 * Valida o arquivo de origem SEM banco: mapeia, recalcula caminhos e confere
 * o total. Útil para checar dados antes de qualquer importação.
 *
 *   npm run verificar-origem -- --arquivo dados/origem/parametros_myc_flat.json
 */

import { readFileSync } from 'node:fs';
import { mapearArquivoFlat, ConteudoFlat } from '../src/dominio/mapeador-arquivo';
import { FonteJsonPlano } from '../src/aplicacao/caso-uso-importar';

const argumentos = process.argv.slice(2);
const indiceArquivo = argumentos.indexOf('--arquivo');
const arquivo = indiceArquivo >= 0 ? argumentos[indiceArquivo + 1] : 'dados/origem/parametros_myc_flat.json';

const conteudo = JSON.parse(readFileSync(arquivo, 'utf-8')) as ConteudoFlat;
const fonte = new FonteJsonPlano(conteudo);
const lido = await fonte.ler();
const mapeado = await mapearArquivoFlat(lido);

console.log('======== VERIFICAÇÃO DA ORIGEM (sem banco) ========');
console.log(`Parâmetros lidos:   ${mapeado.parametros.length} (esperado: ${lido.meta?.total_parametros ?? '?'})`);
console.log(`Telas:              ${mapeado.telas.length}`);
for (const tela of mapeado.telas) {
  console.log(`  · ${tela.nome} → prefixo: ${tela.prefixoCaminho}`);
}
console.log(`Abas na árvore:     ${mapeado.abas.length}`);
const tipos = new Set(mapeado.parametros.map((p) => p.tipo));
console.log(`Tipos distintos:    ${tipos.size}`);
console.log(`Alertas:            ${mapeado.alertas.length}`);
for (const alerta of mapeado.alertas.slice(0, 10)) console.log(`  ⚠ ${alerta}`);

const comanda = mapeado.parametros.find(
  (p) => p.id === 'geral_orcamento_solicitar_o_numero_da_comanda_ao_finalizar_orcamento',
);
console.log('');
console.log('Caminho da comanda (critério de aceite):');
console.log(comanda?.caminho ?? 'PARÂMETRO NÃO ENCONTRADO');

const esperado =
  'Utilitários > Configuração > Administração do Sistema > + Configurações > Geral > Orçamento > ' +
  'Solicitar o Número da Comanda ao finalizar Orçamento?';
console.log(comanda?.caminho === esperado ? '✓ Caminho confere exatamente.' : '✗ CAMINHO DIVERGENTE!');

const totaisBatendo = lido.meta?.total_parametros === mapeado.parametros.length;
console.log(totaisBatendo ? '✓ Total bate com meta.total_parametros.' : '✗ TOTAL DIVERGENTE!');
