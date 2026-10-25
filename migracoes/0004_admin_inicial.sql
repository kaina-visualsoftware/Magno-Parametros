-- Migração 0004 — reservada por compatibilidade com instalações existentes.
-- O provisionamento automático com credencial fixa foi removido por segurança.
-- Crie o usuário pelo Supabase Auth e promova o perfil seguindo o README.
-- Esta mudança NÃO revoga credenciais nem sessões já existentes.
select 1;
