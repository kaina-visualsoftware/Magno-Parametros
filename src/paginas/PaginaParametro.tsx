import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Migalhas } from '../componentes/Migalhas';
import { EditorTags } from '../componentes/EditorTags';
import { Carregando, ErroCarregamento, Vazio } from '../componentes/Estado';
import {
  detalharParametro,
  desativarParametro,
  editarCampoOrigem,
  salvarDocumentacao,
} from '../servicos/catalogo';
import {
  ehAdministrador,
  podeEditarDocumentacao,
  useAutenticacao,
} from '../aplicacao/autenticacao';
import { StatusDocumentacao } from '../dominio/entidades';

export default function PaginaParametro() {
  const { id } = useParams<{ id: string }>();
  const { usuario, papel } = useAutenticacao();
  const podeEditar = podeEditarDocumentacao(papel);
  const admin = ehAdministrador(papel);
  const consulta = useQueryClient();

  const consultaDetalhe = useQuery({
    queryKey: ['parametro', id],
    queryFn: () => detalharParametro(id as string),
    enabled: Boolean(id),
  });

  // ---- Estado do formulário de documentação ----
  const [oQueFaz, setOQueFaz] = useState('');
  const [impacto, setImpacto] = useState('');
  const [valorPadrao, setValorPadrao] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [statusDoc, setStatusDoc] = useState<StatusDocumentacao>('pendente');
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [falhaImagem, setFalhaImagem] = useState(false);

  useEffect(() => {
    setFalhaImagem(false);
  }, [id]);

  useEffect(() => {
    const detalhe = consultaDetalhe.data;
    if (detalhe) {
      setOQueFaz(detalhe.parametro.oQueFaz ?? '');
      setImpacto(detalhe.parametro.impacto ?? '');
      setValorPadrao(detalhe.parametro.valorPadrao ?? '');
      setObservacoes(detalhe.parametro.observacoes ?? '');
      setStatusDoc(detalhe.parametro.statusDocumentacao);
    }
  }, [consultaDetalhe.data]);

  const salvar = useMutation({
    mutationFn: () =>
      salvarDocumentacao({
        id: id as string,
        oQueFaz: oQueFaz || null,
        impacto: impacto || null,
        valorPadrao: valorPadrao || null,
        observacoes: observacoes || null,
        statusDocumentacao: statusDoc,
        usuario: usuario?.email ?? null,
      }),
    onSuccess: async () => {
      setMensagem('Documentação salva.');
      setErro('');
      await consulta.invalidateQueries({ queryKey: ['parametro', id] });
      await consulta.invalidateQueries({ queryKey: ['parametros'] });
    },
    onError: (causa) => {
      setMensagem('');
      setErro(causa instanceof Error ? causa.message : String(causa));
    },
  });

  const editarOrigem = useMutation({
    mutationFn: async (entrada: { campo: 'nome' | 'grupo' | 'descricaoOriginal'; valor: string }) =>
      editarCampoOrigem({ id: id as string, ...entrada, usuario: usuario?.email ?? null }),
    onSuccess: async () => {
      await consulta.invalidateQueries({ queryKey: ['parametro', id] });
      await consulta.invalidateQueries({ queryKey: ['arvore'] });
      await consulta.invalidateQueries({ queryKey: ['parametros'] });
    },
    onError: (causa) => setErro(causa instanceof Error ? causa.message : String(causa)),
  });

  if (consultaDetalhe.isLoading) return <Carregando />;
  if (consultaDetalhe.error) return <ErroCarregamento erro={consultaDetalhe.error} />;
  if (!consultaDetalhe.data) return <Vazio mensagem="Parâmetro não encontrado." />;

  const { parametro, tags, todasTags, historico } = consultaDetalhe.data;

  function pedirEdicaoDeOrigem(campo: 'nome' | 'grupo' | 'descricaoOriginal', valorAtual: string | null) {
    const valor = window.prompt(
      `Editar o campo de origem "${campo}".\n\nAtenção: este campo veio do arquivo importado. ` +
        'Ao editá-lo, a próxima importação NÃO sobrescreverá este parâmetro (ficará como conflito para revisão).',
      valorAtual ?? '',
    );
    if (valor === null || valor === (valorAtual ?? '')) return;
    editarOrigem.mutate({ campo, valor });
  }

  return (
    <article className="pagina-parametro">
      <Migalhas segmentos={parametro.caminho.split(' > ')} />

      <header className="cabecalho-parametro">
        <h1>{parametro.nome}</h1>
        <div className="etiquetas">
          <span className="etiqueta tipo">{parametro.tipo}</span>
          <span className={`etiqueta status-${parametro.statusDocumentacao}`}>
            {parametro.statusDocumentacao}
          </span>
          <span className="etiqueta origem">origem: {parametro.origem}</span>
          {!parametro.ativo && <span className="etiqueta inativo">inativo</span>}
          {parametro.imagemOrigem && (
            <span className="etiqueta" title="Captura de tela usada como evidência na origem">
              evidência: {parametro.imagemOrigem}
            </span>
          )}
        </div>
      </header>

      {erro && <p className="erro">{erro}</p>}

      {parametro.imagemMarcada && !falhaImagem && (
        <section className="cartao cartao-imagem">
          <h2>Localização na tela de origem</h2>
          <img
            className="imagem-destacada"
            src={`${import.meta.env.BASE_URL}imagens-parametro/${parametro.id}.png`}
            alt={`Captura da tela de origem com "${parametro.nome}" destacado em retângulo vermelho`}
            loading="lazy"
            onError={() => setFalhaImagem(true)}
          />
          <p className="dica">
            Retângulo vermelho: posição do parâmetro na captura original
            {parametro.imagemOrigem ? ` (${parametro.imagemOrigem})` : ''}.
          </p>
        </section>
      )}

      <div className="grade-detalhe">
        <section className="cartao">
          <h2>
            Dados de origem <span className="dica">(somente leitura — vindos do arquivo importado)</span>
          </h2>
          <dl className="definicoes">
            <dt>Grupo</dt>
            <dd>
              {parametro.grupo}
              {admin && (
                <button
                  type="button"
                  className="botao-icone pequeno"
                  title="Editar grupo (campo de origem)"
                  onClick={() => pedirEdicaoDeOrigem('grupo', parametro.grupo)}
                >
                  ✎
                </button>
              )}
            </dd>
            <dt>Descrição original</dt>
            <dd>
              {parametro.descricaoOriginal ?? '—'}
              {admin && (
                <button
                  type="button"
                  className="botao-icone pequeno"
                  title="Editar descrição original (campo de origem)"
                  onClick={() => pedirEdicaoDeOrigem('descricaoOriginal', parametro.descricaoOriginal)}
                >
                  ✎
                </button>
              )}
            </dd>
            <dt>Opções</dt>
            <dd>{parametro.opcoes.length > 0 ? parametro.opcoes.join(' · ') : '—'}</dd>
            <dt>Identificador</dt>
            <dd className="texto-mono">{parametro.id}</dd>
          </dl>
          {admin && (
            <button
              type="button"
              className="botao fantasma"
              onClick={() => pedirEdicaoDeOrigem('nome', parametro.nome)}
            >
              Renomear parâmetro (campo de origem)
            </button>
          )}
        </section>

        <section className="cartao">
          <h2>Documentação</h2>
          <label className="campo">
            <span>O que faz</span>
            <textarea
              rows={4}
              value={oQueFaz}
              onChange={(evento) => setOQueFaz(evento.target.value)}
              disabled={!podeEditar}
              placeholder="Descreva o que este parâmetro controla no ERP…"
            />
          </label>
          <label className="campo">
            <span>Impacto</span>
            <textarea
              rows={3}
              value={impacto}
              onChange={(evento) => setImpacto(evento.target.value)}
              disabled={!podeEditar}
              placeholder="O que muda no sistema quando ativado/desativado…"
            />
          </label>
          <label className="campo">
            <span>Valor padrão</span>
            <input
              type="text"
              value={valorPadrao}
              onChange={(evento) => setValorPadrao(evento.target.value)}
              disabled={!podeEditar}
            />
          </label>
          <label className="campo">
            <span>Observações</span>
            <textarea
              rows={3}
              value={observacoes}
              onChange={(evento) => setObservacoes(evento.target.value)}
              disabled={!podeEditar}
            />
          </label>
          <label className="campo">
            <span>Status da documentação</span>
            <select
              value={statusDoc}
              onChange={(evento) => setStatusDoc(evento.target.value as StatusDocumentacao)}
              disabled={!podeEditar}
            >
              <option value="pendente">pendente</option>
              <option value="documentado">documentado</option>
              <option value="revisado">revisado</option>
            </select>
          </label>
          {podeEditar ? (
            <button
              type="button"
              className="botao primario"
              disabled={salvar.isPending}
              onClick={() => salvar.mutate()}
            >
              Salvar documentação
            </button>
          ) : (
            <p className="dica">
              Somente <strong>editores</strong> e <strong>administradores</strong> editam a
              documentação. <Link to="/entrar">Entrar</Link>
            </p>
          )}
          {mensagem && <p className="mensagem-sucesso">{mensagem}</p>}
        </section>

        <section className="cartao">
          <h2>Tags</h2>
          <EditorTags
            parametroId={parametro.id}
            tagsVinculadas={tags}
            todasTags={todasTags}
            podeEditar={podeEditar}
          />
        </section>

        <section className="cartao">
          <h2>Histórico de alterações</h2>
          {historico.length === 0 ? (
            <p className="vazio">Sem alterações registradas.</p>
          ) : (
            <div className="rolagem-tabela">
              <table className="tabela pequena">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Campo</th>
                    <th>Antes</th>
                    <th>Depois</th>
                    <th>Origem</th>
                    <th>Usuário</th>
                  </tr>
                </thead>
                <tbody>
                  {historico.map((linha) => (
                    <tr key={linha.id}>
                      <td>{new Date(linha.criadoEm).toLocaleString('pt-BR')}</td>
                      <td>{linha.campo}</td>
                      <td className="celula-caminho">{linha.valorAnterior ?? '—'}</td>
                      <td className="celula-caminho">{linha.valorNovo ?? '—'}</td>
                      <td>{linha.origem}</td>
                      <td>{linha.usuario ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {admin && parametro.ativo && (
        <div className="zona-perigo">
          <button
            type="button"
            className="botao perigo"
            onClick={async () => {
              const confirmar = window.confirm(
                'Desativar este parâmetro? (exclusão lógica — ele deixa de aparecer nas listagens)',
              );
              if (!confirmar) return;
              await desativarParametro(parametro.id, usuario?.email ?? null);
              await consulta.invalidateQueries({ queryKey: ['parametro', id] });
              await consulta.invalidateQueries({ queryKey: ['arvore'] });
              await consulta.invalidateQueries({ queryKey: ['parametros'] });
            }}
          >
            Desativar parâmetro
          </button>
        </div>
      )}
    </article>
  );
}
