-- Gerado por npm run gerar-schema. Não editar: altere migracoes/*.sql.
-- ============================================================================
-- Migração 0001 — estrutura inicial do catálogo
-- ===========================================================================

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- Tipos de parâmetro (cadastro extensível — tipos são DADOS, não código)
create table if not exists tipos_parametro (
  codigo text primary key,
  descricao text,
  componentes text[] not null default '{}',
  criado_em timestamptz not null default now()
);

-- Telas
create table if not exists telas (
  id text primary key,
  nome text not null,
  descricao text,
  prefixo_caminho text not null
);

-- Abas (árvore de profundidade arbitrária; aba_pai_id nulo = raiz)
create table if not exists abas (
  id text primary key,
  tela_id text not null references telas(id) on delete cascade,
  aba_pai_id text references abas(id) on delete cascade,
  nome text not null,
  nome_original_importado text,
  nome_truncado_na_tela boolean not null default false,
  ordem int not null default 0,
  caminho text not null,
  unique (tela_id, aba_pai_id, nome)
);
create index if not exists idx_abas_tela on abas(tela_id);
create index if not exists idx_abas_pai on abas(aba_pai_id);

-- Parâmetros
create table if not exists parametros (
  id text primary key,
  aba_id text not null references abas(id) on delete cascade,
  grupo text not null,
  nome text not null,
  tipo text not null references tipos_parametro(codigo),
  opcoes text[] not null default '{}',
  descricao_original text,

  -- Campos editáveis por pessoas (nunca sobrescritos pela importação)
  o_que_faz text,
  impacto text,
  valor_padrao text,
  observacoes text,
  status_documentacao text not null default 'pendente'
    check (status_documentacao in ('pendente', 'documentado', 'revisado')),

  origem text not null default 'importado' check (origem in ('importado', 'manual')),
  hash_origem text,
  editado_na_origem boolean not null default false,
  ordem int not null default 0,
  ativo boolean not null default true,

  caminho text not null,
  imagem_origem text,
  texto_busca text not null default ''
);
create index if not exists idx_parametros_aba on parametros(aba_id);
create index if not exists idx_parametros_tipo on parametros(tipo);
create index if not exists idx_parametros_busca on parametros using gin (texto_busca gin_trgm_ops);
create index if not exists idx_parametros_status on parametros(status_documentacao);

-- Tags e vínculos
create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null unique,
  descricao text,
  cor text,
  criado_em timestamptz not null default now()
);

create table if not exists parametro_tags (
  parametro_id text not null references parametros(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  origem text not null default 'manual' check (origem in ('manual', 'sugerida')),
  criado_em timestamptz not null default now(),
  primary key (parametro_id, tag_id)
);
create index if not exists idx_parametro_tags_tag on parametro_tags(tag_id);

-- Auditoria
create table if not exists historico_alteracoes (
  id bigint generated always as identity primary key,
  entidade text not null,
  entidade_id text not null,
  campo text not null,
  valor_anterior text,
  valor_novo text,
  usuario text,
  origem text,
  criado_em timestamptz not null default now()
);
create index if not exists idx_historico_entidade on historico_alteracoes(entidade, entidade_id);

-- Perfis e papéis
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  papel text not null default 'leitor' check (papel in ('leitor', 'editor', 'administrador')),
  criado_em timestamptz not null default now()
);

-- ============================================================================
-- Migração 0002 — funções de papel e criação automática de perfil
-- ===========================================================================

-- Papel do usuário autenticado atual (usado nas políticas RLS)
create or replace function public.papel_atual() returns text
language sql stable security definer set search_path = public as $$
  select papel from public.profiles where id = auth.uid()
$$;

-- Toda conta nova nasce 'leitor'
create or replace function public.criar_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_profile();

-- ============================================================================
-- Migração 0003 — Row Level Security
-- Leitura pública; escrita conforme o papel.
-- Importação e mesclagem de tags exigem administrador.
-- ===========================================================================

alter table tipos_parametro enable row level security;
alter table telas enable row level security;
alter table abas enable row level security;
alter table parametros enable row level security;
alter table tags enable row level security;
alter table parametro_tags enable row level security;
alter table historico_alteracoes enable row level security;
alter table profiles enable row level security;

-- Leitura pública (catálogo aberto)
drop policy if exists "leitura publica" on tipos_parametro;
create policy "leitura publica" on tipos_parametro for select using (true);
drop policy if exists "leitura publica" on telas;
create policy "leitura publica" on telas for select using (true);
drop policy if exists "leitura publica" on abas;
create policy "leitura publica" on abas for select using (true);
drop policy if exists "leitura publica" on parametros;
create policy "leitura publica" on parametros for select using (true);
drop policy if exists "leitura publica" on tags;
create policy "leitura publica" on tags for select using (true);
drop policy if exists "leitura publica" on parametro_tags;
create policy "leitura publica" on parametro_tags for select using (true);
drop policy if exists "leitura autenticada" on historico_alteracoes;
create policy "leitura autenticada" on historico_alteracoes for select to authenticated using (true);

-- Parâmetros: insert/delete = administrador; update = editor ou administrador
drop policy if exists "insert admin" on parametros;
create policy "insert admin" on parametros for insert to authenticated
  with check (public.papel_atual() = 'administrador');
drop policy if exists "update editor ou admin" on parametros;
create policy "update editor ou admin" on parametros for update to authenticated
  using (public.papel_atual() in ('editor', 'administrador'));
drop policy if exists "delete admin" on parametros;
create policy "delete admin" on parametros for delete to authenticated
  using (public.papel_atual() = 'administrador');

-- Árvore (telas/abas): administração total por administrador
drop policy if exists "insert admin" on telas;
create policy "insert admin" on telas for insert to authenticated
  with check (public.papel_atual() = 'administrador');
drop policy if exists "update admin" on telas;
create policy "update admin" on telas for update to authenticated
  using (public.papel_atual() = 'administrador');
drop policy if exists "delete admin" on telas;
create policy "delete admin" on telas for delete to authenticated
  using (public.papel_atual() = 'administrador');

drop policy if exists "insert admin" on abas;
create policy "insert admin" on abas for insert to authenticated
  with check (public.papel_atual() = 'administrador');
drop policy if exists "update editor ou admin" on abas;
create policy "update editor ou admin" on abas for update to authenticated
  using (public.papel_atual() in ('editor', 'administrador'));
drop policy if exists "delete admin" on abas;
create policy "delete admin" on abas for delete to authenticated
  using (public.papel_atual() = 'administrador');

-- Tipos: criados automaticamente pela importação (admin)
drop policy if exists "insert admin" on tipos_parametro;
create policy "insert admin" on tipos_parametro for insert to authenticated
  with check (public.papel_atual() = 'administrador');
drop policy if exists "update admin" on tipos_parametro;
create policy "update admin" on tipos_parametro for update to authenticated
  using (public.papel_atual() = 'administrador');

-- Tags: criação por editor/admin; gestão por admin
drop policy if exists "insert editor ou admin" on tags;
create policy "insert editor ou admin" on tags for insert to authenticated
  with check (public.papel_atual() in ('editor', 'administrador'));
drop policy if exists "update admin" on tags;
create policy "update admin" on tags for update to authenticated
  using (public.papel_atual() = 'administrador');
drop policy if exists "delete admin" on tags;
create policy "delete admin" on tags for delete to authenticated
  using (public.papel_atual() = 'administrador');

-- Vínculos tag ↔ parâmetro: editor/admin
drop policy if exists "insert editor ou admin" on parametro_tags;
create policy "insert editor ou admin" on parametro_tags for insert to authenticated
  with check (public.papel_atual() in ('editor', 'administrador'));
drop policy if exists "delete editor ou admin" on parametro_tags;
create policy "delete editor ou admin" on parametro_tags for delete to authenticated
  using (public.papel_atual() in ('editor', 'administrador'));

-- Histórico: criado por editor/admin, lido por autenticados
drop policy if exists "insert editor ou admin" on historico_alteracoes;
create policy "insert editor ou admin" on historico_alteracoes for insert to authenticated
  with check (public.papel_atual() in ('editor', 'administrador'));

-- Perfis: cada usuário vê o próprio papel
drop policy if exists "ver o proprio perfil" on profiles;
create policy "ver o proprio perfil" on profiles for select to authenticated
  using (auth.uid() = id);

-- Migração 0004 — reservada por compatibilidade com instalações existentes.
-- O provisionamento automático com credencial fixa foi removido por segurança.
-- Crie o usuário pelo Supabase Auth e promova o perfil seguindo o README.
-- Esta mudança NÃO revoga credenciais nem sessões já existentes.
select 1;

-- ============================================================================
-- Migração 0005 — recorte de imagem com destaque do parâmetro
-- Marca os parâmetros cuja imagem anotada (retângulo vermelho) já foi gerada.
-- O arquivo é servido pelo próprio site: imagens-parametro/<id>.png
-- ===========================================================================

alter table parametros
  add column if not exists imagem_marcada boolean not null default false;

create index if not exists idx_parametros_imagem_marcada
  on parametros(imagem_marcada) where not imagem_marcada;

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

-- Leitura aditiva: clientes antigos continuam funcionando. Aplicar antes do frontend.
-- Sem índices especulativos: medir EXPLAIN no ambiente de homologação primeiro.
create or replace function public.listar_parametros_catalogo(
  p_filtros jsonb default '{}'::jsonb, p_cursor jsonb default null, p_limite integer default 50
) returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  termo text; tipo text; status text; origem text; ativo boolean; aba text;
  tags uuid[]; sem_tag boolean; operador text; coluna text; direcao text;
  filtros jsonb; assinatura text; comparador text; expressao_cursor text;
  registros jsonb; itens jsonb; ultimo jsonb; proximo jsonb := null;
begin
  if p_filtros is null or jsonb_typeof(p_filtros) <> 'object'
    or p_limite is null or p_limite < 1 or p_limite > 100 then
    raise exception 'Filtros ou limite inválidos.' using errcode = '22023';
  end if;
  if exists(select 1 from jsonb_object_keys(p_filtros) k where k not in
    ('termo','tipo','status','origem','ativo','aba','tags','semTag','operador','ordem','direcao')) then
    raise exception 'Filtro desconhecido.' using errcode = '22023';
  end if;
  if exists(select 1 from jsonb_each(p_filtros) e where e.key in
    ('termo','tipo','status','origem','aba','operador','ordem','direcao') and jsonb_typeof(e.value) <> 'string')
    or (p_filtros ? 'tags' and jsonb_typeof(p_filtros->'tags') <> 'array')
    or (p_filtros ? 'semTag' and jsonb_typeof(p_filtros->'semTag') <> 'boolean')
    or (p_filtros ? 'ativo' and jsonb_typeof(p_filtros->'ativo') not in ('boolean','null')) then
    raise exception 'Tipo de filtro inválido.' using errcode = '22023';
  end if;
  termo := btrim(regexp_replace(normalize(lower(coalesce(p_filtros->>'termo','')), NFD), U&'[\0300-\036f]', '', 'g'));
  tipo := nullif(p_filtros->>'tipo',''); status := nullif(p_filtros->>'status','');
  origem := nullif(p_filtros->>'origem',''); aba := nullif(p_filtros->>'aba','');
  ativo := case when p_filtros ? 'ativo' then (p_filtros->>'ativo')::boolean else true end;
  sem_tag := coalesce((p_filtros->>'semTag')::boolean, false);
  operador := coalesce(p_filtros->>'operador', 'OU');
  coluna := coalesce(p_filtros->>'ordem','nome'); direcao := coalesce(p_filtros->>'direcao','asc');
  if char_length(termo) > 200 or char_length(coalesce(tipo,'')) > 100
    or char_length(coalesce(aba,'')) > 500
    or (status is not null and status not in ('pendente','documentado','revisado'))
    or (origem is not null and origem not in ('manual','importado'))
    or operador not in ('E','OU') or coluna not in ('nome','grupo','caminho','ordem')
    or direcao not in ('asc','desc') or jsonb_array_length(coalesce(p_filtros->'tags','[]'::jsonb)) > 50 then
    raise exception 'Valor de filtro inválido.' using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct valor::uuid order by valor::uuid), '{}'::uuid[]) into tags
    from jsonb_array_elements_text(coalesce(p_filtros->'tags','[]'::jsonb)) t(valor);
  if array_position(tags, null) is not null or (sem_tag and cardinality(tags) > 0) then
    raise exception 'Escolha tags ou sem tag, não ambos.' using errcode = '22023';
  end if;
  filtros := jsonb_build_object('termo',termo,'tipo',tipo,'status',status,'origem',origem,
    'ativo',ativo,'aba',aba,'tags',tags,'semTag',sem_tag,'operador',operador,'ordem',coluna,'direcao',direcao);
  assinatura := md5(filtros::text);
  if p_cursor is not null then
    if jsonb_typeof(p_cursor) <> 'object' or p_cursor->>'v' is distinct from '1'
      or p_cursor->>'f' is distinct from assinatura or jsonb_typeof(p_cursor->'id') is distinct from 'string'
      or coalesce(p_cursor->>'id','') = '' or char_length(p_cursor->>'id') > 500
      or jsonb_typeof(p_cursor->'valor') is distinct from (case when coluna = 'ordem' then 'number' else 'string' end) then
      raise exception 'Cursor inválido ou incompatível com os filtros.' using errcode = '22023';
    end if;
    if coluna = 'ordem' then perform (p_cursor->>'valor')::integer; end if;
  end if;
  comparador := case when direcao = 'asc' then '>' else '<' end;
  expressao_cursor := case when coluna = 'ordem' then '($10->>''valor'')::integer' else '($10->>''valor'')' end;
  -- Identificador/direção vêm de allowlists; todos os valores permanecem parâmetros.
  execute format($sql$
    select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from (
      select p.id, p.nome, p.tipo, p.grupo, p.caminho, p.status_documentacao as "statusDocumentacao",
        p.origem, p.ativo, p.%1$I as "valorCursor"
      from public.parametros p
      where ($1 = '' or p.texto_busca ilike ('%%' || replace(replace(replace($1, E'\\', E'\\\\'), '%%', E'\\%%'), '_', E'\\_') || '%%'))
        and ($2 is null or p.tipo = $2) and ($3 is null or p.status_documentacao = $3)
        and ($4 is null or p.origem = $4) and ($5 is null or p.ativo = $5)
        and ($6 is null or p.aba_id = $6)
        and (not $7 or not exists(select 1 from public.parametro_tags pt where pt.parametro_id = p.id))
        and (cardinality($8) = 0 or
          ($9 = 'OU' and exists(select 1 from public.parametro_tags pt where pt.parametro_id = p.id and pt.tag_id = any($8))) or
          ($9 = 'E' and not exists(select 1 from unnest($8) t(id) where not exists
            (select 1 from public.parametro_tags pt where pt.parametro_id = p.id and pt.tag_id = t.id))))
        and ($10 is null or p.%1$I %2$s %3$s or (p.%1$I = %3$s and p.id > ($10->>'id')))
      order by p.%1$I %4$s, p.id asc limit $11
    ) r
  $sql$, coluna, comparador, expressao_cursor, direcao)
  into registros using termo,tipo,status,origem,ativo,aba,sem_tag,tags,operador,p_cursor,p_limite+1;
  select coalesce(jsonb_agg(e.value - 'valorCursor' order by e.ordinality), '[]'::jsonb) into itens
    from jsonb_array_elements(registros) with ordinality e where e.ordinality <= p_limite;
  if jsonb_array_length(registros) > p_limite then
    ultimo := registros->(p_limite-1);
    proximo := jsonb_build_object('v',1,'f',assinatura,'id',ultimo->>'id','valor',ultimo->'valorCursor');
  end if;
  return jsonb_build_object('itens',itens,'proximoCursor',proximo);
end $$;
revoke all on function public.listar_parametros_catalogo(jsonb,jsonb,integer) from public;
grant execute on function public.listar_parametros_catalogo(jsonb,jsonb,integer) to anon, authenticated;

create or replace function public.listar_tags_com_contagem() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(t) order by t.nome, t.id), '[]'::jsonb) from (
    select tags.id, tags.nome, tags.slug, tags.descricao, tags.cor, count(pt.parametro_id) as "totalVinculos"
    from public.tags tags left join public.parametro_tags pt on pt.tag_id = tags.id
    group by tags.id
  ) t;
$$;
revoke all on function public.listar_tags_com_contagem() from public;
grant execute on function public.listar_tags_com_contagem() to anon, authenticated;


-- Gestão de imagens (também em migracoes/0008_imagens_parametros_storage.sql)
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
    split_part(p_caminho, '/', 1) <> p_id or
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

-- ============================================================================
-- Migração 0009 — Limite de sugestões para Supabase Edge Function
-- ============================================================================
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

-- Migração 0010 — registros de importações
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

-- Migração 0011: correspondências editáveis
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
