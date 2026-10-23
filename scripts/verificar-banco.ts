/**
 * Verifica o estado do banco: tabelas, usuário admin e contagens do catálogo.
 *
 *   npm run verificar-banco
 */

import { carregarAmbiente } from './ambiente';
import { Client } from 'pg';

carregarAmbiente();

async function principal(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error('Defina DATABASE_URL no .env.');
    process.exit(1);
  }
  const cliente = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await cliente.connect();

  const tabelas = await cliente.query<{ table_name: string }>(
    "select table_name from information_schema.tables where table_schema = 'public' and table_name <> '_migracoes' order by 1",
  );
  console.log('Tabelas:', tabelas.rows.map((r) => r.table_name).join(', '));

  const migrações = await cliente.query<{ nome: string }>('select nome from public._migracoes order by id');
  console.log('Migrações aplicadas:', migrações.rows.map((r) => r.nome).join(' → '));

  const usuarios = await cliente.query<{ email: string; papel: string }>(
    'select u.email, p.papel from auth.users u join public.profiles p on p.id = u.id order by u.email',
  );
  for (const u of usuarios.rows) console.log(`Usuário: ${u.email} · papel: ${u.papel}`);

  const senhaOk = await cliente.query<{ ok: boolean }>(
    "select (encrypted_password = crypt('mago', encrypted_password)) as ok from auth.users where email = 'admin@magno.com.br'",
  );
  console.log('Senha "mago" válida para admin@magno.com.br:', senhaOk.rows[0]?.ok === true);

  const contagens = await cliente.query<{ tela: string; parametros: string }>(
    `select t.nome as tela, count(p.id)::text as parametros
       from telas t left join abas a on a.tela_id = t.id
       left join parametros p on p.aba_id = a.id
      group by t.nome order by t.nome`,
  );
  for (const linha of contagens.rows) console.log(`Tela "${linha.tela}": ${linha.parametros} parâmetros`);
  const total = await cliente.query<{ total: string }>('select count(*)::text as total from parametros');
  console.log('Total de parâmetros no banco:', total.rows[0]?.total ?? '0');

  const recortes = await cliente.query<{ total: string }>(
    'select count(*)::text as total from parametros where imagem_marcada',
  );
  console.log('Parâmetros com imagem destacada:', recortes.rows[0]?.total ?? '0');

  await cliente.end();
}

principal().catch((erro) => {
  console.error('Falha na verificação:', erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
