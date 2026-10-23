import { Link } from 'react-router-dom';
import { Parametro } from '../dominio/entidades';

interface Propriedades {
  parametros: Parametro[];
}

export function TabelaParametros({ parametros }: Propriedades) {
  if (parametros.length === 0) {
    return <p className="vazio">Nenhum parâmetro encontrado para os filtros atuais.</p>;
  }
  return (
    <div className="rolagem-tabela">
      <table className="tabela">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Tipo</th>
            <th>Grupo</th>
            <th>Status</th>
            <th>Caminho no ERP</th>
          </tr>
        </thead>
        <tbody>
          {parametros.map((parametro) => (
            <tr key={parametro.id} className={parametro.ativo ? undefined : 'inativo'}>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
