import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import sharp from 'sharp';

// Executar da raiz: node docs/assets/gerar-visuais.mjs
// --compor reutiliza as capturas existentes, sem acessar o produto.
const pasta = new URL('./', import.meta.url);
const base = 'https://kaina-visualsoftware.github.io/Myc.config/';
const registros = [];
const browser = await chromium.launch();

async function salvar(nome, buffer) {
  const arquivo = new URL(nome, pasta);
  await sharp(buffer).png({ compressionLevel: 9 }).toFile(fileURLToPath(arquivo));
  const bytes = await readFile(arquivo);
  const { width, height } = await sharp(bytes).metadata();
  return { arquivo: nome, largura: width, altura: height, bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex') };
}

async function pronta(page) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].every(img => img.complete && img.naturalWidth > 0));
  if (await page.locator('.erro, .erro-com-retry').count()) {
    throw new Error('A página exibe um erro; captura interrompida.');
  }
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) {
    throw new Error('A página apresenta transbordamento horizontal.');
  }
}

try {
  await mkdir(new URL('screenshots/', pasta), { recursive: true });
  if (!process.argv.includes('--compor')) {
    const contexto = await browser.newContext({ viewport: { width: 1440, height: 960 },
      deviceScaleFactor: 1, locale: 'pt-BR', colorScheme: 'dark', reducedMotion: 'reduce' });
    const page = await contexto.newPage();
    const falhas = [];
    page.on('pageerror', erro => falhas.push(erro.message));
    page.on('response', resposta => {
      if (resposta.status() >= 400) falhas.push(`HTTP ${resposta.status()}: ${new URL(resposta.url()).pathname}`);
    });

    async function capturar(nome, tema) {
      await pronta(page);
      if (falhas.length) throw new Error(falhas.join('\n'));
      registros.push({ ...await salvar(`screenshots/${nome}.png`, await page.screenshot({ animations: 'disabled' })),
        url: page.url(), tema, viewport: page.viewportSize() });
    }

    await page.goto(base);
    await page.getByRole('link', { name: '% Desc. máximo inicial dos produtos', exact: true }).waitFor();
    await page.getByText('50 parâmetros carregados', { exact: true }).waitFor();
    await capturar('catalogo-escuro', 'escuro');

    await page.getByRole('button', { name: 'Ativar modo claro' }).click();
    await capturar('catalogo-claro', 'claro');

    await page.getByRole('link', { name: '% Desc. máximo inicial dos produtos', exact: true }).click();
    await page.getByRole('heading', { name: 'Localização na tela de origem' }).waitFor();
    await page.locator('main img').waitFor();
    await capturar('parametro-claro', 'claro');

    await page.getByRole('link', { name: 'Voltar ao catálogo' }).click();
    await page.getByText('50 parâmetros carregados', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Ativar modo escuro' }).click();
    await page.getByRole('button', { name: 'Filtros', exact: true }).click();
    await page.getByRole('dialog').waitFor();
    await page.getByRole('option', { name: 'checkbox', exact: true }).waitFor({ state: 'attached' });
    await page.getByText('Carregando tags…', { exact: true }).waitFor({ state: 'hidden' });
    await capturar('filtros-escuro', 'escuro');
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Ativar modo claro' }).click();
    await page.getByRole('searchbox', { name: 'Buscar parâmetros' }).fill('estoque');
    await page.waitForURL(/q=estoque/);
    await page.waitForFunction(() => {
      const estado = document.querySelector('[role="status"]');
      return estado?.textContent?.includes('parâmetros carregados') && !document.querySelector('[aria-busy="true"]');
    });
    await page.getByRole('searchbox', { name: 'Buscar parâmetros' }).blur();
    await capturar('busca-mobile', 'claro');

    await writeFile(new URL('screenshots/manifesto.json', pasta), JSON.stringify({
      capturadoEm: new Date().toISOString(), origem: 'Site público, sessão anônima, dados reais; sem mocks ou edições no conteúdo.',
      navegador: `Chromium ${browser.version()}`, capturas: registros,
    }, null, 2) + '\n');
    await contexto.close();
  }

  for (const nome of ['banner', 'dispositivos']) {
    const page = await browser.newPage({ viewport: { width: 1600, height: nome === 'banner' ? 900 : 1120 }, deviceScaleFactor: 1 });
    await page.goto(new URL(`${nome}.html`, pasta).href);
    await pronta(page);
    const resultado = await salvar(`${nome}.png`, await page.screenshot());
    console.log(`${resultado.arquivo}: ${resultado.largura}×${resultado.altura}, ${Math.round(resultado.bytes / 1024)} KiB`);
    await page.close();
  }
  for (const captura of registros) console.log(`${captura.arquivo}: ${Math.round(captura.bytes / 1024)} KiB`);
} finally {
  await browser.close();
}
