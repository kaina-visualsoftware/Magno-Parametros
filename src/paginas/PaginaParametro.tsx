import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Pencil, PenLine } from 'lucide-react';
import { useDialogos } from '../componentes/Dialogo';
import { Migalhas } from '../componentes/Migalhas';
import { EditorTags } from '../componentes/EditorTags';
import { Carregando, ErroCarregamento, Vazio } from '../componentes/Estado';
import {
  obterParametro,
  obterTagsParametro,
  obterHistoricoParametro,
  listarTags,
  desativarParametro,
  editarCampoOrigem,
  salvarDocumentacao,
} from '../servicos/catalogo';
import {
  ehAdministrador,
  podeEditarDocumentacao,
  useAutenticacao,
} from '../aplicacao/autenticacao';
import { Parametro, StatusDocumentacao } from '../dominio/entidades';
import { StatusParametro } from '../componentes/StatusParametro';
import { ImagemParametro } from '../componentes/ImagemParametro';
import { CorrespondenciaBancoParametro } from '../componentes/CorrespondenciaBancoParametro';

export default function PaginaParametro() {
  const { confirmar, perguntar } = useDialogos();
  const local = useLocation();
  const retorno = typeof local.state?.voltar === 'string' && /^\/(?:\?|busca|tag\/|$)/.test(local.state.voltar) ? local.state.voltar : '/';
  const { id } = useParams<{ id: string }>();
  const { usuario, papel } = useAutenticacao();
  const podeEditar = podeEditarDocumentacao(papel);

  const admin = ehAdministrador(papel);
  const consulta = useQueryClient();

  const consultaDetalhe = useQuery({
    queryKey: ['parametro', id],
    queryFn: () => obterParametro(id as string),
    enabled: Boolean(id),
  });
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [edicaoAtiva, setEdicaoAtiva] = useState(false);
  const vinculos = useQuery({ queryKey: ['parametro-tags', id], queryFn: () => obterTagsParametro(id!), enabled: Boolean(id) });
  const catalogoTags = useQuery({ queryKey: ['tags'], queryFn: listarTags, enabled: podeEditar, staleTime: 300_000 });
  const consultaHistorico = useQuery({ queryKey: ['historico', usuario?.id, id], queryFn: () => obterHistoricoParametro(id!), enabled: Boolean(id && usuario && historicoAberto) });

  // ---- Estado do formulário de documentação ----
  const [oQueFaz, setOQueFaz] = useState('');
  const [impacto, setImpacto] = useState('');
  const [valorPadrao, setValorPadrao] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [statusDoc, setStatusDoc] = useState<StatusDocumentacao>('pendente');
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [versaoEsperada, setVersaoEsperada] = useState(0);
  const rascunho = useRef({ id, alterado: false });

  function carregarFormulario(parametro: Parametro) {
    setOQueFaz(parametro.oQueFaz ?? parametro.descricaoOriginal ?? '');
    setImpacto(parametro.impacto ?? '');
    setValorPadrao(parametro.valorPadrao ?? '');
    setObservacoes(parametro.observacoes ?? '');
    setStatusDoc(parametro.statusDocumentacao);
    setVersaoEsperada(parametro.versao);
    rascunho.current = { id: parametro.id, alterado: false };
  }

  useEffect(() => {
    setMensagem('');
    setErro('');
    setEdicaoAtiva(false);
  }, [id]);

  useEffect(() => {
    const detalhe = consultaDetalhe.data;
    if (detalhe && (rascunho.current.id !== id || !rascunho.current.alterado)) {
      carregarFormulario(detalhe);
    }
  }, [consultaDetalhe.data, id]);

  const salvar = useMutation({
    mutationFn: () =>
      salvarDocumentacao({
        id: id as string,
        versaoEsperada,
        oQueFaz: oQueFaz || null,
        impacto: impacto || null,
        valorPadrao: valorPadrao || null,
        observacoes: observacoes || null,
        statusDocumentacao: statusDoc,
      }),
    onSuccess: async (parametro) => {
      if (rascunho.current.id !== parametro.id) return;
      carregarFormulario(parametro);
      setMensagem('Documentação salva.');
      setEdicaoAtiva(false);
      setErro('');
      await consulta.invalidateQueries({ queryKey: ['parametro', id] });
      await consulta.invalidateQueries({ queryKey: ['parametros'] });
      await consulta.invalidateQueries({ queryKey: ['historico'] });
    },
    onError: (causa) => {
      setMensagem('');
      setErro(causa instanceof Error ? causa.message : String(causa));
    },
  });

  const editarOrigem = useMutation({
    mutationFn: async (entrada: { campo: 'nome' | 'grupo' | 'descricaoOriginal' | 'tipo' | 'opcoes'; valor: string | string[] }) =>
      editarCampoOrigem({ id: id as string, ...entrada, usuario: usuario?.email ?? null }),
    onSuccess: async () => {
      setErro('');
      setMensagem('Dados de origem atualizados.');
      await consulta.invalidateQueries({ queryKey: ['parametro', id] });
      await consulta.invalidateQueries({ queryKey: ['arvore'] });
      await consulta.invalidateQueries({ queryKey: ['parametros'] });
      await consulta.invalidateQueries({ queryKey: ['historico'] });
      await consulta.invalidateQueries({ queryKey: ['tipos'] });
    },
    onError: (causa) => setErro(causa instanceof Error ? causa.message : String(causa)),
  });

  if (usuario && papel === null) return <Carregando />;
  if (consultaDetalhe.isLoading) return <Carregando />;
  if (consultaDetalhe.error) return <ErroCarregamento erro={consultaDetalhe.error} />;
  if (!consultaDetalhe.data) return <Vazio mensagem="Parâmetro não encontrado." />;

  const parametro = consultaDetalhe.data;
  const tags = vinculos.data ?? [];
  const todasTags = podeEditar ? catalogoTags.data ?? [] : [];
  const historico = usuario ? consultaHistorico.data ?? [] : [];

  async function pedirEdicaoDeOrigem(campo: 'nome' | 'grupo' | 'descricaoOriginal' | 'tipo' | 'opcoes', valorAtual: string | null) {
    const valor = await perguntar(
      `Editar o campo de origem "${campo}".${campo === "opcoes" ? "\nUma opção por linha." : ""}\n\nAtenção: este campo veio do arquivo importado. ` +
        'Ao editá-lo, a próxima importação NÃO sobrescreverá este parâmetro (ficará como conflito para revisão).',
      valorAtual ?? '',
    );
    if (valor === null || valor === (valorAtual ?? '')) return;
    const valorFormatado = campo === 'opcoes' ? valor.split('\n').map(opcao => opcao.trim()).filter(Boolean) : valor;
    editarOrigem.mutate({ campo, valor: valorFormatado });
  }

  return (
    <article className="pagina-parametro">
      <Link to={retorno} className="inline-flex items-center gap-2 text-sm mb-6"><ArrowLeft size={16} aria-hidden />Voltar ao catálogo</Link>
      <Migalhas segmentos={parametro.caminho.split(' > ')} />

      <header className="cabecalho-parametro">
        <h1>{parametro.nome}</h1>
        <div className="etiquetas">
          <span className="etiqueta tipo">{parametro.tipo}</span>
          <StatusParametro status={parametro.statusDocumentacao} />
          <span className="etiqueta origem">origem: {parametro.origem}</span>
          {!parametro.ativo && <span className="etiqueta inativo">inativo</span>}
          {parametro.imagemOrigem && (
            <span className="etiqueta" title="Captura de tela usada como evidência na origem">
              evidência: {parametro.imagemOrigem}
            </span>
          )}
        </div>
      </header>

      {erro && <p className="erro" role="alert">{erro}</p>}

      {admin && <div className="flex flex-wrap items-center gap-3 mb-6">
        <button type="button" className={edicaoAtiva?'botao fantasma':'botao'} aria-pressed={edicaoAtiva}
          onClick={async () => {
            if (edicaoAtiva && rascunho.current.alterado) {
              if (!await confirmar('Sair do modo de edição? As alterações não salvas permanecerão no formulário até recarregar a página.')) return;
            }
            setEdicaoAtiva(!edicaoAtiva);
          }}><PenLine size={17} aria-hidden/>{edicaoAtiva?'Concluir edição':'Editar parâmetro'}</button>
        {edicaoAtiva && <span className="text-sm text-suave">Você está no modo de edição. Salve cada seção separadamente.</span>}
      </div>}
      <ImagemParametro parametro={parametro} admin={admin && edicaoAtiva} />
      <CorrespondenciaBancoParametro key={parametro.id} parametroId={parametro.id} />

      <div className="grade-detalhe">
        <section className="cartao">
          <h2>
            Dados de origem <span className="dica block font-normal">Campos importados; administradores podem ajustar os valores (ajustes criam conflitos na reimportação).</span>
          </h2>
          <dl className="definicoes">
            <dt>Tipo</dt>
            <dd>{parametro.tipo}{admin && edicaoAtiva && <button type="button" className="botao-icone pequeno" disabled={editarOrigem.isPending} title="Editar tipo" aria-label="Editar tipo" onClick={() => pedirEdicaoDeOrigem('tipo', parametro.tipo)}><Pencil size={16} aria-hidden /></button>}</dd>
            <dt>Grupo</dt>
            <dd>
              {parametro.grupo}
              {admin && edicaoAtiva && (
                <button
                  type="button"
                  className="botao-icone pequeno"
                  title="Editar grupo (campo de origem)"
                  aria-label="Editar grupo (campo de origem)"
                  disabled={editarOrigem.isPending}
                  onClick={() => pedirEdicaoDeOrigem('grupo', parametro.grupo)}
                >
                  <Pencil size={16} aria-hidden />
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
                  aria-label="Editar descrição original (campo de origem)"
                  disabled={editarOrigem.isPending}
                  onClick={() => pedirEdicaoDeOrigem('descricaoOriginal', parametro.descricaoOriginal)}
                >
                  <Pencil size={16} aria-hidden />
                </button>
              )}
            </dd>
            <dt>Opções</dt>
            <dd>{parametro.opcoes.length > 0 ? parametro.opcoes.join(' · ') : '—'}{admin && <button type="button" className="botao-icone pequeno" disabled={editarOrigem.isPending} title="Editar opções" aria-label="Editar opções" onClick={() => pedirEdicaoDeOrigem('opcoes', parametro.opcoes.join('\n'))}><Pencil size={16} aria-hidden /></button>}</dd>
            <dt>Identificador</dt>
            <dd className="texto-mono">{parametro.id}</dd>
          </dl>
          {admin && (
            <button
              type="button"
              className="botao fantasma"
              disabled={editarOrigem.isPending}
              onClick={() => pedirEdicaoDeOrigem('nome', parametro.nome)}
            >
              Renomear parâmetro (campo de origem)
            </button>
          )}
        </section>

        <section className="cartao">
          <h2>Documentação</h2>
          {!parametro.oQueFaz && parametro.descricaoOriginal && <p className="dica">A descrição inicial abaixo foi importada do arquivo de origem. Ao salvar, ela passará a integrar a documentação editável.</p>}
          <fieldset disabled={!podeEditar || (admin && !edicaoAtiva) || salvar.isPending} style={{ border: 0, padding: 0, margin: 0 }}
            onChange={() => { rascunho.current.alterado = true; setMensagem(''); }}>
          <label className="campo">
            <span>O que faz</span>
            <textarea
              rows={4}
              maxLength={20000}
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
              maxLength={20000}
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
              maxLength={20000}
              value={valorPadrao}
              onChange={(evento) => setValorPadrao(evento.target.value)}
              disabled={!podeEditar}
            />
          </label>
          <label className="campo">
            <span>Observações</span>
            <textarea
              rows={3}
              maxLength={20000}
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
          </fieldset>
          {podeEditar && (!admin || edicaoAtiva) ? (
            <><button
              type="button"
              className="botao primario"
              disabled={salvar.isPending}
              onClick={() => salvar.mutate()}
            >
              {salvar.isPending ? 'Salvando…' : 'Salvar documentação'}
            </button>
            <button type="button" className="botao fantasma"
              disabled={salvar.isPending || consultaDetalhe.isFetching}
              onClick={async () => {
                if (rascunho.current.alterado && !await confirmar('Descartar seu rascunho e carregar a versão atual?')) return;
                const resultado = await consultaDetalhe.refetch();
                if (resultado.error) {
                  setErro('Não foi possível recarregar. Seu rascunho foi preservado.');
                } else if (resultado.data) {
                  carregarFormulario(resultado.data);
                  setErro('');
                  setMensagem('Versão atual carregada.');
                }
              }}>Recarregar documentação</button></>
          ) : (
            <p className="dica">
              Somente <strong>editores</strong> e <strong>administradores</strong> editam a
              documentação. <Link to="/entrar">Entrar</Link>
            </p>
          )}
          {mensagem && <p className="mensagem-sucesso" role="status">{mensagem}</p>}
        </section>

        <section className="cartao">
          <h2>Tags</h2>
          {vinculos.isPending ? <Carregando /> : vinculos.error ? (
            <ErroCarregamento erro={vinculos.error} aoTentarNovamente={() => void vinculos.refetch()} />
          ) : (
            <>
              {podeEditar && catalogoTags.error && <ErroCarregamento erro={catalogoTags.error} aoTentarNovamente={() => void catalogoTags.refetch()} />}
              {podeEditar && catalogoTags.isPending ? <Carregando /> : <EditorTags
                parametroId={parametro.id}
                tagsVinculadas={tags}
                todasTags={todasTags}
                podeEditar={podeEditar && !catalogoTags.error}
              />}
            </>
          )}
        </section>

        <section className="cartao">
          <details onToggle={e => setHistoricoAberto(e.currentTarget.open)}>
          <summary className="font-semibold">Histórico de alterações</summary>
          {!usuario ? <p className="dica">Entre para consultar o histórico.</p> : !historicoAberto ? null
            : consultaHistorico.isPending ? <Carregando /> : consultaHistorico.error ?
            <ErroCarregamento erro={consultaHistorico.error} aoTentarNovamente={() => void consultaHistorico.refetch()} /> : <>
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
                      <td data-label="Data">{new Date(linha.criadoEm).toLocaleString('pt-BR')}</td>
                      <td data-label="Campo">{linha.campo}</td>
                      <td data-label="Antes" className="celula-caminho">{linha.valorAnterior ?? '—'}</td>
                      <td data-label="Depois" className="celula-caminho">{linha.valorNovo ?? '—'}</td>
                      <td data-label="Origem">{linha.origem}</td>
                      <td data-label="Usuário">{linha.usuario ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </>}
          </details>
        </section>
      </div>

      {admin && edicaoAtiva && parametro.ativo && (
        <div className="zona-perigo">
          <button
            type="button"
            className="botao perigo"
            onClick={async () => {
              const confirmado = await confirmar(
                'Desativar este parâmetro? (exclusão lógica — ele deixa de aparecer nas listagens)',
              );
              if (!confirmado) return;
              try {
                await desativarParametro(parametro.id, usuario?.email ?? null);
                await consulta.invalidateQueries({ queryKey: ['parametro', id] });
                await consulta.invalidateQueries({ queryKey: ['arvore'] });
                await consulta.invalidateQueries({ queryKey: ['parametros'] });
                await consulta.invalidateQueries({ queryKey: ['historico'] });
              } catch (causa) { setErro(causa instanceof Error ? causa.message : 'Não foi possível desativar.'); }
            }}
          >
            Desativar parâmetro
          </button>
        </div>
      )}
    </article>
  );
}
