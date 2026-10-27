# Cadastro e edição de correspondências de colunas

Este PR depende do PR #13 e acrescenta a edição das correspondências do banco diretamente na página de detalhes do parâmetro.

## Uso
1. Entre como administrador e abra qualquer parâmetro.
2. Na seção **Correspondência no banco de dados**, clique em **Cadastrar/editar correspondência**.
3. Informe a tabela do ERP, as colunas (uma por linha) e, se necessário, uma observação.
4. Salve. A informação passa a aparecer para todos os visitantes do catálogo.
5. Se quiser reverter uma correção, clique em **Restaurar original**, que volta à versão fornecida no arquivo. Nos parâmetros sem coluna identificada, volta a exibir a ausência de correspondência.

## Persistência
A tabela Supabase `correspondencias_banco` guarda somente as correções. O arquivo original `correspondencias-banco.json` não é alterado. Leitores e editores só consultam; apenas o papel administrador grava, segundo políticas de RLS. Um gatilho mantém a data e a identidade de quem atualizou.

## Validação
Os nomes das tabelas e colunas seguem um formato de identificadores simples; até 30 colunas são permitidas. A interface não executa UPDATE, INSERT nem DELETE no banco do MyCommerce e não adivinha valores para ativação de parâmetros.

## Implantação
A migração `0011_correspondencias_banco.sql` já foi aplicada ao projeto `magno-parametros`.
Faça merge do PR #13 primeiro; atualize a base deste PR para main e publique o frontend depois de aprovar os testes.
