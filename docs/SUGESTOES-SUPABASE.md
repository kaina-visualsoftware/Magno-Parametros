# Sugestões pelo Supabase — sem Cloudflare Worker

O formulário público do Myc.config utiliza a Edge Function `criar-sugestao`
do projeto Supabase `magno-parametros` para criar issues no GitHub.
Não é necessário instalar ou pagar por um Cloudflare Worker.

## Configuração final obrigatória

1. No GitHub, crie um token fine-grained restrito exclusivamente ao
   repositório `kaina-visualsoftware/Myc.config`, com permissão
   **Issues: Read and write**. Defina expiração e possibilidade de revogação.
2. No painel do Supabase abra
   [Edge Functions → Secrets](https://supabase.com/dashboard/project/dmgmalzqywrjecvzbkjy/functions/secrets).
   Crie um segredo de nome `GITHUB_ISSUES_TOKEN` com o valor do token.
   **Não cole o token no chat, no código, em variáveis VITE_* nem em issues.**
3. A Edge Function `criar-sugestao` já foi publicada com `verify_jwt=false`
   para permitir visitantes anônimos. Ela retorna 503 até encontrar o segredo.
4. Faça merge da PR de integração do frontend e publique o GitHub Pages
   pelo workflow normal. Nenhuma configuração `VITE_ISSUES_API_URL` é necessária.
5. Teste uma sugestão curta no formulário, confirme o link de issue devolvido
   e feche a issue de teste quando terminar.

## Segurança e limites

- O token GitHub fica exclusivamente no ambiente da Edge Function.
- CORS restringe o uso via navegadores à origem do catálogo e ambientes locais.
  **CORS não é autenticação** e não impede pedidos feitos por scripts.
- A função limita a três solicitações por janela de dez minutos por
  identificador de IP, usando a função SQL `consumir_limite_sugestao`
  acessível apenas a `service_role`; a tabela tem RLS e não está exposta
  a usuários anônimos.
- Limites por IP não evitam abuso distribuído. Em caso de spam,
  adicione CAPTCHA (por exemplo Turnstile), alertas e monitoramento.
- Valida descrição, tamanho, método e formato; o formulário utiliza um honeypot.
- Em falha, a interface preserva o texto e oferece `Abrir no GitHub`
  com os dados preenchidos; essa opção exige login no GitHub para publicar.

## Serviço

A URL de produção é:
`https://dmgmalzqywrjecvzbkjy.supabase.co/functions/v1/criar-sugestao`

As migrações ficam em `migracoes/0009_limite_sugestoes.sql`;
a Edge Function em `supabase/functions/criar-sugestao/index.ts`.
Outros projetos Supabase precisarão aplicar a migração e publicar a função.
