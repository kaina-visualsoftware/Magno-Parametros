-- ============================================================================
-- Migração 0005 — recorte de imagem com destaque do parâmetro
-- Marca os parâmetros cuja imagem anotada (retângulo vermelho) já foi gerada.
-- O arquivo é servido pelo próprio site: imagens-parametro/<id>.png
-- ===========================================================================

alter table parametros
  add column if not exists imagem_marcada boolean not null default false;

create index if not exists idx_parametros_imagem_marcada
  on parametros(imagem_marcada) where not imagem_marcada;
