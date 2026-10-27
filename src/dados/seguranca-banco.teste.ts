import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pool, PoolClient } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { criarRepositoriosPg } from '../../scripts/repositorio-pg';

// Somente banco descartável local, criado explicitamente para esta suíte.
const url = process.env.TEST_DATABASE_URL;
if (url) {
  const destino = new URL(url);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(destino.hostname) || !destino.pathname.endsWith('_test')) {
    throw new Error('TEST_DATABASE_URL deve apontar para Postgres local descartável com nome terminado em _test.');
  }
}

const editor = '00000000-0000-0000-0000-000000000001';
const leitor = '00000000-0000-0000-0000-000000000002';
const admin = '00000000-0000-0000-0000-000000000003';
const semPerfil = '00000000-0000-0000-0000-000000000004';
const sqlRpc = `select * from public.salvar_documentacao($1, $2, $3, null, null, null, $4)`;

describe.skipIf(!url)('Postgres isolado: RLS, documentação e concorrência', () => {
  let pool: Pool;
  let cliente: PoolClient;

  async function como(id: string | null, c = cliente) {
    await c.query('set local role authenticated');
    await c.query("select set_config('request.jwt.claim.sub', $1, true)", [id ?? '']);
  }

  beforeAll(async () => {
    pool = new Pool({ connectionString: url });
    await pool.query(`
      create role anon nologin;
      create role authenticated nologin;
      create schema auth;
      create schema storage;
      create table storage.buckets (
        id text primary key, name text, public boolean,
        file_size_limit bigint, allowed_mime_types text[]
      );
      create table storage.objects (
        bucket_id text, name text, metadata jsonb
      );
      create function storage.foldername(p text) returns text[]
        language sql immutable as
        $ select string_to_array(p, '/')[:array_length(string_to_array(p, '/'), 1)-1] $;
      grant usage on schema storage to anon, authenticated;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth, public to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;
    `);
    if (process.env.TEST_SCHEMA_SQL === '1') {
      await pool.query(readFileSync(resolve('supabase/schema.sql'), 'utf8'));
    } else {
      for (const arquivo of readdirSync(resolve('migracoes')).filter(f => f.endsWith('.sql')).sort()) {
        await pool.query(readFileSync(resolve('migracoes', arquivo), 'utf8'));
      }
      // A migração aditiva também deve poder ser reaplicada sem perder dados.
      await pool.query(readFileSync(resolve('migracoes/0006_documentacao_segura.sql'), 'utf8'));
      await pool.query(readFileSync(resolve('migracoes/0007_catalogo_cursor.sql'), 'utf8'));
    }
    expect((await pool.query('select count(*)::int as total from auth.users')).rows[0].total).toBe(0);
    await pool.query(`
      grant select, insert, update, delete on all tables in schema public to anon, authenticated;
      grant usage, select on all sequences in schema public to anon, authenticated;
      insert into auth.users values ('${editor}'), ('${leitor}'), ('${admin}');
      update public.profiles set papel = 'editor' where id = '${editor}';
      update public.profiles set papel = 'administrador' where id = '${admin}';
      insert into public.tipos_parametro(codigo) values ('checkbox');
      insert into public.telas values ('tela', 'Tela', null, 'ERP');
      insert into public.abas(id,tela_id,nome,caminho) values ('aba','tela','Aba','ERP > Aba');
      insert into public.parametros(id,aba_id,grupo,nome,tipo,caminho)
        values ('p','aba','Geral','Parâmetro','checkbox','ERP > Aba > Parâmetro'),
               ('corrida','aba','Geral','Corrida','checkbox','ERP > Aba > Corrida');
    `);
  });

  beforeEach(async () => {
    cliente = await pool.connect();
    await cliente.query('begin');
  });
  afterEach(async () => {
    if (cliente) {
      await cliente.query('rollback');
      cliente.release();
    }
  });
  afterAll(async () => { await pool?.end(); });

  async function catalogo(filtros: Record<string, unknown> = {}, cursor: unknown = null, limite = 1) {
    const { rows } = await cliente.query('select public.listar_parametros_catalogo($1::jsonb,$2::jsonb,$3) as pagina',
      [JSON.stringify(filtros), cursor === null ? null : JSON.stringify(cursor), limite]);
    return rows[0].pagina as { itens: Array<{ id: string; nome: string }>; proximoCursor: unknown };
  }

  it.each(['nome','grupo','caminho','ordem'].flatMap(ordem => ['asc','desc'].map(direcao => ({ ordem, direcao }))))
    ('cursor estável em $ordem $direcao, inclusive empates', async ({ ordem, direcao }) => {
      await cliente.query(`insert into public.parametros(id,aba_id,grupo,nome,tipo,caminho,ordem)
        values ('igual1','aba','Geral','Mesmo','checkbox','Mesmo',2), ('igual2','aba','Geral','Mesmo','checkbox','Mesmo',2),
          ('dez','aba','Outro','Z','checkbox','Z',10)`);
      const esperados = (await cliente.query(`select id from public.parametros order by ${ordem} ${direcao}, id asc`)).rows.map(r => r.id);
      await cliente.query('set local role anon');
      const ids: string[] = [];
      let cursor: unknown = null;
      for (let i = 0; i < 10; i++) {
        const pagina = await catalogo({ ordem, direcao }, cursor);
        expect(pagina.itens.length).toBeLessThanOrEqual(1);
        ids.push(...pagina.itens.map(p => p.id));
        cursor = pagina.proximoCursor;
        if (!cursor) break;
      }
      expect(ids).toEqual(esperados);
      expect(new Set(ids).size).toBe(ids.length);
    });

  it('RPC invoker respeita RLS restritiva como visitante', async () => {
    await cliente.query(`create policy esconder_corrida on public.parametros as restrictive for select to anon using (id <> 'corrida')`);
    await cliente.query('set local role anon');
    const pagina = await catalogo({}, null, 100);
    expect(pagina.itens.map(p => p.id)).toEqual(['p']);
    expect(pagina.itens[0]).not.toHaveProperty('o_que_faz');
  });

  it('tags E/OU deduplicadas, sem tag e filtros combinados', async () => {
    const a = '10000000-0000-0000-0000-000000000001';
    const b = '10000000-0000-0000-0000-000000000002';
    await cliente.query(`insert into public.tags(id,nome,slug) values ($1,'A','a'),($2,'B','b')`, [a,b]);
    await cliente.query(`insert into public.parametro_tags(parametro_id,tag_id) values ('p',$1),('p',$2),('corrida',$1)`, [a,b]);
    await cliente.query('set local role anon');
    expect((await catalogo({ tags: [a,b], operador: 'OU' },null,100)).itens).toHaveLength(2);
    expect((await catalogo({ tags: [a,b,a], operador: 'E', tipo: 'checkbox', status: 'pendente' },null,100)).itens.map(p => p.id)).toEqual(['p']);
    expect((await catalogo({ semTag: true },null,100)).itens).toEqual([]);
    const { rows } = await cliente.query('select public.listar_tags_com_contagem() as tags');
    expect(rows[0].tags.map((t: { totalVinculos: number }) => t.totalVinculos)).toEqual([2,1]);
  });

  it('busca normalizada trata % e _ como caracteres literais', async () => {
    await cliente.query(`update public.parametros set texto_busca = 'orcamento 10% x_y' where id='p'`);
    await cliente.query('set local role anon');
    for (const termo of ['ORÇAMENTO', '%', '_']) expect((await catalogo({ termo },null,100)).itens.map(p => p.id)).toEqual(['p']);
    expect((await catalogo({ termo: 'inexistente' })).proximoCursor).toBeNull();
  });

  it.each([
    [{ ordem: 'id;drop table parametros' },null,50], [{ direcao: 'sql' },null,50], [{ status: 'errado' },null,50],
    [{},null,101], [{},null,0], [{ tags: ['x'] },null,50], [{ tags: [null] },null,50],
    [{ semTag: true, tags: ['10000000-0000-0000-0000-000000000001'] },null,50],
    [{}, { v: 1, f: 'x', id: 'p', valor: 'a' }, 50], [{ ativo: 'sql' },null,50],
  ])('RPC rejeita entrada inválida %#', async (filtros,cursor,limite) => {
    await cliente.query('set local role anon');
    await expect(catalogo(filtros as Record<string,unknown>,cursor,limite as number)).rejects.toThrow();
  });

  it('cursor não pode ser reutilizado após mudança de filtro', async () => {
    await cliente.query('set local role anon');
    const pagina = await catalogo();
    expect(pagina.proximoCursor).not.toBeNull();
    await expect(catalogo({ termo: 'outro' }, pagina.proximoCursor)).rejects.toMatchObject({ code: '22023' });
  });

  it('visitante lê catálogo, mas não executa RPC nem altera dados', async () => {
    await cliente.query('set local role anon');
    expect((await cliente.query('select id from public.parametros')).rowCount).toBe(2);
    expect((await cliente.query("update public.parametros set nome='Invasão' where id='p'")).rowCount).toBe(0);
    await expect(cliente.query(sqlRpc, ['p', 0, 'Invasão', 'documentado'])).rejects.toMatchObject({ code: '42501' });
  });

  it.each([leitor, semPerfil, null])('nega RPC para identidade sem autorização: %s', async id => {
    await como(id);
    expect((await cliente.query("update public.parametros set nome='Invasão' where id='p'")).rowCount).toBe(0);
    await expect(cliente.query(sqlRpc, ['p', 0, 'Invasão', 'documentado'])).rejects.toMatchObject({ code: '42501' });
  });

  it('editor não altera origem, documentação direta, árvore nem forja histórico', async () => {
    await como(editor);
    expect((await cliente.query("update public.parametros set nome='Invasão', ativo=false where id='p'")).rowCount).toBe(0);
    expect((await cliente.query("update public.parametros set o_que_faz='Sem RPC' where id='p'")).rowCount).toBe(0);
    expect((await cliente.query("update public.abas set nome='Invasão' where id='aba'")).rowCount).toBe(0);
    await expect(cliente.query(`insert into public.historico_alteracoes(entidade,entidade_id,campo)
      values ('parametro','p','forjado')`)).rejects.toMatchObject({ code: '42501' });
  });

  it.each([editor, admin])('RPC salva somente documentação, normaliza busca e audita identidade: %s', async id => {
    await como(id);
    const { rows: [salvo] } = await cliente.query(sqlRpc, ['p', 0, 'ORÇAMENTO e ação', 'documentado']);
    expect(salvo).toMatchObject({ versao: 1, nome: 'Parâmetro', ativo: true, o_que_faz: 'ORÇAMENTO e ação' });
    expect(salvo.texto_busca).toContain('orcamento e acao');
    const historico = await cliente.query("select campo,usuario from public.historico_alteracoes where entidade_id='p'");
    expect(historico.rows).toEqual(expect.arrayContaining([
      { campo: 'oQueFaz', usuario: id }, { campo: 'statusDocumentacao', usuario: id },
    ]));
    expect(historico.rowCount).toBe(2);
  });

  it.each([
    ['p', null, 'texto', 'pendente'], ['p', -1, 'texto', 'pendente'],
    ['p', 0, 'texto', 'inválido'], ['p', 0, 'texto', null],
    ['', 0, 'texto', 'pendente'], ['p', 0, 'x'.repeat(20001), 'pendente'],
  ])('rejeita entrada inválida %#', async (id, versao, texto, status) => {
    await como(editor);
    await expect(cliente.query(sqlRpc, [id, versao, texto, status])).rejects.toMatchObject({ code: '22023' });
  });

  it('distingue parâmetro inexistente', async () => {
    await como(editor);
    await expect(cliente.query(sqlRpc, ['inexistente', 0, 'texto', 'pendente'])).rejects.toMatchObject({ code: 'P0002' });
  });

  it('conflito rejeita versão velha sem criar histórico adicional', async () => {
    await como(editor);
    await cliente.query(sqlRpc, ['p', 0, 'Primeira', 'pendente']);
    await cliente.query('savepoint tentativa');
    await expect(cliente.query(sqlRpc, ['p', 0, 'Segunda', 'pendente'])).rejects.toMatchObject({ code: '40001' });
    await cliente.query('rollback to savepoint tentativa');
    expect((await cliente.query("select o_que_faz,versao from public.parametros where id='p'")).rows[0])
      .toEqual({ o_que_faz: 'Primeira', versao: 1 });
    expect((await cliente.query('select * from public.historico_alteracoes')).rowCount).toBe(1);
  });

  it('falha no histórico desfaz a gravação documental', async () => {
    await cliente.query(`create function public.falhar_auditoria() returns trigger language plpgsql as $$
      begin raise exception 'Falha simulada de auditoria'; end $$;
      create trigger falhar before insert on public.historico_alteracoes
        for each row execute function public.falhar_auditoria();`);
    await como(editor);
    await cliente.query('savepoint tentativa');
    await expect(cliente.query(sqlRpc, ['p', 0, 'Não pode persistir', 'documentado'])).rejects.toThrow('Falha simulada');
    await cliente.query('rollback to savepoint tentativa');
    expect((await cliente.query("select o_que_faz,versao from public.parametros where id='p'")).rows[0])
      .toEqual({ o_que_faz: null, versao: 0 });
  });

  it('admin altera origem e árvore, mas não força uma versão diferente', async () => {
    await como(admin);
    expect((await cliente.query("update public.abas set nome='Nova' where id='aba'")).rowCount).toBe(1);
    const resultado = await cliente.query("update public.parametros set nome='Novo' where id='p' returning versao");
    expect(resultado.rows[0].versao).toBe(1);
    await expect(cliente.query("update public.parametros set versao=500 where id='p'")).rejects.toMatchObject({ code: '40001' });
  });

  it('adaptador PG não sobrescreve documentação salva após ler snapshot administrativo', async () => {
    // O adaptador só usa query; esta conexão usa a transação isolada do teste.
    const repo = criarRepositoriosPg(cliente as unknown as Pool);
    const [snapshot] = await repo.parametroImportacao.buscarPorIds(['p']);
    await como(editor);
    await cliente.query(sqlRpc, ['p', 0, 'Documentação nova', 'documentado']);
    await cliente.query('reset role');
    await cliente.query('savepoint tentativa');
    await expect(repo.parametroEscrita.salvar({ ...snapshot, nome: 'Origem nova' })).rejects.toMatchObject({ code: '40001' });
    await cliente.query('rollback to savepoint tentativa');
    const [atual] = await repo.parametroImportacao.buscarPorIds(['p']);
    expect(atual).toMatchObject({ nome: 'Parâmetro', oQueFaz: 'Documentação nova', versao: 1 });
    await repo.parametroEscrita.salvar({ ...atual, nome: 'Origem nova' });
    expect((await repo.parametroImportacao.buscarPorIds(['p']))[0]).toMatchObject({
      nome: 'Origem nova', oQueFaz: 'Documentação nova', versao: 2,
    });
    expect(await repo.parametroImportacao.listarIdsImportados()).toContain('p');
  });

  it('duas transações concorrentes com mesma versão: apenas uma vence', async () => {
    async function salvar(texto: string) {
      const c = await pool.connect();
      try {
        await c.query('begin');
        await como(editor, c);
        const resultado = await c.query(sqlRpc, ['corrida', 0, texto, 'documentado']);
        await c.query('commit');
        return resultado.rows[0];
      } catch (erro) {
        await c.query('rollback');
        throw erro;
      } finally { c.release(); }
    }
    const resultados = await Promise.allSettled([salvar('A'), salvar('B')]);
    expect(resultados.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const falha = resultados.find(r => r.status === 'rejected');
    expect(falha?.status === 'rejected' && falha.reason.code).toBe('40001');
  });
});

describe('Instalação SQL alternativa', () => {
  it('contém a migração de segurança integral, sem divergência', () => {
    const schema = readFileSync(resolve('supabase/schema.sql'), 'utf8');
    for (const f of readdirSync(resolve('migracoes')).filter(f => f.endsWith('.sql'))) {
      expect(schema).toContain(readFileSync(resolve('migracoes', f), 'utf8').trim());
    }
  });
});
