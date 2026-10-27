-- Auditoria 2026-10: bloqueio da tabela de controle e RPCs internas.
-- A tabela de migrações é administrada por acesso privilegiado, nunca pelo cliente web.
alter table public._migracoes enable row level security;
revoke all privileges on table public._migracoes from public, anon, authenticated;

-- A função de trigger não é endpoint público; o gatilho auth.users continua executando.
revoke all on function public.criar_profile() from public, anon, authenticated;

-- A função de papel é usada nas políticas de usuários autenticados.
-- Anônimos não precisam chamá-la via RPC.
revoke all on function public.papel_atual() from public, anon;
grant execute on function public.papel_atual() to authenticated, service_role;

-- O log registra usuários e modificações administrativas.
-- Leitores comuns não devem ter acesso aos dados de auditoria.
drop policy if exists "leitura autenticada" on public.historico_alteracoes;
drop policy if exists "leitura equipe" on public.historico_alteracoes;
create policy "leitura equipe" on public.historico_alteracoes
for select to authenticated
using ((select public.papel_atual()) in ('editor','administrador'));

-- Evita reavaliar o identificador do usuário em cada linha.
drop policy if exists "ver o proprio perfil" on public.profiles;
create policy "ver o proprio perfil" on public.profiles
for select to authenticated using (id = (select auth.uid()));
