# Proposta — Imagens dos parâmetros gerenciadas pelo administrador

**Status:** planejado; nenhuma migração nem bucket criados nesta entrega.

## Situação atual

O pipeline `scripts/marcar-imagens.ts` usa OCR/Sharp para gerar recortes em
`public/imagens-parametro/<id>.png` e grava `parametros.imagem_marcada = true`.
A página de detalhe constrói uma URL estática a partir do ID. Isso impede
substituir um recorte sem publicar novamente o GitHub Pages, e o OCR pode
destacar o parâmetro incorreto. `imagem_origem` é apenas uma referência ao
nome da captura original; ela não representa um upload manual.

## Solução escolhida

**Supabase Storage com bucket privado e entrega autenticada por URL assinada
de leitura?** Não: as imagens precisam continuar públicas para visitantes do
catálogo. Recomenda-se um bucket **público para leitura** chamado
`imagens-parametros`, com **escrita exclusiva para administradores**, e uma
coluna separada `imagem_personalizada_path text null` na tabela `parametros`.

**Precedência:** quando `imagem_personalizada_path` estiver preenchido,
exibir essa imagem; caso contrário, mostrar o recorte estático criado pelo OCR
somente se `imagem_marcada = true`; quando nenhum existir, mostrar o estado
vazio com convite de upload apenas para administradores.

O campo `imagem_origem` e o arquivo importado permanecem intactos.
Uma nova importação nunca remove nem substitui `imagem_personalizada_path`.

## Interface

Na página `/parametro/:id`, exibir uma seção permanente **Imagem do parâmetro**
para todos (inclusive se não há imagem). Visitantes podem visualizar a captura
e um texto alternativo descritivo. Administradores verão:

- **Adicionar imagem** se nenhuma estiver disponível.
- **Substituir imagem** quando existir (manual ou OCR).
- **Restaurar imagem importada** quando houver recorte OCR e imagem manual.
- Prévia antes de salvar, confirmação de substituição e barra/estado de envio.
- Mensagens claras para tamanho, formato, permissão e falha no upload.

A primeira versão deve receber a imagem **já recortada** pelo administrador.
Uma evolução posterior pode adicionar seleção visual do recorte e marcação
do retângulo (sem OCR automático no navegador).

## Persistência e segurança

1. Criar uma migração aditiva em `migracoes/` e refletir no
   `supabase/schema.sql`: `parametros.imagem_personalizada_path text`.
2. Criar bucket público `imagens-parametros`. Definir tamanho máximo de 5 MB
   e MIME permitido `image/png`, `image/jpeg` e `image/webp`. Validar
   conteúdo no servidor/Storage, não apenas extensão e `File.type`.
   Evitar SVG e GIF (conteúdo ativo e animações desnecessárias).
3. Criar políticas Storage para `INSERT`, `UPDATE` e `DELETE` com
   `auth.uid() is not null and public.papel_atual() = 'administrador'`.
   A pasta de cada imagem será o identificador do parâmetro, devidamente
   sanitizado. Não aceitar caminhos arbitrários enviados pelo cliente.
4. Gravar objetos com **nomes únicos/versionados**, por exemplo
   `<id>/<uuid>.webp`, nunca sobrescrever URL existente: evita cache velho.
   Se a atualização do banco falhar, remover o objeto recém-criado;
   excluir o anterior somente depois de confirmar a persistência.
   Registrar rotina para limpar arquivos órfãos se a remoção também falhar.
5. Atualizar `imagem_personalizada_path` por função RPC autenticada,
   autorizada no servidor, usando **versão esperada** do parâmetro.
   A RPC registra `historico_alteracoes` com o usuário real obtido por
   `auth.uid()`, sem confiar em e-mail enviado pelo frontend.
6. Para reduzir abuso, permitir upload apenas a usuários autenticados com
   papel correto. O papel da UI é apenas informativo; RLS e RPC garantem
   autorização de verdade.

## Alterações no código

- `src/dominio/entidades.ts`: novo campo opcional de imagem personalizada.
- `src/dados/repositorios-supabase.ts`: mapear novo campo e interface
  de manipulação de imagens via serviço separado.
- `src/servicos/catalogo.ts`: upload e troca com validação e auditoria.
- `src/paginas/PaginaParametro.tsx`: prévia, envio, substituição, restauração
  e estado vazio; invalidar cache da consulta após salvar.
- `scripts/marcar-imagens.ts`: continuar gerando OCR legado, sem sobrescrever
  imagens personalizadas.
- `supabase/schema.sql`, nova migração e documentação operacional.

## Compatibilidade e implantação

A migração deve ser executada **antes** da publicação do frontend novo.
Os recortes existentes em GitHub Pages continuam funcionando; não é necessário
migrar as imagens já corretas. Para imagens com destaque incorreto, basta
enviar uma substituição. A reversão limpa somente o campo personalizado,
restaurando a visualização da imagem importada quando existir.

## Testes de aceitação

1. Visitante lê imagem manual e imagem OCR sem autenticação.
2. Visitante e editor não conseguem subir/substituir/excluir via API direta.
3. Administrador adiciona imagem a parâmetro sem recorte OCR.
4. Administrador substitui imagem errada, recarrega e encontra a nova imagem.
5. Restauração retorna ao OCR ou ao estado vazio sem apagar a origem.
6. Reimportação preserva imagem personalizada e histórico.
7. Arquivos > 5 MB, extensões não permitidas e conteúdo inválido são rejeitados.
8. Upload interrompido e concorrência de edição não deixam referência quebrada.
9. Browser desktop e mobile exibem prévia, loading, erro e texto alternativo.
10. As URLs versionadas evitam imagens antigas mantidas em cache.

## Etapas sugeridas

1. Migração/bucket/RLS/RPC, com testes de permissão.
2. Serviço de armazenamento e integração na página de detalhe.
3. Testes E2E e publicação controlada; depois evolução opcional de recorte.
