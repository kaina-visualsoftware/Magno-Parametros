# Administração — Fases 6, 7 e 8

Estas funcionalidades ampliam o PR #11 e reutilizam o Supabase Storage, RPC e histórico já existentes, sem nova migração.

## Fase 6 — Central de imagens
- Painel administrativo > Revisar imagens, rota /admin/imagens.
- Galeria paginada com busca, imagens ausentes, recortes OCR, imagens manuais e todos.
- Edição diretamente pelo painel, usando o componente de upload já existente.
- Imagens enviadas passam pela compressão e autorização já implementadas.

## Fase 7 — Importações
- Prévia obrigatória do mesmo arquivo antes de gravar; trocar a origem invalida a prévia.
- Baixar relatório atual em JSON.
- Histórico de importações com busca por fonte, filtro de conflitos, exportação geral CSV e relatório individual JSON.
- O histórico só contém importações executadas depois da implantação do PR #11.

## Fase 8 — Ações em lote
- Seleção de até 25 por página.
- Verificação prévia dos parâmetros e estados; ignora status e tags já aplicados.
- Confirmação explícita, relatório de sucesso/ignorado/falha e CSV exportável.
- Gravação sequencial: não é transação global; sucesso parcial é possível.
- Para ações com status, utiliza controle de versão e serviço de documentação existente.

## Publicação e verificação
1. Incorporar PR #11 primeiro.
2. Incorporar PR #12 depois de atualizar a base para main.
3. Executar CI e validação autenticada de upload, restauração, prévia, importação e lote.
4. Perfis anônimos e editores não podem gravar como admin: RLS/RPC no Supabase garante autorização.
5. Testar responsividade e erros de rede em desktop e celular.

Nenhum registro real do catálogo é modificado só por publicar o código desta branch.
