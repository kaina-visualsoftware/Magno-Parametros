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
