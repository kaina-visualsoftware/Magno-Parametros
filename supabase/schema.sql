-- ============================================================================
-- Catálogo de Parâmetros MyCommerce — esquema Supabase
-- Execute este arquivo inteiro no SQL Editor do projeto Supabase.
-- Leitura pública (anon) garantida por RLS; escrita apenas para
-- editor/administrador (via tabela profiles vinculada ao auth.users).
-- ============================================================================

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- Tipos de parâmetro (cadastro extensível — tipos são DADOS, não código)
-- ---------------------------------------------------------------------------
create table if not exists tipos_parametro (
  codigo text primary key,
  descricao text,
  componentes text[] not null default '{}',
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Telas
-- ---------------------------------------------------------------------------
create table if not exists telas (
  id text primary key,
  nome text not null,
  descricao text,
  prefixo_caminho text not null
);

-- ---------------------------------------------------------------------------
-- Abas (árvore de profundidade arbitrária; aba_pai_id nulo = raiz)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Parâmetros
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Tags e vínculos
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Auditoria
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Perfis e papéis (leitor | editor | administrador)
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  papel text not null default 'leitor' check (papel in ('leitor', 'editor', 'administrador')),
  criado_em timestamptz not null default now()
);

-- Função auxiliar: papel do usuário autenticado atual
create or replace function public.papel_atual() returns text
language sql stable security definer set search_path = public as $$
  select papel from public.profiles where id = auth.uid()
$$;

-- Trigger: cria o perfil automaticamente quando um usuário é criado no Auth
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

-- ===========================================================================
-- Row Level Security
-- Regra geral: leitura pública; escrita conforme o papel.
-- Importação e mesclagem de tags exigem administrador (aplicado na UI e aqui).
-- ===========================================================================

alter table tipos_parametro enable row level security;
alter table telas enable row level security;
alter table abas enable row level security;
alter table parametros enable row level security;
alter table tags enable row level security;
alter table parametro_tags enable row level security;
alter table historico_alteracoes enable row level security;
alter table profiles enable row level security;

-- ---- Leitura pública (catálogo aberto) ----
create policy "leitura publica" on tipos_parametro for select using (true);
create policy "leitura publica" on telas for select using (true);
create policy "leitura publica" on abas for select using (true);
create policy "leitura publica" on parametros for select using (true);
create policy "leitura publica" on tags for select using (true);
create policy "leitura publica" on parametro_tags for select using (true);
create policy "leitura autenticada" on historico_alteracoes for select to authenticated using (true);

-- ---- Parâmetros: insert/delete = administrador; update = editor ou administrador ----
create policy "insert admin" on parametros for insert to authenticated
  with check (public.papel_atual() = 'administrador');
create policy "update editor ou admin" on parametros for update to authenticated
  using (public.papel_atual() in ('editor', 'administrador'));
create policy "delete admin" on parametros for delete to authenticated
  using (public.papel_atual() = 'administrador');

-- ---- Árvore: administração total por administrador ----
create policy "insert admin" on telas for insert to authenticated
  with check (public.papel_atual() = 'administrador');
create policy "update admin" on telas for update to authenticated
  using (public.papel_atual() = 'administrador');
create policy "delete admin" on telas for delete to authenticated
  using (public.papel_atual() = 'administrador');

create policy "insert admin" on abas for insert to authenticated
  with check (public.papel_atual() = 'administrador');
create policy "update editor ou admin" on abas for update to authenticated
  using (public.papel_atual() in ('editor', 'administrador'));
create policy "delete admin" on abas for delete to authenticated
  using (public.papel_atual() = 'administrador');

-- ---- Tipos: criados automaticamente pela importação (admin) ----
create policy "insert admin" on tipos_parametro for insert to authenticated
  with check (public.papel_atual() = 'administrador');
create policy "update admin" on tipos_parametro for update to authenticated
  using (public.papel_atual() = 'administrador');

-- ---- Tags: admin gerencia; vínculos podem ser editados por editor/admin ----
create policy "insert admin" on tags for insert to authenticated
  with check (public.papel_atual() in ('editor', 'administrador'));
create policy "update admin" on tags for update to authenticated
  using (public.papel_atual() = 'administrador');
create policy "delete admin" on tags for delete to authenticated
  using (public.papel_atual() = 'administrador');

create policy "insert editor ou admin" on parametro_tags for insert to authenticated
  with check (public.papel_atual() in ('editor', 'administrador'));
create policy "delete editor ou admin" on parametro_tags for delete to authenticated
  using (public.papel_atual() in ('editor', 'administrador'));

-- ---- Histórico: criado por editor/admin, lido por autenticados ----
create policy "insert editor ou admin" on historico_alteracoes for insert to authenticated
  with check (public.papel_atual() in ('editor', 'administrador'));

-- ---- Perfis: cada usuário vê e não altera o próprio papel por aqui ----
create policy "ver o proprio perfil" on profiles for select to authenticated
  using (auth.uid() = id);

-- ===========================================================================
-- PROMOÇÃO DO PRIMEIRO ADMINISTRADOR
-- Após criar o usuário em Authentication > Users (ou pelo app em /entrar,
-- caso o cadastro esteja aberto), execute no SQL Editor:
--
-- update public.profiles set papel = 'administrador'
-- where id = (select id from auth.users where email = 'voce@empresa.com.br');
-- ===========================================================================
