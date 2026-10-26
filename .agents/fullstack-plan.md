# Plano de Agente de Planejamento (fullstack-plan)

Este documento serve como instruções para o agente de planejamento do **OpenCode** utilizado neste projeto. Ele descreve as permissões e comportamentos que o agente deve seguir ao orquestrar tarefas.

## Permissões concedidas

- **Instalar novas skills**: o agente está autorizado a usar o comando `npx skills add <repo> --skill <skill>` para instalar skills adicionais que sejam necessárias ao longo do desenvolvimento.
- **Buscar skills existentes**: o agente pode usar `npx skills find <consulta>` ou o skill `find-skills` já instalado para descobrir habilidades que atendam a demandas específicas.

## Diretrizes de uso

1. **Preferir skills já instaladas**: sempre verificar se a skill necessária já está presente em `.agents/skills/`. Por exemplo, o skill `icons` (para geração de ícones) e o skill `find-skills` (para descoberta de novas skills) já foram instalados.
2. **Instalar apenas quando necessário**: se a tarefa atual requer uma funcionalidade inexistente, o agente deve:
   - Executar `npx skills find <descrição da necessidade>` para localizar uma skill adequada.
   - Instalar a skill escolhida usando `npx skills add <owner/repo> --skill <skill>`.
3. **Documentar a instalação**: toda nova skill adicionada deve ser anotada neste plano, incluindo:
   - Nome da skill.
   - Fonte (repo).
   - Propósito no contexto do projeto.
4. **Usar skills nos planos de execução**: ao criar um plano de ação (ex.: gerar ícone, otimizar build, criar componentes), o agente deve incluir chamadas explícitas ao skill correspondente, por exemplo:
   - `icons` – para gerar ou buscar SVGs.
   - `find-skills` – para localizar novas habilidades.
5. **Atualizar o plano**: após cada instalação ou descoberta de skill, o agente deve atualizar este arquivo com a nova informação.

## Exemplo de uso do skill `icons`

Para gerar um ícone customizado para o aplicativo, o agente pode executar:
```
# Comando para gerar um ícone usando o skill `icons`
npx skills run icons --prompt "Create a simple round app icon in #0b0d10 color with a white letter M" --output src/assets/app-icon.svg
```
O resultado deve ser salvo em `src/assets/app-icon.svg` e referenciado no `index.html`.

## Atualizações futuras

O agente deve revisitar este plano periodicamente e garantir que todas as permissões e instruções estejam alinhadas com as necessidades do projeto.
