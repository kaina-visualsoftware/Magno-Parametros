-- Imagens manuais têm prioridade sobre recortes OCR existentes.
alter table public.parametros add column if not exists imagem_personalizada_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('imagens-parametros', 'imagens-parametros', true, 5242880, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "imagens parametros admin select" on storage.objects;
create policy "imagens parametros admin select" on storage.objects
for select to authenticated using (
  bucket_id = 'imagens-parametros' and (select public.papel_atual()) = 'administrador'
);

drop policy if exists "imagens parametros admin insert" on storage.objects;
create policy "imagens parametros admin insert" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'imagens-parametros'
  and (select public.papel_atual()) = 'administrador'
  and exists(select 1 from public.parametros p where p.id = (storage.foldername(name))[1])
);
drop policy if exists "imagens parametros admin delete" on storage.objects;
create policy "imagens parametros admin delete" on storage.objects
for delete to authenticated
using (
  bucket_id = 'imagens-parametros'
  and (select public.papel_atual()) = 'administrador'
  and exists(select 1 from public.parametros p where p.id = (storage.foldername(name))[1])
);

create or replace function public.definir_imagem_parametro(
  p_id text, p_versao_esperada integer, p_caminho text
) returns public.parametros
language plpgsql security definer set search_path = '' as $$
declare
  anterior public.parametros;
  atualizado public.parametros;
begin
  if auth.uid() is null or public.papel_atual() is distinct from 'administrador' then
    raise exception 'Apenas administradores podem alterar imagens.' using errcode = '42501';
  end if;
  if p_id is null or length(p_id) < 1 or p_versao_esperada is null or p_versao_esperada < 0 then
    raise exception 'Dados inválidos.' using errcode = '22023';
  end if;
  if p_caminho is not null and (
    length(p_caminho) > 600 or
    p_caminho not like p_id || '/%' or
    p_caminho !~ '^[a-zA-Z0-9_-]+/[a-f0-9-]{36}\.(png|jpg|webp)$' or
    not exists(select 1 from storage.objects o where o.bucket_id='imagens-parametros'
      and o.name=p_caminho and o.metadata->>'mimetype' in ('image/png','image/jpeg','image/webp'))
  ) then
    raise exception 'Imagem inválida ou não encontrada.' using errcode='22023';
  end if;
  select * into anterior from public.parametros where id=p_id for update;
  if not found then raise exception 'Parâmetro não encontrado.' using errcode='P0002'; end if;
  if anterior.versao <> p_versao_esperada then
    raise exception 'Conflito de edição: recarregue o parâmetro.' using errcode='40001';
  end if;
  if anterior.imagem_personalizada_path is not distinct from p_caminho then return anterior; end if;
  update public.parametros set imagem_personalizada_path=p_caminho
  where id=p_id and versao=p_versao_esperada returning * into atualizado;
  insert into public.historico_alteracoes
   (entidade,entidade_id,campo,valor_anterior,valor_novo,usuario,origem)
  values ('parametro',p_id,'imagemPersonalizada',anterior.imagem_personalizada_path,p_caminho,auth.uid()::text,'edicao-imagem');
  return atualizado;
end $$;
revoke all on function public.definir_imagem_parametro(text,integer,text) from public, anon;
grant execute on function public.definir_imagem_parametro(text,integer,text) to authenticated;
