-- ============================================================================
-- Migração 0004 — usuário administrador inicial
-- E-mail: admin@magno.com.br · Senha: mago
-- Idempotente: se o usuário já existir, apenas garante o papel.
-- ===========================================================================

do $$
declare
  v_email text := 'admin@magno.com.br';
  v_id uuid;
  v_tem_instance_id boolean;
  v_tem_provider boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'auth' and table_name = 'users' and column_name = 'instance_id'
  ) into v_tem_instance_id;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'auth' and table_name = 'identities' and column_name = 'provider'
  ) into v_tem_provider;

  if not exists (select 1 from auth.users where email = v_email) then
    v_id := gen_random_uuid();

    if v_tem_instance_id then
      insert into auth.users
        (instance_id, id, aud, role, email, encrypted_password,
         email_confirmed_at, created_at, updated_at,
         raw_app_meta_data, raw_user_meta_data,
         confirmation_token, recovery_token, email_change, email_change_token_new)
      values
        ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
         v_email, crypt('mago', gen_salt('bf', 10)),
         now(), now(), now(),
         '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
         '', '', '', '');
    else
      insert into auth.users
        (id, aud, role, email, encrypted_password,
         email_confirmed_at, created_at, updated_at,
         raw_app_meta_data, raw_user_meta_data,
         confirmation_token, recovery_token, email_change, email_change_token_new)
      values
        (v_id, 'authenticated', 'authenticated',
         v_email, crypt('mago', gen_salt('bf', 10)),
         now(), now(), now(),
         '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
         '', '', '', '');
    end if;

    -- A coluna "provider" existe nos schemas novos do GoTrue; o tipo de "id" varia (uuid/text).
    if v_tem_provider then
      if (select data_type from information_schema.columns
           where table_schema='auth' and table_name='identities' and column_name='id') = 'uuid' then
        insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
        values (v_id, v_id, 'email', 'email',
                jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
                now(), now(), now())
        on conflict do nothing;
      else
        insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
        values (v_id::text, v_id, 'email', 'email',
                jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
                now(), now(), now())
        on conflict do nothing;
      end if;
    else
      insert into auth.identities (id, user_id, provider_id, identity_data, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), v_id, 'email',
              jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
              now(), now(), now())
      on conflict do nothing;
    end if;
  end if;

  update public.profiles
     set papel = 'administrador'
   where id = (select id from auth.users where email = v_email);
end $$;
