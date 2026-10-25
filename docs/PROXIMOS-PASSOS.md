# Próximos passos

## Segurança operacional — antes de usar o ambiente existente

A versão anterior publicou uma credencial administrativa fixa e registrou
exposição de token GitHub e senha do Postgres. Considere essas credenciais
comprometidas. Não reutilize nem reproduza os valores.

1. Troque a senha administrativa no Supabase Auth e encerre as sessões existentes.
2. Revogue o token GitHub exposto e rotacione a senha do Postgres.
3. Atualize as credenciais locais fora do repositório.
4. Revise usuários, papéis e alterações feitas durante o período de exposição.

Remover os valores dos arquivos não os remove do histórico Git e não os revoga.
A migração 0004 agora é um no-op: instalações novas exigem criação do usuário
pelo Auth e promoção explícita conforme o README. Instalações existentes não
têm suas contas alteradas automaticamente.

## Aplicação da correção

1. Faça backup e valide as migrações 0006 e 0007 em um projeto Supabase separado.
2. Aplique `npm run migrar` no ambiente autorizado antes de publicar o frontend.
3. Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` nos secrets do GitHub.
   Nunca use uma chave `service_role` em variável `VITE_`.
4. Publique o frontend e recarregue clientes antigos. Editores passam a salvar
   documentação exclusivamente pela RPC `salvar_documentacao`.
5. Confira leitura pública, login, documentação por editor, impedimento de
   alterações de origem por editor e operações administrativas.
6. Confirme que a RPC `listar_parametros_catalogo` responde 200 como `anon`; sem
   a migração 0007 o catálogo mostra uma orientação de rollout, sem fallback lento.

A migração adiciona `parametros.versao`, restringe UPDATE direto a administradores
e torna documentação e seu histórico uma transação. A versão carregada é
comparada no banco; conflitos preservam o rascunho na interface. Importação e
upserts administrativos também enviam a versão lida, rejeitando snapshots antigos.

### Recuperação

Não reverta políticas para a versão permissiva. Se o frontend novo falhar,
mantenha as restrições de escrita e use o catálogo em leitura enquanto corrige.
A coluna e a RPC são aditivas; mantenha-as até resolver clientes antigos.
Não remova dados ou restaure backup sem avaliar alterações posteriores.

## Estado histórico — não verificado novamente em produção

O último registro da v1 informa 950 parâmetros importados, cinco migrações
aplicadas e 855 imagens destacadas. Restam 95 recortes para revisão.
As configurações e contagens atuais precisam de conferência no ambiente autorizado.

## Próximas entregas

1. Revisar os 95 recortes pendentes e os casos ambíguos de OCR.
2. Sugestão e aplicação/remoção de tags em lote.
3. Exportação hierárquica do catálogo completo.
4. Fila de documentação e gráficos de progresso.
5. Ampliar E2E e integração com Supabase Auth/PostgREST reais em staging.

## Verificações locais

```bash
npm ci
npm run typecheck
npm test
npm run test:e2e
npm run build
```

Os testes de banco usam somente um Postgres descartável local com
`TEST_DATABASE_URL` terminando em `_test`; veja o README. Nenhum comando de
migração, importação ou OCR deve apontar para produção sem autorização.
