-- Rate limit atômico para sugestões públicas, executado apenas pelo backend.
create table if not exists public.limites_sugestoes (
  chave text not null,
  janela bigint not null,
  quantidade integer not null default 0,
  primary key (chave, janela)
);
alter table public.limites_sugestoes enable row level security;
revoke all on public.limites_sugestoes from public, anon, authenticated;

create or replace function public.consumir_limite_sugestao(p_chave text)
returns boolean
language plpgsql security invoker set search_path = ''
as $$
declare
  total integer;
  janela_atual bigint := floor(extract(epoch from now()) / 600)::bigint;
begin
  if current_user <> 'service_role' then
    raise exception 'Acesso reservado ao servidor' using errcode = '42501';
  end if;
  if p_chave is null or length(p_chave) <> 64 or p_chave !~ '^[0-9a-f]{64}$' then
    raise exception 'Chave inválida' using errcode = '22023';
  end if;
  insert into public.limites_sugestoes(chave, janela, quantidade)
  values (p_chave, janela_atual, 1)
  on conflict(chave, janela) do update
    set quantidade = public.limites_sugestoes.quantidade + 1
  returning quantidade into total;
  return total <= 3;
end $$;
revoke all on function public.consumir_limite_sugestao(text) from public, anon, authenticated;
grant execute on function public.consumir_limite_sugestao(text) to service_role;

grant usage on schema public to service_role;
grant select, insert, update on public.limites_sugestoes to service_role;
