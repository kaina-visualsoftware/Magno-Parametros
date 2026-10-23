import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Carregando, ErroCarregamento, Vazio } from '../componentes/Estado';
import { CopiarCaminho } from '../componentes/CopiarCaminho';
import { baixarArquivo, exportarCsv, exportarJson, parametrosDaTag } from '../servicos/catalogo';

/**
 * Página central da funcionalidade de tags: ao abrir uma tag, lista todos os
 * parâmetros vinculados com o caminho completo, filtros e exportação.
 */
export default function PaginaTag() {
  const { slug } = useParams<{ slug: string }>();
  const consulta = useQuery({
    queryKey: ['tag', slug],
    queryFn: () => parametrosDaTag(slug as string),
    enabled: Boolean(slug),
  });

  const [status, setStatus] = useState('');
  const [tipo, setTipo] = useState('');
  const [termo, setTermo] = useState('');

  if (consulta.isLoading) return <Carregando />;
  if (consulta.error) return <ErroCarregamento erro={consulta.error} />;
  if (!consulta.data) return <Vazio mensagem="Tag não encontrada." />;

  const { tag, parametros } = consulta.data;
  const tiposDisponiveis = [...new Set(parametros.map((parametro) => parametro.tipo))].sort();

  const filtrados = parametros.filter((parametro) => {
    if (status && parametro.statusDocumentacao !== status) return false;
    if (tipo && parametro.tipo !== tipo) return false;
    if (termo && !`${parametro.nome} ${parametro.caminho}`.toLowerCase().includes(termo.toLowerCase()))
      return false;
    return true;
  });

  function exportar(formato: 'csv' | 'json') {
    if (formato === 'csv') {
      baixarArquivo(`tag-${tag.slug}.csv`, exportarCsv(filtrados), 'text/csv;charset=utf-8');
    } else {
      baixarArquivo(`tag-${tag.slug}.json`, exportarJson(filtrados), 'application/json');
    }
  }

  return (
    <div className="pagina-tag">
      <header className="cabecalho-tag">
        <h1>
          Tag: {tag.nome} <span className="texto-mono menor">({tag.slug})</span>
        </h1>
        <p className="estatistica">
          {filtrados.length} de {parametros.length} parâmetro{parametros.length === 1 ? '' : 's'}
        </p>
      </header>

      <div className="barra-filtros">
        <input
          type="search"
          value={termo}
          onChange={(evento) => setTermo(evento.target.value)}
          placeholder="Filtrar por nome ou caminho…"
          aria-label="Filtrar parâmetros da tag"
        />
        <select value={tipo} onChange={(evento) => setTipo(evento.target.value)} aria-label="Filtrar por tipo">
          <option value="">Todos os tipos</option>
          {tiposDisponiveis.map((codigo) => (
            <option key={codigo} value={codigo}>
              {codigo}
            </option>
          ))}
        </select>
        <select value={status} onChange={(evento) => setStatus(evento.target.value)} aria-label="Filtrar por status">
          <option value="">Documentação: todas</option>
          <option value="pendente">Pendentes</option>
          <option value="documentado">Documentados</option>
          <option value="revisado">Revisados</option>
        </select>
        <button type="button" className="botao fantasma" onClick={() => exportar('csv')}>
          Exportar CSV
        </button>
        <button type="button" className="botao fantasma" onClick={() => exportar('json')}>
          Exportar JSON
        </button>
      </div>

      {filtrados.length === 0 ? (
        <p className="vazio">Nenhum parâmetro para os filtros atuais.</p>
      ) : (
        <table className="tabela">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Tipo</th>
              <th>Grupo</th>
              <th>Status</th>
              <th>Caminho completo</th>
              <th aria-label="Copiar" />
            </tr>
          </thead>
          <tbody>
            {filtrados.map((parametro) => (
              <tr key={parametro.id}>
                <td>
                  <Link className="link-parametro" to={`/parametro/${parametro.id}`}>
                    {parametro.nome}
                  </Link>
                </td>
                <td>
                  <span className="etiqueta tipo">{parametro.tipo}</span>
                </td>
                <td>{parametro.grupo}</td>
                <td>
                  <span className={`etiqueta status-${parametro.statusDocumentacao}`}>
                    {parametro.statusDocumentacao}
                  </span>
                </td>
                <td className="celula-caminho" title={parametro.caminho}>
                  {parametro.caminho}
                </td>
                <td>
                  <CopiarCaminho caminho={parametro.caminho} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
