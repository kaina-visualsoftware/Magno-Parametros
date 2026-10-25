-- Documentação via RPC: autorização, versão e auditoria na mesma transação.
-- Aplicar antes de publicar o frontend novo. Clientes antigos devem recarregar.
alter table public.parametros add column if not exists versao integer not null default 0;

create or replace function public.verificar_versao_parametro() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.versao is distinct from old.versao then
    raise exception 'Conflito de edição: recarregue o parâmetro antes de salvar.' using errcode = '40001';
  end if;
  new.versao := old.versao + 1;
  return new;
end $$;

drop trigger if exists verificar_versao on public.parametros;
create trigger verificar_versao before update on public.parametros
  for each row execute function public.verificar_versao_parametro();

drop policy if exists "update editor ou admin" on public.parametros;
drop policy if exists "update admin" on public.parametros;
create policy "update admin" on public.parametros for update to authenticated
  using (public.papel_atual() = 'administrador')
  with check (public.papel_atual() = 'administrador');

drop policy if exists "update editor ou admin" on public.abas;
drop policy if exists "update admin" on public.abas;
create policy "update admin" on public.abas for update to authenticated
  using (public.papel_atual() = 'administrador')
  with check (public.papel_atual() = 'administrador');

drop policy if exists "insert editor ou admin" on public.historico_alteracoes;
drop policy if exists "insert admin" on public.historico_alteracoes;
create policy "insert admin" on public.historico_alteracoes for insert to authenticated
  with check (public.papel_atual() = 'administrador');

create or replace function public.salvar_documentacao(
  p_id text, p_versao_esperada integer,
  p_o_que_faz text, p_impacto text, p_valor_padrao text,
  p_observacoes text, p_status text
) returns public.parametros
language plpgsql security definer set search_path = '' as $$
declare
  antes public.parametros;
  depois public.parametros;
  ator text;
begin
  if auth.uid() is null or coalesce(public.papel_atual(), '') not in ('editor', 'administrador') then
    raise exception 'Sem permissão para documentar parâmetros.' using errcode = '42501';
  end if;
  if p_id is null or btrim(p_id) = '' or p_versao_esperada is null or p_versao_esperada < 0
     or p_status is null or p_status not in ('pendente', 'documentado', 'revisado')
     or char_length(p_o_que_faz) > 20000 or char_length(p_impacto) > 20000
     or char_length(p_valor_padrao) > 20000 or char_length(p_observacoes) > 20000 then
    raise exception 'Documentação inválida: confira status, versão e limite de 20000 caracteres por campo.' using errcode = '22023';
  end if;

  select * into antes from public.parametros where id = p_id for update;
  if not found then
    raise exception 'Parâmetro não encontrado.' using errcode = 'P0002';
  end if;
  if antes.versao <> p_versao_esperada then
    raise exception 'Conflito de edição: recarregue o parâmetro antes de salvar. Seu rascunho foi preservado.' using errcode = '40001';
  end if;

  update public.parametros set
    o_que_faz = p_o_que_faz, impacto = p_impacto, valor_padrao = p_valor_padrao,
    observacoes = p_observacoes, status_documentacao = p_status,
    -- NFD remove todos os diacríticos usados pelo normalizador TypeScript.
    texto_busca = btrim(regexp_replace(normalize(lower(concat_ws(' ',
      nullif(nome, ''), nullif(descricao_original, ''), nullif(p_o_que_faz, ''),
      nullif(grupo, ''), nullif(caminho, ''))), NFD), U&'[\0300-\036f]', '', 'g'))
  where id = p_id and versao = p_versao_esperada
  returning * into depois;

  -- Identidade estável do usuário autenticado; nunca recebida do navegador.
  ator := auth.uid()::text;
  insert into public.historico_alteracoes
    (entidade, entidade_id, campo, valor_anterior, valor_novo, usuario, origem)
  select 'parametro', p_id, campo, valor_anterior, valor_novo, ator, 'edicao'
  from (values
    ('oQueFaz', antes.o_que_faz, depois.o_que_faz),
    ('impacto', antes.impacto, depois.impacto),
    ('valorPadrao', antes.valor_padrao, depois.valor_padrao),
    ('observacoes', antes.observacoes, depois.observacoes),
    ('statusDocumentacao', antes.status_documentacao, depois.status_documentacao)
  ) as diferencas(campo, valor_anterior, valor_novo)
  where valor_anterior is distinct from valor_novo;
  return depois;
end $$;

revoke all on function public.salvar_documentacao(text, integer, text, text, text, text, text) from public, anon;
grant execute on function public.salvar_documentacao(text, integer, text, text, text, text, text) to authenticated;
