/**
 * Infraestrutura alternativa: implementa as portas usadas pela importação
 * sobre o Postgres direto (node-postgres), sem depender das chaves de API.
 * Mesmo domínio, mesmo caso de uso — outra implementação (DIP/LSP na prática).
 */

import { Pool } from 'pg';
import { Aba, EventoHistorico, LinhaHistorico, Parametro, Tela, TipoParametro } from '../src/dominio/entidades';
import { PortasImportacao } from '../src/aplicacao/caso-uso-importar';

type Linha = Record<string, unknown>;

function emBlocos<T>(itens: T[], tamanho: number): T[][] {
  const blocos: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) blocos.push(itens.slice(i, i + tamanho));
  return blocos;
}

export function criarRepositoriosPg(pool: Pool): PortasImportacao {
  function deLinhaParametro(linha: Linha): Parametro {
    return {
      id: String(linha.id),
      versao: Number(linha.versao ?? 0),
      abaId: String(linha.aba_id),
      grupo: String(linha.grupo ?? ''),
      nome: String(linha.nome),
      tipo: String(linha.tipo),
      opcoes: (linha.opcoes as string[] | null) ?? [],
      descricaoOriginal: (linha.descricao_original as string | null) ?? null,
      oQueFaz: (linha.o_que_faz as string | null) ?? null,
      impacto: (linha.impacto as string | null) ?? null,
      valorPadrao: (linha.valor_padrao as string | null) ?? null,
      observacoes: (linha.observacoes as string | null) ?? null,
      statusDocumentacao: (linha.status_documentacao as Parametro['statusDocumentacao']) ?? 'pendente',
      origem: (linha.origem as Parametro['origem']) ?? 'importado',
      hashOrigem: (linha.hash_origem as string | null) ?? null,
      editadoNaOrigem: Boolean(linha.editado_na_origem),
      ordem: Number(linha.ordem ?? 0),
      ativo: linha.ativo !== false,
      caminho: String(linha.caminho ?? ''),
      imagemOrigem: (linha.imagem_origem as string | null) ?? null,
      imagemPersonalizadaPath: (linha.imagem_personalizada_path as string | null) ?? null,
      imagemMarcada: Boolean(linha.imagem_marcada),
      textoBusca: String(linha.texto_busca ?? ''),
    };
  }

  const leituraTipos = {
    async listar(): Promise<TipoParametro[]> {
      const { rows } = await pool.query('select codigo, descricao, componentes from tipos_parametro order by codigo');
      return rows.map((linha) => ({
        codigo: String(linha.codigo),
        descricao: (linha.descricao as string | null) ?? null,
        componentes: (linha.componentes as string[] | null) ?? [],
      }));
    },
  };

  const escritaTipos = {
    async salvarEmLote(tipos: TipoParametro[]): Promise<void> {
      for (const tipo of tipos) {
        await pool.query(
          `insert into tipos_parametro (codigo, descricao, componentes)
           values ($1, $2, $3)
           on conflict (codigo) do update set descricao = excluded.descricao`,
          [tipo.codigo, tipo.descricao, tipo.componentes],
        );
      }
    },
  };

  const arvoreLeitura = {
    async listarTelas(): Promise<Tela[]> {
      const { rows } = await pool.query('select * from telas order by nome');
      return rows.map((linha) => ({
        id: String(linha.id),
        nome: String(linha.nome),
        descricao: (linha.descricao as string | null) ?? null,
        prefixoCaminho: String(linha.prefixo_caminho ?? ''),
      }));
    },
    async listarAbas(): Promise<Aba[]> {
      const { rows } = await pool.query('select * from abas order by ordem');
      return rows.map((linha) => ({
        id: String(linha.id),
        telaId: String(linha.tela_id),
        abaPaiId: (linha.aba_pai_id as string | null) ?? null,
        nome: String(linha.nome),
        nomeOriginalImportado: (linha.nome_original_importado as string | null) ?? null,
        nomeTruncadoNaTela: Boolean(linha.nome_truncado_na_tela),
        ordem: Number(linha.ordem ?? 0),
        caminho: String(linha.caminho ?? ''),
      }));
    },
  };

  const arvoreEscrita = {
    async salvarTelas(telas: Tela[]): Promise<void> {
      for (const tela of telas) {
        await pool.query(
          `insert into telas (id, nome, descricao, prefixo_caminho) values ($1, $2, $3, $4)
           on conflict (id) do update set nome = excluded.nome, descricao = excluded.descricao,
             prefixo_caminho = excluded.prefixo_caminho`,
          [tela.id, tela.nome, tela.descricao, tela.prefixoCaminho],
        );
      }
    },
    async salvarAbas(abas: Aba[]): Promise<void> {
      for (const aba of abas) {
        await pool.query(
          `insert into abas (id, tela_id, aba_pai_id, nome, nome_original_importado,
             nome_truncado_na_tela, ordem, caminho)
           values ($1, $2, $3, $4, $5, $6, $7, $8)
           on conflict (id) do update set tela_id = excluded.tela_id, aba_pai_id = excluded.aba_pai_id,
             nome = excluded.nome, nome_original_importado = excluded.nome_original_importado,
             nome_truncado_na_tela = excluded.nome_truncado_na_tela, ordem = excluded.ordem,
             caminho = excluded.caminho`,
          [aba.id, aba.telaId, aba.abaPaiId, aba.nome, aba.nomeOriginalImportado,
            aba.nomeTruncadoNaTela, aba.ordem, aba.caminho],
        );
      }
    },
    async renomearAba(abaId: string, nome: string): Promise<void> {
      await pool.query('update abas set nome = $2 where id = $1', [abaId, nome]);
    },
  };

  const parametroImportacao = {
    async listarIdsImportados(): Promise<string[]> {
      const { rows } = await pool.query("select id from parametros where origem = 'importado' order by id");
      return rows.map((linha) => String(linha.id));
    },
    async buscarPorIds(ids: string[]): Promise<Parametro[]> {
      if (ids.length === 0) return [];
      const saida: Parametro[] = [];
      for (const bloco of emBlocos(ids, 200)) {
        const { rows } = await pool.query('select * from parametros where id = any($1::text[])', [bloco]);
        saida.push(...rows.map(deLinhaParametro));
      }
      return saida;
    },

    async salvarEmLote(parametros: Parametro[]): Promise<void> {
      const COLUNAS = 22;
      for (const bloco of emBlocos(parametros, 100)) {
        const valores: unknown[] = [];
        const linhasSql = bloco.map((p, indice) => {
          const base = indice * COLUNAS;
          valores.push(
            p.id, p.abaId, p.grupo, p.nome, p.tipo, p.opcoes, p.descricaoOriginal,
            p.oQueFaz, p.impacto, p.valorPadrao, p.observacoes, p.statusDocumentacao,
            p.origem, p.hashOrigem, p.editadoNaOrigem, p.ordem, p.ativo, p.caminho,
            p.imagemOrigem, p.imagemMarcada, p.textoBusca, p.versao,
          );
          const marcadores = Array.from({ length: COLUNAS }, (_, j) => `$${base + j + 1}`);
          return `(${marcadores.join(', ')})`;
        });

        await pool.query(
          `insert into parametros (id, aba_id, grupo, nome, tipo, opcoes, descricao_original,
             o_que_faz, impacto, valor_padrao, observacoes, status_documentacao, origem,
             hash_origem, editado_na_origem, ordem, ativo, caminho, imagem_origem,
             imagem_marcada, texto_busca, versao)
           values ${linhasSql.join(', ')}
           on conflict (id) do update set
             aba_id = excluded.aba_id, grupo = excluded.grupo, nome = excluded.nome,
             tipo = excluded.tipo, opcoes = excluded.opcoes,
             descricao_original = excluded.descricao_original, o_que_faz = excluded.o_que_faz,
             impacto = excluded.impacto, valor_padrao = excluded.valor_padrao,
             observacoes = excluded.observacoes, status_documentacao = excluded.status_documentacao,
             origem = excluded.origem, hash_origem = excluded.hash_origem,
             editado_na_origem = excluded.editado_na_origem, ordem = excluded.ordem,
             ativo = excluded.ativo, caminho = excluded.caminho,
             imagem_origem = excluded.imagem_origem, imagem_marcada = excluded.imagem_marcada,
             texto_busca = excluded.texto_busca, versao = excluded.versao`,
          valores,
        );
      }
    },
  };

  const parametroEscrita = {
    ...parametroImportacao,
    async salvar(parametro: Parametro): Promise<void> {
      await parametroImportacao.salvarEmLote([parametro]);
    },
    async desativar(id: string): Promise<void> {
      await pool.query('update parametros set ativo = false where id = $1', [id]);
    },
  };

  const historico = {
    async registrar(eventos: EventoHistorico[]): Promise<void> {
      if (eventos.length === 0) return;
      const COLUNAS = 7;
      for (const bloco of emBlocos(eventos, 200)) {
        const valores: unknown[] = [];
        const linhasSql = bloco.map((evento, indice) => {
          const base = indice * COLUNAS;
          valores.push(evento.entidade, evento.entidadeId, evento.campo, evento.valorAnterior, evento.valorNovo, evento.usuario, evento.origem);
          const marcadores = Array.from({ length: COLUNAS }, (_, j) => `$${base + j + 1}`);
          return `(${marcadores.join(', ')})`;
        });
        await pool.query(
          `insert into historico_alteracoes (entidade, entidade_id, campo, valor_anterior, valor_novo, usuario, origem)
           values ${linhasSql.join(', ')}`,
          valores,
        );
      }
    },
    async listar(entidade: string, entidadeId: string): Promise<LinhaHistorico[]> {
      const { rows } = await pool.query(
        `select * from historico_alteracoes
          where entidade = $1 and entidade_id = $2
          order by criado_em desc limit 200`,
        [entidade, entidadeId],
      );
      return rows.map((linha) => ({
        id: Number(linha.id),
        entidade: String(linha.entidade),
        entidadeId: String(linha.entidade_id),
        campo: String(linha.campo),
        valorAnterior: (linha.valor_anterior as string | null) ?? null,
        valorNovo: (linha.valor_novo as string | null) ?? null,
        usuario: (linha.usuario as string | null) ?? null,
        origem: String(linha.origem ?? ''),
        criadoEm: String(linha.criado_em ?? ''),
      }));
    },
  };

  return {
    leituraTipos,
    escritaTipos,
    arvoreLeitura,
    arvoreEscrita,
    parametroImportacao,
    parametroEscrita,
    historico,
  };
}
