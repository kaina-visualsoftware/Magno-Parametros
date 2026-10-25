import { test, expect, type Page } from '@playwright/test';

const tagId = '10000000-0000-0000-0000-000000000001';
const tag = { id: tagId, nome: 'Financeiro', slug: 'financeiro', descricao: null, cor: null, totalVinculos: 75 };
const itens = Array.from({ length: 75 }, (_, i) => ({
  id: `p${i}`, nome: i === 0 ? 'Permitir orçamento sem estoque' : `Parâmetro de configuração ${String(i).padStart(2, '0')}`,
  tipo: 'checkbox', grupo: 'Financeiro', caminho: 'MyCommerce > Utilitários > Configuração > Administração do Sistema > Financeiro',
  statusDocumentacao: i % 2 ? 'documentado' : 'pendente', origem: 'importado', ativo: true,
}));

async function preparar(page: Page, papel = 'editor') {
  const chamadas: Array<{ caminho: string; corpo: Record<string, any> }> = [];
  // Fixture HTTP local: nenhuma requisição a Supabase/Worker de produção.
  await page.route('http://127.0.0.1:54329/**', async route => {
    const req = route.request();
    const url = new URL(req.url());
    const corpo = req.postDataJSON() ?? {};
    chamadas.push({ caminho: url.pathname, corpo });
    let data: unknown = [];
    if (url.pathname.endsWith('/rpc/listar_parametros_catalogo')) {
      const f = corpo.p_filtros;
      const filtrados = itens.filter(p => (!f.termo || `${p.nome} ${p.caminho}`.toLowerCase().includes(f.termo.toLowerCase())) && (!f.status || f.status === p.statusDocumentacao));
      const inicio = corpo.p_cursor?.valor ?? 0;
      data = { itens: filtrados.slice(inicio,inicio+50), proximoCursor: inicio+50 < filtrados.length ? { v:1, f:'fixture',id:'p49',valor:inicio+50 } : null };
    } else if (url.pathname.endsWith('/rpc/listar_tags_com_contagem')) data = [tag];
    else if (url.pathname.endsWith('/tipos_parametro')) data = [{ codigo:'checkbox',descricao:null,componentes:[] }];
    else if (url.pathname.endsWith('/profiles')) data = { papel };
    else if (url.pathname.endsWith('/telas')) data = [{ id:'tela', nome:'Tela', descricao:null, prefixo_caminho:'MyCommerce' }];
    else if (url.pathname.endsWith('/abas')) data = [{ id:'aba', tela_id:'tela', aba_pai_id:null, nome:'Condici...', nome_original_importado:'Condições', nome_truncado_na_tela:true, ordem:0, caminho:'MyCommerce > Condici...' }];
    else if (url.pathname.endsWith('/parametros') && url.searchParams.get('select')?.includes('aba_id')) data = [{ aba_id:'aba' }];
    else if (url.pathname.endsWith('/parametros')) data = { ...itens[0], aba_id:'aba', status_documentacao:'pendente', versao:0, opcoes:[], o_que_faz:'Permite registrar orçamento mesmo sem estoque.', ativo:true };
    else if (url.pathname.endsWith('/tags')) data = url.searchParams.has('slug') ? tag : [tag];
    else if (url.pathname.endsWith('/historico_alteracoes')) data = [{ id:1, entidade:'parametro', entidade_id:'p0',campo:'oQueFaz',valor_anterior:'antigo',valor_novo:'novo',usuario:'editor',origem:'edicao',criado_em:'2026-01-01T10:00:00Z' }];
    else if (url.pathname.endsWith('/logout')) return route.fulfill({ status:204 });
    await route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(data) });
  });
  return chamadas;
}

test('catálogo só consulta RPC; debounce, filtros URL e carregar mais', async ({ page }) => {
  const chamadas = await preparar(page);
  await page.goto('./');
  await expect(page.getByText('50 parâmetros carregados')).toBeVisible();
  expect(chamadas.map(c => c.caminho)).toEqual(['/rest/v1/rpc/listar_parametros_catalogo']);
  await page.getByRole('button', { name:'Carregar mais 50' }).click();
  await expect(page.getByText('75 parâmetros carregados')).toBeVisible();
  const busca = page.getByRole('searchbox', { name:'Buscar parâmetros' });
  await busca.fill('orçamento');
  await expect(page.getByText('1 parâmetros carregados')).toBeVisible();
  expect(chamadas.filter(c => c.corpo.p_filtros?.termo === 'orçamento')).toHaveLength(1);
  await expect(page).toHaveURL(/q=or%C3%A7amento/);
  await page.getByRole('button', { name:'Filtros' }).click();
  await page.getByRole('combobox', { name:'Documentação', exact:true }).selectOption('pendente');
  await page.getByRole('button', { name:'Aplicar filtros' }).click();
  await expect(page).toHaveURL(/status=pendente/);
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.reload();
  await expect(busca).toHaveValue('orçamento');
  await expect(page.getByText('1 parâmetros carregados')).toBeVisible();
  await page.getByRole('button', { name:'Limpar', exact:true }).click();
  await expect(page.getByText('50 parâmetros carregados')).toBeVisible();
});

