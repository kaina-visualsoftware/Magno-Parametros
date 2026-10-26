import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import dotenv from 'dotenv';

// Load .env and .env.local (if present) so VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are available
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const EMAIL = 'admin@spamok.com';
const PASSWORD = 'd9o67@rD8';

async function main() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  const serviceKey =
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey) {
    console.error('⚠️  VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required.');
    process.exit(1);
  }

  // Anonymous client (for regular Auth) and admin client (service_role) to bypass RLS when needed
  const supabaseAnon = createClient(url, anonKey);
  const supabaseAdmin = serviceKey ? createClient(url, serviceKey) : null;

  // ---------------------------------------------------------------
  // 1️⃣ Try to sign in – if the user exists we only need to ensure the role.
  // ---------------------------------------------------------------
  const { error: signInErr } = await supabaseAnon.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });

  if (!signInErr) {
    const { data } = await supabaseAnon.auth.getUser();
    if (data?.user?.id) await upsertAdminProfile(supabaseAdmin, data.user.id);
    console.log('✅ Admin user already existed and was authenticated.');
    process.exit(0);
  }

  // ---------------------------------------------------------------
  // 2️⃣ Create the user. Prefer the Admin API (service_role) to avoid rate limits.
  // ---------------------------------------------------------------
  let userId: string | undefined;
  if (supabaseAdmin && (supabaseAdmin as any).auth?.admin) {
    const { data: adminUser, error: adminErr } = await (supabaseAdmin as any).auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
    });
    if (adminErr) {
      console.error('❌ Failed to create admin user via Admin API:', adminErr.message);
      process.exit(1);
    }
    userId = adminUser?.user?.id;
  } else {
    const { data: signUp, error: signUpErr } = await supabaseAnon.auth.signUp({
      email: EMAIL,
      password: PASSWORD,
    });
    if (signUpErr) {
      console.error('❌ Failed to create admin user via sign‑up:', signUpErr.message);
      process.exit(1);
    }
    userId = signUp?.user?.id;
  }

  if (!userId) {
    console.error('❌ Could not obtain ID of newly created admin user.');
    process.exit(1);
  }

  await upsertAdminProfile(supabaseAdmin, userId);
  console.log('✅ Admin user created and marked as administrator.');
}

/**
 * Upsert (insert or update) the `profiles` row with papel = 'administrador'.
 * Uses the service_role client to bypass RLS policies.
 */
async function upsertAdminProfile(
  adminClient: any,
  userId: string
) {
  // Use provided admin client if available; otherwise create a client with anon credentials.
  const client = adminClient ?? createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
  );

  const { error } = await client
    .from('profiles')
    .upsert({ id: userId, papel: 'administrador' }, { ignoreDuplicates: true });

  if (error) {
    console.error('❌ Error upserting admin profile:', error.message);
    process.exit(1);
  }
}

// ---------------------------------------------------------------
// Execute
// ---------------------------------------------------------------
main().catch((e) => {
  console.error('❌ Unexpected exception:', e);
  process.exit(1);
});
