# Correspondência entre parâmetros MyCommerce e colunas do banco

Origem: arquivo `parametros_myc_banco.json` fornecido para esta implementação.

## Cobertura
- 950 parâmetros no levantamento.
- 866 parâmetros com correspondência na tabela `config`.
- 84 parâmetros sem coluna identificada.
- Entre as correspondências, 744 têm confiança alta, 108 média e 14 baixa.
- Uma mesma opção pode envolver várias colunas; algumas colunas são compartilhadas por parâmetros diferentes.

## Apresentação
Na página `/parametro/:id`, a seção **Correspondência no banco de dados** mostra:
- nome da tabela e colunas exatamente como no levantamento;
- nível de confiança e observações originais relevantes;
- alerta quando a coluna é compartilhada com outros parâmetros;
- ações **Copiar colunas** e **Copiar SELECT** (somente leitura);
- mensagem específica para parâmetro sem correspondência identificada ou novo parâmetro não listado.

Os dados são disponibilizados por arquivo estático em `public/dados/correspondencias-banco.json`.
A consulta carrega apenas na página de detalhes e é armazenada em cache pelo React Query.

## Limites de segurança e precisão
O levantamento foi gerado comparando nomes, tipos e contexto, sem acesso ao código-fonte do ERP ou aos dados reais da tabela. **Confiança alta não significa validação em produção.** A aplicação **não executa nenhuma alteração no banco do MyCommerce**.

Os comandos de escrita não são gerados porque o arquivo não informa:
- o tipo físico e os valores de ativação/desativação de cada coluna;
- a chave da linha que deve ser alterada, quando aplicável;
- efeitos colaterais, dependências e valores especiais.

O SELECT mostrado emprega aspas de identificador de MySQL/MariaDB e LIMIT 10. Confirme o dialeto, o esquema, os registros corretos e faça backup antes de alterar dados reais.

## Implantação
Nenhuma migração Supabase. Faça merge no repositório, execute o workflow de Pages e valide no detalhe de parâmetros com coluna única, múltiplas colunas e sem correspondência.
