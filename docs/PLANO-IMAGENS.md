# Plano da melhoria: localizar o parâmetro na captura de tela

**Objetivo:** quando o usuário abrir um parâmetro, além de caminho e documentação,
ver **a foto da tela original com um retângulo vermelho em volta do parâmetro**.

## Como funciona (pipeline `npm run marcar-imagens`)

1. **Fonte:** o zip `parametros myc` (43 capturas, mesmas referenciadas em
   `imagem_origem`) é extraído para `dados/imagens-origem/`.
2. **OCR** (`tesseract.js`, idioma `por`): cada captura é processada uma única
   vez; o resultado (linhas + posições das palavras) é cacheado em
   `dados/ocr-cache/<imagem>.json`.
3. **Correspondência:** para cada parâmetro cadastrado daquela imagem, o nome é
   normalizado (sem acento, minúsculo) e procurado nas linhas do OCR. Prioridade:
   linha idêntica ao rótulo; senão linha que o contém; senão sobreposição de
   tokens ≥ 80% (tolera erros de OCR).
4. **Destaque:** com `sharp`, um retângulo vermelho (traço 4px) é desenhado em
   volta da linha correspondente e a imagem é **recortada com contexto**
   (±90 px horizontais, ±40 px verticais) em `public/imagens-parametro/<id>.png`.
5. **Registro:** `parametros.imagem_marcada = true` no banco; o detalhe do
   parâmetro passa a exibir o recorte automaticamente (servido pelo GitHub Pages,
   sem storage extra).

## Idempotência e retomada

- Parâmetros já marcados são pulados (`--recarregar` reprocessa).
- Cache de OCR evita reprocessar a mesma captura.
- Não correspondidos ficam listados no relatório para revisão manual
  (nomes muito curtos ou truncados podem não bater com o OCR).

## Limitações conhecidas

- OCR de telas densas pode errar leitura; a sobreposição de tokens mitiga.
- Rótulos repetidos na mesma captura: escolhe a primeira ocorrência com melhor
  pontuação (casos raros; revisão manual via relatório).

## Uso

```bash
npm run marcar-imagens            # marca todos os pendentes
npm run marcar-imagens -- --limite 5          # teste com 5 capturas
npm run marcar-imagens -- --imagem myCommerce_R2t9tXoEhH.png   # uma captura
npm run marcar-imagens -- --recarregar        # refaz todos os recortes
```
