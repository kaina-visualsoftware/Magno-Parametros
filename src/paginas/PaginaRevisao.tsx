import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckSquare, Image, ListChecks, Plus, Search, X } from 'lucide-react';
import { ehAdministrador, useAutenticacao } from '../aplicacao/autenticacao';
import { useDialogos } from '../componentes/Dialogo';
import { Carregando, ErroCarregamento } from '../componentes/Estado';
import { listarFilaAdministrativa, type TipoFila } from '../servicos/administracao';
import { obterParametro, salvarDocumentacao } from '../servicos/catalogo';

const tipos: {valor: TipoFila; nome: string}[] = [
  {valor:'documentacao',nome:'Documentação pendente'},
  {valor:'sem-imagem',nome:'Sem imagem'},
  {valor:'ocr',nome:'Imagens automáticas'},
  {valor:'conflitos',nome:'Origem editada'},
  {valor:'todos',nome:'Todos'},
];
export default function PaginaRevisao() {
  const { papel, carregando } = useAutenticacao();
  const { confirmar } = useDialogos();
  const cache = useQueryClient();
  const [url, setUrl] = useSearchParams();
  const [busca, setBusca] = useState('');
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [resultadoLote, setResultadoLote] = useState('');
  const [errosLote, setErrosLote] = useState<string[]>([]);
  const tipo = tipos.find(t=>t.valor===url.get('tipo'))?.valor ?? 'documentacao';
  const pagina = Math.max(0, Math.min(9999, Number(url.get('pagina') || '0') || 0));
  const pesquisa = (url.get('q') ?? '').slice(0,100);
  const query = useQuery({queryKey:['admin','fila',tipo,pagina,pesquisa],queryFn:()=>listarFilaAdministrativa(tipo,pagina,pesquisa),enabled:ehAdministrador(papel)});
  const lote = useMutation({mutationFn: async () => {
    if (!selecionados.length) return {ok:0, falhas:[] as string[]};
    if (!await confirmar(`Marcar ${selecionados.length} parâmetros como revisados? Esta ação altera o status de cada um e registra o histórico.`))
      return {ok:0,falhas:[] as string[]};
    let ok=0;
    const falhas:string[]=[];
    for(const id of selecionados) {
      try {
        const p=await obterParametro(id);
        if (!p) throw new Error('Parâmetro não encontrado');
        await salvarDocumentacao({
          id:p.id,versaoEsperada:p.versao,oQueFaz:p.oQueFaz,
          impacto:p.impacto,valorPadrao:p.valorPadrao,observacoes:p.observacoes,
          statusDocumentacao:'revisado',
        });
        ok++;
      } catch(e) {falhas.push(`${id}: ${e instanceof Error ? e.message : 'Erro de gravação'}`);}
    }
    return {ok,falhas};
  }, onSuccess: async r=>{
    setSelecionados([]);setResultadoLote(`${r.ok} parâmetro(s) revisado(s).`);
    setErrosLote(r.falhas);
    await Promise.all(['admin','parametros','parametro','historico'].map(k=>cache.invalidateQueries({queryKey:[k]})));
  }});
  if (carregando || papel===null) return <Carregando/>;
  if (!ehAdministrador(papel)) return <p className="erro">Acesso restrito. <Link to="/entrar">Entrar</Link></p>;
  const dados = query.data;
  const visiveis=dados?.itens.map(x=>x.id)??[];
  const todosSelecionados = visiveis.length>0 && visiveis.every(x=>selecionados.includes(x));
  function trocarTipo(t:TipoFila){setUrl({tipo:t});setSelecionados([]);setResultadoLote('');}
  function pesquisar(){setUrl({tipo,q:busca.trim()});setSelecionados([]);}
  return <section aria-labelledby="titulo-revisao">
    <Link to="/admin" className="text-sm">Voltar ao painel</Link>
    <div className="flex flex-wrap gap-3 justify-between items-center mt-5 mb-6">
      <div><h1 id="titulo-revisao">Fila de revisão</h1><p className="text-suave">Encontre pendências, revise capturas e atualize documentos.</p></div>
      <Link className="botao fantasma" to="/novo"><Plus size={17} aria-hidden/>Novo parâmetro</Link>
    </div>
    <div className="flex flex-wrap gap-2 mb-5" aria-label="Categoria de revisão">
      {tipos.map(t=><button key={t.valor} type="button" className={tipo===t.valor?'botao':'botao fantasma'} aria-pressed={tipo===t.valor} onClick={()=>trocarTipo(t.valor)}>
        {t.valor==='sem-imagem'||t.valor==='ocr'? <Image size={15} aria-hidden/>:<ListChecks size={15} aria-hidden/>}{t.nome}
      </button>)}
    </div>
    <form role="search" className="flex flex-wrap gap-2 mb-5" onSubmit={e=>{e.preventDefault();pesquisar();}}>
      <input aria-label="Buscar na fila" type="search" value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar parâmetro pelo nome" className="flex-1"/>
      <button className="botao fantasma" type="submit"><Search size={17} aria-hidden/>Buscar</button>
      {pesquisa && <button className="botao-icone" type="button" onClick={()=>{setBusca('');setUrl({tipo});}} aria-label="Limpar busca"><X size={17}/></button>}
    </form>
    {resultadoLote && <p role="status" className="mensagem-sucesso">{resultadoLote}</p>}
    {errosLote.length>0 && <div className="erro" role="alert"><strong>Itens não atualizados:</strong><ul>{errosLote.map(x=><li key={x}>{x}</li>)}</ul></div>}
    {lote.error && <p className="erro" role="alert">{lote.error.message}</p>}
    {query.error && <ErroCarregamento erro={query.error} aoTentarNovamente={()=>void query.refetch()}/>}
    {query.isPending ? <Carregando/> : dados && <>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-3 text-sm">
        <span className="text-suave">{dados.total} resultado(s) — página {pagina+1}</span>
        <button className="botao fantasma" type="button" disabled={lote.isPending||!selecionados.length}
          onClick={()=>lote.mutate()}><CheckSquare size={16} aria-hidden/>{lote.isPending?'Aplicando…':`Marcar revisados (${selecionados.length})`}</button>
      </div>
      <div className="border border-linha rounded-xl overflow-hidden">
        <div className="p-3 border-b border-linha bg-elevada">
          <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={todosSelecionados} onChange={e=>setSelecionados(e.target.checked?visiveis:[])} />Selecionar esta página (máximo de 25)</label>
        </div>
        {dados.itens.map(p=><div key={p.id} className="flex gap-3 p-4 border-b border-linha last:border-0 hover:bg-superficie">
          <input type="checkbox" aria-label={`Selecionar ${p.nome}`} checked={selecionados.includes(p.id)}
            onChange={e=>setSelecionados(atual=>e.target.checked?[...atual,p.id]:atual.filter(x=>x!==p.id))}/>
          <div className="min-w-0 flex-1">
            <Link className="font-semibold" to={`/parametro/${encodeURIComponent(p.id)}`}>{p.nome}</Link>
            <p className="text-xs text-suave break-words !mb-1">{p.caminho}</p>
            <span className="text-xs text-suave">{p.status_documentacao} · {p.imagem_personalizada_path?'Imagem manual':p.imagem_marcada?'Imagem OCR':'Sem imagem'}{p.editado_na_origem?' · Origem editada':''}</span>
          </div>
          <Link className="botao fantasma !text-xs" to={`/parametro/${encodeURIComponent(p.id)}`}>Revisar</Link>
        </div>)}
        {!dados.itens.length && <p className="p-6 text-suave">Nenhum parâmetro nesta categoria.</p>}
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <button className="botao fantasma" disabled={pagina===0} onClick={()=>{setUrl({tipo,pagina:String(pagina-1),q:pesquisa});setSelecionados([]);}}>Anterior</button>
        <button className="botao fantasma" disabled={(pagina+1)*25>=dados.total} onClick={()=>{setUrl({tipo,pagina:String(pagina+1),q:pesquisa});setSelecionados([]);}}>Próxima</button>
      </div>
    </>}
  </section>;
}
