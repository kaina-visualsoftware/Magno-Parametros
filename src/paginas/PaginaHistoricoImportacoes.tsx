import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Carregando, ErroCarregamento } from '../componentes/Estado';
import { ehAdministrador, useAutenticacao } from '../aplicacao/autenticacao';
import { listarImportacoes } from '../servicos/administracao';

export default function PaginaHistoricoImportacoes() {
  const {usuario,papel,carregando}=useAutenticacao();
  const consulta=useQuery({queryKey:['admin','importacoes'],queryFn:listarImportacoes,enabled:ehAdministrador(papel)});
  if (carregando || (usuario && papel===null)) return <Carregando/>;
  if (!ehAdministrador(papel)) return <p className="erro">Acesso restrito a administradores. <Link to="/entrar">Entrar</Link></p>;
  return <section>
    <Link to="/admin" className="text-sm">Voltar ao painel</Link>
    <h1 className="mt-5">Histórico de importações</h1>
    <p className="text-suave">Registros das importações gravadas a partir desta versão. Simulações não aparecem no histórico.</p>
    <Link to="/importar" className="botao mb-6">Importar parâmetros</Link>
    {consulta.isPending ? <Carregando/> : consulta.error ? <ErroCarregamento erro={consulta.error} aoTentarNovamente={()=>void consulta.refetch()}/> : consulta.data?.length ? <div className="grid gap-3">
      {consulta.data.map(e=><article className="cartao !mb-0" key={e.id}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3"><strong>{e.fonte}</strong><time className="text-xs text-suave" dateTime={e.criado_em}>{new Date(e.criado_em).toLocaleString('pt-BR')}</time></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <span>Lidos: <strong>{e.relatorio.totalLido}</strong></span>
          <span>Novos: <strong>{e.relatorio.novos}</strong></span>
          <span>Alterados: <strong>{e.relatorio.alterados}</strong></span>
          <span>Conflitos: <strong>{e.relatorio.conflitos.length}</strong></span>
        </div>
        {!!e.relatorio.conflitos.length && <details className="mt-4"><summary>Ver conflitos</summary><ul className="mt-2 grid gap-1">{e.relatorio.conflitos.map(id=><li key={id}><Link to={`/parametro/${encodeURIComponent(id)}`}>{id}</Link></li>)}</ul></details>}
      </article>)}
    </div>:<div className="cartao">Ainda não há importações gravadas no histórico.</div>}
  </section>;
}
