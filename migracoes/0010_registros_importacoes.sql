-- Registro persistente das importações executadas pelo administrador.
create table if not exists public.importacoes_registros (
  id bigint generated always as identity primary key,
  criado_em timestamptz not null default now(),
  usuario_id uuid not null default auth.uid(),
  fonte text not null check(char_length(fonte) between 1 and 200),
  relatorio jsonb not null check(jsonb_typeof(relatorio)='object')
);
create index if not exists idx_importacoes_registros_data on public.importacoes_registros(criado_em desc);
alter table public.importacoes_registros enable row level security;
revoke all on public.importacoes_registros from anon;
grant select, insert on public.importacoes_registros to authenticated;
drop policy if exists "admin ler importacoes" on public.importacoes_registros;
create policy "admin ler importacoes" on public.importacoes_registros
for select to authenticated using ((select public.papel_atual())='administrador');
drop policy if exists "admin registrar importacoes" on public.importacoes_registros;
create policy "admin registrar importacoes" on public.importacoes_registros
for insert to authenticated with check (
  usuario_id = (select auth.uid()) and (select public.papel_atual())='administrador'
);
