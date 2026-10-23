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
