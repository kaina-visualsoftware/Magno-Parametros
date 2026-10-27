# Administração — implementação das cinco fases

## Fase 1 · Navegação e cabeçalho
- Barra global conserva **Catálogo** e **Tags**, com acesso **Administração** apenas ao papel `administrador`.
- Opções de conta e saída ficam no menu de perfil.
- A ação **Sugerir correção** aparece apenas no detalhe de um parâmetro e preenche seu identificador.
- Botão **Novo parâmetro** recebe maior destaque no catálogo.

## Fase 2 · Painel
Rota `/admin`. Apresenta contagens reais de parâmetros ativos, documentação pendente, parâmetros sem imagem e origem editada. Também oferece atalhos para criação, importação, abas, tags, revisão e histórico.

A contagem **Origem editada** não significa necessariamente conflito real: indica itens que podem exigir atenção em uma reimportação.

## Fase 3 · Revisão e edição contextual
`/admin/revisao` usa paginação de 25 itens, busca por nome, filtros para documentação pendente, imagens ausentes, recortes OCR, origem editada e todos os parâmetros.
No detalhe do parâmetro, o administrador abre **Editar parâmetro** para ver ferramentas de origem, imagem e documentação, mantendo operações de gravação separadas por seção. Editores mantêm o fluxo atual de documentação.

## Fase 4 · Imagens e importações
A fila de recortes OCR mostra miniaturas e links para substituição na página do parâmetro.
`/admin/historico` lista as últimas 50 importações efetivamente gravadas, com data, totais e links para conflitos. Esse histórico começa após a implantação, não recupera importações anteriores.
A tabela `importacoes_registros` usa RLS: leitura e escrita somente a administradores autenticados; ator é vinculado ao `auth.uid()`.
A gravação do histórico acontece **depois** da importação. Se o log falhar, a interface avisa, sem reverter uma importação já executada.

## Fase 5 · Ações em lote
Na fila administrativa, selecionar até **25 parâmetros por página** e aplicar:
- Status de documentação (pendente / documentado / revisado);
- Uma tag existente.

Cada ação pede confirmação. A aplicação é sequencial e informa sucessos e falhas individualmente.
As alterações de documentação preservam todos os campos existentes e verificam versão antes de salvar.
Operações em lote **não são uma transação global**: se alguma falhar, alterações anteriores permanecem. Ações destrutivas em lote não foram incluídas por segurança.

## Publicação
1. O banco `magno-parametros` recebeu a migração `0010_registros_importacoes.sql`, aditiva.
2. Revisar CI e PR #11; realizar merge apenas com aprovação.
3. Validar manualmente com contas de administrador, editor e visitante em desktop e celular.
4. Testar uma importação pequena em ambiente de homologação antes de usar em produção.

## Próximas evoluções opcionais
- Filtros por tipo e tag na fila, além de busca por nome.
- Histórico global de ações administrativas com auditoria para tags em lote.
- Upload de imagens diretamente na fila, sem abrir o detalhe.
- Execuções em lote transacionais por RPC para grandes volumes e desfazer operações.
- Testes E2E de acessibilidade e responsividade.
