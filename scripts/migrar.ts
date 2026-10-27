/**
 * Sistema de migrações — aplica, em ordem e uma única vez, os arquivos
 * SQL da pasta migracoes/ no banco Postgres do Supabase (conexão direta).
 *
 *   npm run migrar
 *
 * Requer DATABASE_URL no .env. Rastreia o estado em public._migracoes
 * e usa advisory lock para execução concorrente segura.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';
import { carregarAmbiente } from './ambiente';

carregarAmbiente();

const PASTA_MIGRACOES = 'migracoes';
const NOME_DO_LOCK = 'magno-parametros-migracoes';

async function principal(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('Erro: defina DATABASE_URL no arquivo .env (conexão Postgres direta do Supabase).');
    process.exit(1);
  }

  const cliente = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: true },
  });
  await cliente.connect();

  // Controle de versões + trava contra execução concorrente.
  await cliente.query(
    `create table if not exists public._migracoes (
       id serial primary key,
       nome text not null unique,
       aplicado_em timestamptz not null default now()
     )`,
  );
  await cliente.query(`select pg_advisory_lock(hashtext('${NOME_DO_LOCK}'))`);

  try {
    const { rows } = await cliente.query<{ nome: string }>('select nome from public._migracoes');
    const aplicadas = new Set(rows.map((linha) => linha.nome));

    const arquivos = readdirSync(PASTA_MIGRACOES)
      .filter((arquivo) => arquivo.endsWith('.sql'))
      .sort();

    let executadas = 0;
    for (const arquivo of arquivos) {
      if (aplicadas.has(arquivo)) {
        console.log(`· ${arquivo} (já aplicada)`);
        continue;
      }
      const sql = readFileSync(join(PASTA_MIGRACOES, arquivo), 'utf-8');
      console.log(`▶ Aplicando ${arquivo}…`);
      try {
        await cliente.query('begin');
        await cliente.query(sql);
        await cliente.query('insert into public._migracoes (nome) values ($1)', [arquivo]);
        await cliente.query('commit');
        executadas++;
        console.log('  ✓ aplicada');
      } catch (erro) {
        await cliente.query('rollback');
        console.error(`  ✗ falhou: ${erro instanceof Error ? erro.message : String(erro)}`);
        process.exitCode = 1;
        break;
      }
    }

    if (executadas === 0) console.log('Nada a aplicar — banco atualizado.');
    else console.log(`${executadas} migração(ões) aplicada(s).`);
  } finally {
    await cliente.query(`select pg_advisory_unlock(hashtext('${NOME_DO_LOCK}'))`);
    await cliente.end();
  }
}

principal().catch((erro) => {
  console.error('Falha nas migrações:', erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
