# Gestão de imagens personalizadas (Supabase Storage)

**Implementação:** `migracoes/0008_imagens_parametros_storage.sql` e `src/componentes/ImagemParametro.tsx`.

## Funcionamento

- Leitura pública: mostra `imagem_personalizada_path` quando preenchido; caso contrário, usa o recorte OCR estático se `imagem_marcada` estiver marcado. Parâmetros sem imagem mostram estado vazio.
- Administrador: escolhe PNG/JPEG/WebP de até 20 MB, que é comprimido no navegador antes do envio (limite final de 5 MB), vê prévia e confirma. Se o arquivo original for menor que o WebP convertido, ele é preservado. O arquivo é enviado a `imagens-parametros/<id>/<uuid>.<ext>` em Supabase Storage, depois a RPC `definir_imagem_parametro` associa o objeto ao parâmetro.
- Restaurar: limpa somente a referência manual; o recorte original volta a aparecer se existir. O arquivo personalizado antigo permanece no bucket para auditoria até limpeza administrativa futura.
- Cada alteração associa o ID autenticado ao histórico e usa a versão do parâmetro para evitar sobrescrita concorrente.
- A importação JSON preserva a referência manual. Os recortes em `public/imagens-parametro` são mantidos.

## Instalação

No projeto Supabase, aplique a migração SQL **antes do deploy do frontend**. O projeto de produção `magno-parametros` já recebeu a migração; outros bancos precisam aplicá-la separadamente.

Se `VITE_SUPABASE_URL` aponta para o Cloudflare Worker `magno-parametros-proxy`, o Worker precisa ser **redeployado** após receber a alteração que permite `/storage/v1`. Caso contrário, upload e leitura de imagens personalizadas retornarão 404.

Nunca use `service_role` no frontend. O bucket permite downloads públicos, mas escrita e exclusão exigem autenticação e papel `administrador` nas políticas de `storage.objects`. A associação ao parâmetro também é protegida por RPC.

## Verificação

1. Entre como administrador e adicione imagem a um parâmetro sem recorte.
2. Substitua a imagem em parâmetro com OCR incorreto.
3. Recarregue a página e abra em janela anônima — a imagem manual deve aparecer.
4. Restaure a imagem original e confirme o fallback OCR.
5. Verifique que leitor/editor não conseguem fazer upload diretamente.
6. Reimporte JSON e confirme que a imagem manual continua selecionada.

### Observações

- Os arquivos manuais são versionados; não se sobrescreve arquivo existente, evitando problemas de cache.
- Se falhar a associação ao parâmetro, o cliente tenta remover o novo upload; em falhas de rede essa limpeza pode não ocorrer e exigirá coleta de órfãos.
- A imagem recebida é uma referência pública. Evite imagens com dados pessoais, credenciais ou outros dados sensíveis.

## Compressão automática

A seleção de um arquivo inicia compressão local pelo Canvas API, preferindo WebP e até 2560 px no maior lado. A qualidade começa em 92% e diminui somente quando necessário para atender ao limite de 5 MB. O arquivo original prevalece se já for menor que a versão convertida. O formulário apresenta antes e depois da compressão e a prévia exata que será enviada. Nenhuma imagem é transmitida ao servidor durante a compressão. Capturas com textos muito pequenos devem ser revisadas na prévia antes de salvar.
