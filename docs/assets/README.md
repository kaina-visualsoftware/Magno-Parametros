# Recursos visuais do README

[Voltar ao produto](../../README.md)

## Direção visual

A apresentação acompanha a interface existente: fundo grafite `#0b0d10`, superfície `#191f26`, texto `#f3f5f7`, texto secundário `#a3adb9`, borda `#303945` e verde-menta `#6cd7bb`. A tipografia usa a mesma família de sistema do aplicativo; os caminhos técnicos são parte do conteúdo real das telas.

O banner tem **1600 × 900 (16:9)**. A marca e a mensagem ocupam a parte superior; abaixo, um recorte de uma captura real apresenta a busca e o primeiro resultado. O fundo opaco mantém a composição íntegra nos temas claro e escuro do GitHub. A proposta de valor também está escrita em Markdown no README, para continuar legível em telas pequenas e leitores de tela.

## Arquivos e procedência

| Arquivo | Conteúdo |
| --- | --- |
| [banner.png](banner.png) | Banner de abertura, composto a partir de `banner.html` e da captura do catálogo. |
| [dispositivos.png](dispositivos.png) | Composição desktop/mobile, com fonte em `dispositivos.html`. |
| [screenshots/catalogo-escuro.png](screenshots/catalogo-escuro.png) | Catálogo público em tema escuro, 1440 × 960. |
| [screenshots/catalogo-claro.png](screenshots/catalogo-claro.png) | A mesma tela em tema claro, 1440 × 960. |
| [screenshots/parametro-claro.png](screenshots/parametro-claro.png) | Detalhe e localização na captura do ERP, 1440 × 960. |
| [screenshots/filtros-escuro.png](screenshots/filtros-escuro.png) | Diálogo real de filtros, 1440 × 960. |
| [screenshots/busca-mobile.png](screenshots/busca-mobile.png) | Busca por “estoque” em viewport mobile, 390 × 844. |
| [screenshots/manifesto.json](screenshots/manifesto.json) | Data de captura, URLs, versão do navegador, dimensões, tamanhos e hashes SHA-256. |

As capturas foram feitas com Playwright/Chromium no [site público](https://kaina-visualsoftware.github.io/Myc.config/), em contexto novo e anônimo. O mobile usa uma viewport reduzida no Chromium; não é uma fotografia de um aparelho físico. Não foram usados mocks, contas autenticadas, dados inseridos para a apresentação ou alterações no DOM da aplicação.

O script espera os resultados e o carregamento de fontes e imagens, rejeita erros HTTP e erros de página, e verifica transbordamento horizontal. Os PNGs são otimizados com Sharp, sem compressão destrutiva. O banner recorta a captura; a composição desktop/mobile redimensiona as imagens e acrescenta legendas externas à interface.

## Reprodução

As ferramentas já constam nas dependências do projeto. Da raiz, com as dependências instaladas:

```bash
# Apenas se o navegador ainda não estiver instalado:
npx playwright install chromium

# Capturar o site e gerar as composições:
node docs/assets/gerar-visuais.mjs

# Recriar apenas banner e composição, usando as capturas existentes:
node docs/assets/gerar-visuais.mjs --compor
```

Edite [banner.html](banner.html) e [dispositivos.html](dispositivos.html) para ajustar as composições. Os arquivos são autocontidos, exceto pelas imagens locais, e podem ser abertos diretamente no navegador. Não há fontes, badges ou serviços de imagem externos.

O script depende dos rótulos e do parâmetro público atuais. Mudanças no site podem exigir ajuste dos seletores; uma falha não deve ser substituída por uma captura de carregamento ou erro. Após recapturar, confira visualmente os arquivos e revise a presença de dados pessoais antes de publicá-los.

## Limites da apresentação

- A consulta pública mostrava documentação pendente e nenhuma tag cadastrada. Esse estado foi preservado.
- Edição, histórico autenticado, importação e administração foram descritos a partir do código, sem capturas de sessões privadas.
- As capturas representam a versão publicada no momento registrado no manifesto; podem divergir de alterações locais posteriores.
- A reprodução depende da disponibilidade do site e de seu backend.

## Revisão da apresentação

O Markdown foi convertido pela API GFM do GitHub e inspecionado com os estilos do GitHub em viewports de 1280 e 390 pixels, nos temas claro e escuro. As imagens carregaram com textos alternativos e sem transbordamento horizontal da página. Os caminhos e as âncoras locais dos três documentos desta entrega foram conferidos, assim como os hashes das cinco capturas.
