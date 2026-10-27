-- Correspondências corrigidas manualmente prevalecem sobre o JSON importado.
create table if not exists public.correspondencias_banco (
  parametro_id text primary key references public.parametros(id) on delete cascade,
  tabela text not null default 'config' check (tabela ~ '^[A-Za-z_][A-Za-z0-9_]{0,62}$'),
  colunas text[] not null check (
    cardinality(colunas) between 1 and 30
    and array_position(colunas, null) is null
  ),
  observacao text not null default '' check (char_length(observacao) <= 2000),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid not null default auth.uid()
);
create or replace function public.validar_colunas_correspondencia()
returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (
    select 1 from unnest(new.colunas) as coluna
    where coluna !~ '^[A-Za-z_][A-Za-z0-9_]{0,62}$'
  ) or cardinality(new.colunas) <> (select count(distinct coluna) from unnest(new.colunas) as coluna)
  then raise exception 'Colunas inválidas ou repetidas';
  end if;
  new.atualizado_em := now();
  new.atualizado_por := auth.uid();
  return new;
end $$;
drop trigger if exists validar_colunas_correspondencia on public.correspondencias_banco;
create trigger validar_colunas_correspondencia
before insert or update on public.correspondencias_banco
for each row execute function public.validar_colunas_correspondencia();

alter table public.correspondencias_banco enable row level security;
revoke all on public.correspondencias_banco from public, anon, authenticated;
grant select on public.correspondencias_banco to anon, authenticated;
grant insert, update, delete on public.correspondencias_banco to authenticated;
drop policy if exists "correspondencias leitura" on public.correspondencias_banco;
create policy "correspondencias leitura" on public.correspondencias_banco
for select to anon, authenticated using (true);
drop policy if exists "correspondencias admin insert" on public.correspondencias_banco;
create policy "correspondencias admin insert" on public.correspondencias_banco
for insert to authenticated with check ((select public.papel_atual())='administrador' and atualizado_por=(select auth.uid()));
drop policy if exists "correspondencias admin update" on public.correspondencias_banco;
create policy "correspondencias admin update" on public.correspondencias_banco
for update to authenticated using ((select public.papel_atual())='administrador')
with check ((select public.papel_atual())='administrador' and atualizado_por=(select auth.uid()));
drop policy if exists "correspondencias admin delete" on public.correspondencias_banco;
create policy "correspondencias admin delete" on public.correspondencias_banco
for delete to authenticated using ((select public.papel_atual())='administrador');
