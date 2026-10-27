import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Search } from 'lucide-react';
import { baixarArquivo } from '../servicos/catalogo';
import { useQuery } from '@tanstack/react-query';
import { Carregando, ErroCarregamento } from '../componentes/Estado';
import { ehAdministrador, useAutenticacao } from '../aplicacao/autenticacao';
import { listarImportacoes } from '../servicos/administracao';

export default function PaginaHistoricoImportacoes() {
  const {usuario,papel,carregando}=useAutenticacao();
  const [somenteConflitos,setSomenteConflitos]=useState(false);
  const [busca,setBusca]=useState('');
  const consulta=useQuery({queryKey:['admin','importacoes'],queryFn:listarImportacoes,enabled:ehAdministrador(papel)});
  if (carregando || (usuario && papel===null)) return <Carregando/>;
  if (!ehAdministrador(papel)) return <p className="erro">Acesso restrito a administradores. <Link to="/entrar">Entrar</Link></p>;
  const filtrados=(consulta.data??[]).filter(e=>(!somenteConflitos||e.relatorio.conflitos.length>0)
    && (!busca.trim()||e.fonte.toLocaleLowerCase('pt-BR').includes(busca.trim().toLocaleLowerCase('pt-BR'))));
  function exportarCsv(){
    const linhas=[['Data','Fonte','Lidos','Novos','Alterados','Inalterados','Conflitos','Alertas'],
      ...filtrados.map(e=>[e.criado_em,e.fonte,e.relatorio.totalLido,e.relatorio.novos,e.relatorio.alterados,
        e.relatorio.inalterados,e.relatorio.conflitos.length,e.relatorio.alertas.length])];
    const csv='\uFEFF'+linhas.map(l=>l.map(c=>'"'+String(c).replaceAll('"','""')+'"').join(';')).join('\r\n');
    baixarArquivo('historico-importacoes.csv',csv,'text/csv;charset=utf-8');
  }
  return <section>
    <Link to="/admin" className="text-sm">Voltar ao painel</Link>
    <h1 className="mt-5">Histórico de importações</h1>
    <p className="text-suave">Registros das importações gravadas a partir desta versão. Simulações não aparecem no histórico.</p>
    <div className="flex flex-wrap items-center gap-3 mb-6">
      <Link to="/importar" className="botao">Importar parâmetros</Link>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={somenteConflitos} onChange={e=>setSomenteConflitos(e.target.checked)}/>Somente com conflitos</label>
      <label className="flex items-center gap-2 text-sm"><Search size={16} aria-hidden/><input type="search" value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Filtrar por fonte" aria-label="Filtrar histórico por fonte"/></label>
      <button className="botao fantasma" type="button" onClick={exportarCsv} disabled={!filtrados.length}><Download size={16} aria-hidden/>Exportar CSV</button>
    </div>
    {consulta.isPending ? <Carregando/> : consulta.error ? <ErroCarregamento erro={consulta.error} aoTentarNovamente={()=>void consulta.refetch()}/> : filtrados.length ? <div className="grid gap-3">
      {filtrados.map(e=><article className="cartao !mb-0" key={e.id}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3"><strong>{e.fonte}</strong><time className="text-xs text-suave" dateTime={e.criado_em}>{new Date(e.criado_em).toLocaleString('pt-BR')}</time></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <span>Lidos: <strong>{e.relatorio.totalLido}</strong></span>
          <span>Novos: <strong>{e.relatorio.novos}</strong></span>
          <span>Alterados: <strong>{e.relatorio.alterados}</strong></span>
          <span>Conflitos: <strong>{e.relatorio.conflitos.length}</strong></span>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <button type="button" className="botao fantasma" onClick={()=>baixarArquivo(`importacao-${e.id}.json`,JSON.stringify(e.relatorio,null,2),'application/json')}><Download size={16} aria-hidden/>Baixar relatório JSON</button>
        </div>
        {!!e.relatorio.conflitos.length && <details className="mt-4"><summary>Ver conflitos</summary><ul className="mt-2 grid gap-1">{e.relatorio.conflitos.map(id=><li key={id}><Link to={`/parametro/${encodeURIComponent(id)}`}>{id}</Link></li>)}</ul></details>}
      </article>)}
    </div>:<div className="cartao">Ainda não há importações gravadas no histórico.</div>}
  </section>;
}