test('tema persiste e storage bloqueado não impede abrir', async ({ page }) => {
  await preparar(page);
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.getByRole('button', { name:'Ativar modo claro' }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await page.addInitScript(() => { Storage.prototype.getItem = () => { throw new Error('bloqueado'); }; Storage.prototype.setItem = () => { throw new Error('bloqueado'); }; });
  await page.reload();
  await expect(page.getByText('50 parâmetros carregados')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
});

test('detalhe independente, volta preserva busca e não pede histórico público', async ({ page }) => {
  const chamadas = await preparar(page);
  await page.goto('./#/?q=orçamento');
  await page.getByRole('link', { name:'Permitir orçamento sem estoque',exact:true }).click();
  await expect(page.getByRole('heading', { name:'Permitir orçamento sem estoque' })).toBeVisible();
  await expect(page.getByText('Permite registrar orçamento mesmo sem estoque.', { exact:true })).toBeVisible();
  expect(chamadas.some(c => c.caminho.endsWith('historico_alteracoes'))).toBe(false);
  expect(chamadas.some(c => c.caminho.endsWith('listar_tags_com_contagem'))).toBe(false);
  await page.getByText('Histórico de alterações', { exact:true }).click();
  await expect(page.getByText('Entre para consultar o histórico.')).toBeVisible();
  await page.getByRole('link', { name:'Voltar ao catálogo' }).click();
  await expect(page.getByRole('searchbox')).toHaveValue('orçamento');
});

test('admin renomeia aba em página dedicada e recupera o foco', async ({ page }) => {
  await preparar(page, 'administrador');
  await page.addInitScript(() => {
    localStorage.setItem('sb-127-auth-token', JSON.stringify({
      access_token: 'token-fixture', refresh_token: 'refresh-fixture',
      expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer',
      user: { id: '00000000-0000-0000-0000-000000000003', email: 'admin@example.com', aud: 'authenticated', role: 'authenticated' },
    }));
  });
  await page.goto('./#/abas');
  await expect(page.getByRole('heading', { name:'Telas e abas' })).toBeVisible();
  const renomear = page.getByRole('button', { name:'Renomear aba Condici...' });
  await expect(renomear).toBeVisible();
  await renomear.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('Novo valor')).toHaveValue('Condici...');
  await page.keyboard.press('Escape');
  await expect(renomear).toBeFocused();
});

test('página da tag usa o catálogo paginado e deixa claro que a exportação é parcial', async ({ page }) => {
  await preparar(page);
  await page.goto('./#/tag/financeiro');
  await expect(page.getByRole('heading', { name:'Parâmetros de Financeiro' })).toBeVisible();
  await expect(page.getByText('50 parâmetros carregados')).toBeVisible();
  await expect(page.getByRole('button', { name:'Exportar 50 itens carregados' })).toBeVisible();
  await expect(page.getByRole('button', { name:/Tag: Financeiro/ })).toHaveCount(0);
});

test('falha de tags não esconde o parâmetro', async ({ page }) => {
  await preparar(page);
  await page.route('**/rest/v1/tags?*', route => route.fulfill({ status:500,contentType:'application/json',body:JSON.stringify({ message:'Falha simulada de tags' }) }));
  await page.goto('./#/parametro/p0');
  await expect(page.getByRole('heading', { name:'Permitir orçamento sem estoque' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Falha simulada de tags');
});

test('erro de catálogo tem retry, sem estado vazio enganoso', async ({ page }) => {
  await preparar(page);
  let falhar = true;
  await page.route('**/rpc/listar_parametros_catalogo', async route => {
    if (!falhar) return route.fallback();
    return route.fulfill({ status:500,contentType:'application/json',body:JSON.stringify({ message:'Falha simulada' }) });
  });
  await page.goto('./');
  await expect(page.getByRole('alert')).toContainText('Falha simulada');
  await expect(page.getByText('Nenhum parâmetro encontrado')).not.toBeVisible();
  falhar = false;
  await page.getByRole('button', { name:'Tentar novamente' }).click();
  await expect(page.getByText('50 parâmetros carregados')).toBeVisible();
});

test('diálogo retém foco, Escape devolve foco ao gatilho', async ({ page }) => {
  await preparar(page);
  await page.goto('./');
  await page.getByRole('button', { name:'Filtros' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name:'Filtros' })).toBeFocused();
  await page.keyboard.press('/');
  await expect(page.getByRole('searchbox')).toBeFocused();
});

for (const [width,height] of [[390,844],[768,1024],[1440,900],[1920,1080],[320,800]]) {
  test(`responsivo ${width}, dark/light e detalhe sem overflow`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width,height });
    await preparar(page);
    await page.goto('./');
    await expect(page.getByText('50 parâmetros carregados')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path:testInfo.outputPath(`catalogo-${width}-dark.png`), fullPage:false });
    await page.getByRole('button', { name:'Ativar modo claro' }).click();
    await page.screenshot({ path:testInfo.outputPath(`catalogo-${width}-light.png`), fullPage:false });
    await page.getByRole('button', { name:'Filtros' }).click();
    expect(await page.getByRole('dialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.screenshot({ path:testInfo.outputPath(`filtros-${width}.png`) });
    await page.keyboard.press('Escape');
    await page.getByRole('link', { name:'Permitir orçamento sem estoque',exact:true }).click();
    await expect(page.getByRole('heading', { name:'Permitir orçamento sem estoque' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path:testInfo.outputPath(`detalhe-${width}.png`), fullPage:true });
  });
}
