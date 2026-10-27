/**
 * Promove uma conta existente a administrador usando credenciais de servidor.
 * Nunca publique chaves service_role no frontend nem armazene senhas no código.
 *
 * ADMIN_USER_ID=<uuid> SUPABASE_URL=<url> SUPABASE_SERVICE_ROLE_KEY=<segredo> npm run criar-admin
 */
import { createClient } from '@supabase/supabase-js';
import * as path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const userId = process.env.ADMIN_USER_ID;

  if (!url || !serviceKey || !userId) {
    throw new Error('Defina SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e ADMIN_USER_ID no ambiente de execução.');
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
    throw new Error('ADMIN_USER_ID deve ser um UUID válido do Supabase Auth.');
  }

  const client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: usuario, error: erroUsuario } = await client.auth.admin.getUserById(userId);
  if (erroUsuario || !usuario.user) throw new Error('Usuário não encontrado no Supabase Auth.');

  // Não utilizar ignoreDuplicates: true: isso impede promover perfis existentes.
  const { error } = await client.from('profiles')
    .upsert({ id: userId, papel: 'administrador' }, { onConflict: 'id' });
  if (error) throw new Error('Não foi possível atualizar o papel: ' + error.message);

  const { data: perfil, error: erroLeitura } = await client.from('profiles')
    .select('papel').eq('id', userId).single();
  if (erroLeitura || perfil?.papel !== 'administrador') {
    throw new Error('Não foi possível confirmar a promoção do usuário.');
  }
  console.log('Perfil confirmado como administrador.');
}

main().catch((erro: unknown) => {
  console.error(erro instanceof Error ? erro.message : String(erro));
  process.exitCode = 1;
});
