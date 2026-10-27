/**
 * CLI de importação — equivalente ao importador da interface.
 *
 *   npm run importar -- --arquivo dados/origem/parametros_myc_flat.json [--dry-run]
 *
 * Usa conexão Postgres direta (DATABASE_URL no .env) através do adaptador
 * scripts/repositorio-pg.ts — o mesmo domínio e caso de uso da interface.
 */

import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { carregarAmbiente } from './ambiente';
import { criarRepositoriosPg } from './repositorio-pg';
import { FonteJsonPlano, importarCatalogo } from '../src/aplicacao/caso-uso-importar';
import { ConteudoFlat } from '../src/dominio/mapeador-arquivo';

carregarAmbiente();

const argumentos = process.argv.slice(2);
const valorDeOpcao = (nome: string): string | undefined => {
  const indice = argumentos.indexOf(`--${nome}`);
  return indice >= 0 ? argumentos[indice + 1] : undefined;
};
const temOpcao = (nome: string): boolean => argumentos.includes(`--${nome}`);

async function principal(): Promise<void> {
  const arquivo = valorDeOpcao('arquivo') ?? 'dados/origem/parametros_myc_flat.json';
  const dryRun = temOpcao('dry-run');

  if (!process.env.DATABASE_URL) {
    console.error('Erro: defina DATABASE_URL no arquivo .env.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: true },
    max: 2,
  });

  try {
    const repositorios = criarRepositoriosPg(pool);
    const conteudo = JSON.parse(readFileSync(arquivo, 'utf-8')) as ConteudoFlat;
    console.log(`Arquivo lido: ${arquivo}`);
    console.log(`Modo: ${dryRun ? 'PRÉ-VISUALIZAÇÃO (dry-run)' : 'EXECUÇÃO'}`);

    const relatorio = await importarCatalogo(
      new FonteJsonPlano(conteudo),
      repositorios,
      { dryRun, exigirTotal: conteudo.meta?.total_parametros ?? null },
    );

    console.log('');
    console.log('======== RELATÓRIO DE IMPORTAÇÃO ========');
    console.log(`Fonte:                  ${relatorio.fonte}`);
    console.log(`Parâmetros lidos:       ${relatorio.totalLido}`);
    console.log(`Telas novas:            ${relatorio.telasNovas}`);
    console.log(`Abas novas:             ${relatorio.abasNovas}`);
    console.log(`Tipos novos:            ${relatorio.tiposNovos.length ? relatorio.tiposNovos.join(', ') : '—'}`);
    console.log(`Novos:                  ${relatorio.novos}`);
    console.log(`Alterados na origem:    ${relatorio.alterados}`);
    console.log(`Inalterados:            ${relatorio.inalterados}`);
    console.log(`Conflitos (humanos):    ${relatorio.conflitos.length ? relatorio.conflitos.join(', ') : '—'}`);
    console.log(`Ausentes na origem:     ${relatorio.naoEncontradosNaOrigem.length ? relatorio.naoEncontradosNaOrigem.join(', ') : '—'}`);
    console.log(`Alertas:                ${relatorio.alertas.length}`);
    for (const alerta of relatorio.alertas.slice(0, 30)) console.log(`  ⚠ ${alerta}`);
    if (relatorio.alertas.length > 30) console.log(`  ... e mais ${relatorio.alertas.length - 30} alertas`);
    console.log('=========================================');
  } finally {
    await pool.end();
  }
}

principal().catch((erro) => {
  console.error('Falha na importação:', erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
