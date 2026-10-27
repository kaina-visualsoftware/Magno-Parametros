# Auditoria de segurança — 27/10/2026

## Escopo
Código do catálogo público e das interfaces administrativas; scripts Node.js; Supabase Auth, PostgreSQL/RLS, RPCs, Storage e endpoint público de sugestões. Auditoria estática e verificação de regras de segurança no banco de produção. **Não equivale a um pentest**, nem comprova ausência de falhas.

## Correções efetivamente aplicadas ao banco
1. **Crítico — `public._migracoes` exposta:** havia permissões de leitura e escrita a `anon` sem RLS. RLS habilitado e privilégios revogados de `PUBLIC`, `anon` e `authenticated`. O processo de migração via conexão privilegiada PostgreSQL continua funcional.
2. **Moderado — funções privilegiadas expostas:** execução de `public.criar_profile()` (função de trigger) revogada para clientes; invocação anônima de `public.papel_atual()` revogada. A função continua disponível para usuários autenticados porque suas políticas RLS dependem dela.
3. **Moderado — histórico amplo:** antes qualquer usuário autenticado podia ler os logs de alterações, incluindo informações sobre quem editou. A leitura foi limitada a `editor` ou `administrador`; o frontend foi ajustado.
4. **Desempenho e segurança indireta:** `profiles` usa `(select auth.uid())` em sua política de SELECT.

A migration `0012_endurecimento_rls.sql` foi aplicada ao projeto Supabase e incluída no schema versionado.

## Correções de código
- `scripts/importar.ts`, `scripts/migrar.ts` e `scripts/verificar-banco.ts` agora exigem verificação do certificado TLS nas conexões PostgreSQL.
- Removido do script de verificação um teste de senha fixa de conta administrativa. **O segredo apareceu no histórico Git: é necessário rotacioná-lo se já foi usado.** Remover a linha não apaga commits antigos.
- Testes de regressão verificam que esses padrões não retornam.

## Alertas ainda abertos / configurações manuais
- **Supabase Auth: proteção contra senhas vazadas desativada.** Habilitar pelo painel Auth do projeto. Isso não é alterado por SQL.
- **`pg_trgm` no schema public:** mover a extensão exigiria validar dependências, operadores e índices; **não alterado nesta intervenção** para preservar buscas.
- **RPCs SECURITY DEFINER para contas autenticadas:** `papel_atual`, `salvar_documentacao` e `definir_imagem_parametro` permanecem acessíveis aos papéis autenticados por necessidade do sistema. As duas últimas fazem autorização explícita dentro da função. Esse padrão merece testes dinâmicos periódicos para regressões.
- **`_migracoes` e `limites_sugestoes` com RLS sem políticas:** intencional, pois seu acesso público é negado. O advisor classifica como INFO.
- **API de sugestões públicas:** usa limites de envio por identificador da requisição, mas **CORS não é autenticação**. Cabeçalhos de IP precisam ser validados à luz do comportamento real do gateway. CAPTCHA/Turnstile e monitoramento são recomendados se houver spam. Não tratado como proteção absoluta.
- **Dependências:** `npm ci` anteriormente apontou advisories de pacotes; revisar dependências com `npm audit` em ambiente com registry acessível. Não executar automaticamente `npm audit fix --force` sem verificar compatibilidade.
- **Dados do MyCommerce:** este projeto é somente catálogo, não acesso administrativo ao banco operacional. Nunca expor conexão MySQL ou serviço de SQL direto ao navegador.

## Validação pós-merge
- Testar login/sair, edição de documentação como editor, uploads/restauração de imagem como admin, importação, histórico e leitores anônimos.
- Reexecutar Supabase Security Advisor.
- Rotacionar senha administrativa exposta no histórico do código, caso estivesse em uso.
- Habilitar proteção contra senhas vazadas no Supabase Auth e revisar MFA nas contas administrativas.
