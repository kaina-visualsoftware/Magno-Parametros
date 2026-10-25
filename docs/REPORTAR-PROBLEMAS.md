# Reportar Problemas ou Sugerir Parâmetros

O catálogo possui um botão de "Reportar" no header (apenas para usuários autenticados) que permite abrir uma issue no GitHub para reportar problemas ou sugerir novos parâmetros.

## Como Funciona

1. Clique no botão de bug no header (ícone de inseto)
2. Preencha a descrição do problema ou sugestão
3. (Opcional) Adicione a URL do parâmetro se souber o caminho exato
4. Clique em "Enviar para GitHub Issues"
5. O sistema cria automaticamente uma issue no repositório `kaina-visualsoftware/Myc.config`

## Requisitos

Para que o botão funcione, você precisa configurar uma variável de ambiente no arquivo `.env.local`:

```bash
VITE_GITHUB_TOKEN=seu-token-de-github-aqui
```

### Como Obter um GitHub Token

1. Acesse [GitHub Settings > Developer settings > Personal access tokens > Tokens (classic)](https://github.com/settings/tokens)
2. Crie um novo token com as seguintes permissões:
   - `repo` (completo) - para criar issues no repositório
3. Copie o token gerado

## O que é Enviado

Quando você envia um relatório, o seguinte conteúdo é enviado para o GitHub:

- **Título**: `Sugestão de parâmetro: [URL do parâmetro]` ou `Sugestão de parâmetro ou correção`
- **Corpo**:
  ```
  Descrição: [sua descrição]
  Usuário: [seu email]
  URL do parâmetro: [URL fornecida]
  ```
- **Labels**: `bug`, `enhancement`, `catalogo`

## Labels

As issues criadas automaticamente recebem as seguintes labels:
- `bug` - para problemas ou correções
- `enhancement` - para sugestões de novos recursos
- `catalogo` - para indicar que é relacionado ao catálogo de parâmetros

## Privacidade

O email do usuário é incluído no corpo da issue apenas para que os mantenedores possam entrar em contato se necessário. O token do GitHub é armazenado localmente no navegador e não é enviado para nenhum servidor além do GitHub GraphQL API.

## Exemplo de Uso

### Sugerir um Novo Parâmetro

1. Clique no botão "Reportar" no header
2. Descreva: "Preciso de um parâmetro para controlar o limite de desconto por cliente"
3. URL do parâmetro: "MyCommerce > Financeiro > Configuração > Descontos"
4. Envie

### Reportar um Parâmetro Incorreto

1. Clique no botão "Reportar" no header
2. Descreva: "O parâmetro 'Limite de crédito' está com valor padrão incorreto"
3. URL do parâmetro: "MyCommerce > Financeiro > Configuração > Crédito"
4. Envie
