# Arquitetura

## Diagrama de camadas

As dependências apontam sempre para dentro (DIP). Infraestrutura implementa as
portas; a ligação acontece só na raiz de composição.

```
┌─────────────────────────────────────────────────────────────────────┐
│  Interface (React: paginas/, componentes/)                          │
│  — sem regra de negócio: traduz dados ↔ tela                        │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ usa
┌──────────────────────────────▼──────────────────────────────────────┐
│  Aplicação (aplicacao/, servicos/)                                  │
│  — casos de uso: importar (idempotente), documentar, tags, criar    │
│  — depende apenas de PORTAS (interfaces), nunca de Supabase         │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ depende de
┌──────────────────────────────▼──────────────────────────────────────┐
│  Domínio (dominio/) — TS puro, sem framework/ORM/fetch              │
│  entidades · CalculadoraCaminho · CalculadoraHashOrigem             │
│  RegistroTiposParametro (OCP) · MapeadorArquivoFlat                 │
│  ComparadorImportacao · Normalizador · Erros                        │
└──────────────────────────────▲──────────────────────────────────────┘
                               │ implementa
┌──────────────────────────────┴──────────────────────────────────────┐
│  Infraestrutura (dados/)                                            │
│  Repositórios Supabase (criarRepositoriosSupabase)                  │
└──────────────────────────────▲──────────────────────────────────────┘
                               │ única instanciação concreta
                    ┌──────────┴───────────┐
                    │  raiz-composicao.ts  │ (browser) · scripts/importar.ts (CLI)
                    └──────────────────────┘
```

## Módulos e responsabilidade única (S)

| Módulo | Única razão para mudar |
| --- | --- |
| `dominio/normalizador.ts` | regras de normalização (slug, acentos, texto de busca) |
| `dominio/calculadora-caminho.ts` | formato do caminho de navegação do ERP |
| `dominio/calculadora-hash.ts` | composição do hash de origem |
| `dominio/tipos-parametro.ts` | contrato/registro de manipuladores de tipo |
| `dominio/mapeador-arquivo.ts` | tradução do JSON de origem → domínio |
| `dominio/comparador-importacao.ts` | regras novo/inalterado/alterado/conflito |
| `aplicacao/caso-uso-importar.ts` | orquestração da importação |
| `servicos/catalogo.ts` | casos de uso da interface (arvore, busca, tags, documentação) |
| `dados/repositorios-supabase.ts` | tradução Postgres ↔ domínio (zero regra de negócio) |
| `componentes/*` / `paginas/*` | apresentação |

Controladores (páginas) não contêm `if` de regra de negócio — apenas gating de
papel para a UI. Nenhuma query fora dos repositórios.

## Aberto/fechado (O) — pontos de extensão

| Variação | Mecanismo | Evidência |
| --- | --- | --- |
| Tipos de parâmetro | `ManipuladorTipo` + `registrarTipoParametro` + `ManipuladorTipoGenerico` | `dominio/tipos-parametro.ts`; teste "tipo fictício" em `dominio/testes/dominio.teste.ts` |
| Formatos de entrada | `FonteDeParametros` (implementada por `FonteJsonPlano`; CSV/API entrariam como novas classes) | `aplicacao/caso-uso-importar.ts` |
| Regras de validação/mergia de tags | portas segregadas + caso de uso; novas regras entram por novas implementações | `dados/portas.ts` |
| Proibido: `switch (tipo)` / `if (tipo === ...)` | inexistente fora do registro | busca no código |

## Substituição de Liskov (L)

- Contrato de cada porta está documentado em `dados/portas.ts` (o que retorna
  quando não encontra: `null`/lista vazia; como ordena/pagina; erros lançados).
- `ManipuladorTipoGenerico` nunca endurece pré-condições: aceita o que os
  específicos aceitam (validação sempre `null` = válida).
- Repositório Supabase pode ser substituído por um repositório em memória nos
  testes sem alterar casos de uso (mesmas interfaces).

## Segregação de interfaces (I)

Nenhuma porta tem mais de 6 métodos; a importação usa a porta mínima
(`ParametroImportacao` = 2 métodos) e não recebe escrita completa:

| Porta | Métodos |
| --- | --- |
| `ParametroLeitura` | buscarPorId, listar, listarPorAbas, contagemPorAba |
| `ParametroImportacao` | buscarPorIds, salvarEmLote |
| `ParametroEscrita` | + salvar, desativar |
| `ArvoreLeitura` / `ArvoreEscrita` | 2 / 3 |
| `TagLeitura` / `TagEscrita` / `TagVinculo` | 2 / 3 / 6 |
| `RegistradorHistorico` | registrar, listar |

Casos de uso recebem só o que usam: `PortasImportacao = Pick<PortasDeDados, …>`.

## Inversão de dependência (D)

- Domínio e aplicação **não importam** `@supabase/*`, React, router nem `fetch`.
- `raiz-composicao.ts` (browser) e `scripts/importar.ts` (CLI) são os únicos
  pontos que criam cliente/repositórios concretos e injetam por parâmetro.
- A verificação automatizada de fronteira (dependency-cruiser/ESLint boundaries)
  está listada como pendência de ferramentas na fase 2; o invariante é mantido
  por inspeção — domínio/aplicação não têm dependências além de TS padrão.

## Fluxos principais

**Importação (idempotente):**
```
Fonte JSON → MapeadorArquivoFlat (árvore + caminhos + hash + alertas)
           → ComparadorImportacao (novo/inalterado/alterado/conflito)
           → CasoDeUsoImportar (upserts + histórico + relatório)
```

**Documentação:** tela → `salvarDocumentacao` (só campos editáveis) → diff →
histórico. Campos de origem exigem confirmação e marcam `editado_na_origem`.

**Tags:** slug normalizado garante `Orçamento` ≡ `orcamento` ≡ `ORÇAMENTO`;
mesclagem move vínculos (`substituirVinculos`) e registra histórico.

## Checklist SOLID (seção 10.2 do enunciado)

| Princípio | Verificação | Evidência |
| --- | --- | --- |
| S | Uma razão para mudar por módulo; controladores sem regra de negócio | tabela "Módulos e responsabilidade única" acima |
| O | Novo tipo/formato/regra sem editar código existente | `ManipuladorTipoGenerico` + teste do tipo fictício; `FonteDeParametros` |
| L | Contratos explícitos nas portas; genérico não endurece pré-condições | `dados/portas.ts`; testes do comparador e do registro de tipos |
| I | Portas com ≤ 6 métodos; importação usa porta mínima (2) | tabela de portas acima |
| D | Domínio/aplicação sem import de infra/framework | `raiz-composicao.ts` como único ponto de `new` concreto |
