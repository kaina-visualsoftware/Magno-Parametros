import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckSquare, Image, ListChecks, Plus, Search, X } from 'lucide-react';
import { ehAdministrador, useAutenticacao } from '../aplicacao/autenticacao';
import { useDialogos } from '../componentes/Dialogo';
import { Carregando, ErroCarregamento } from '../componentes/Estado';
import { listarFilaAdministrativa, type TipoFila } from '../servicos/administracao';
import { obterParametro, obterTagsParametro, salvarDocumentacao, listarTags, aplicarTag, baixarArquivo } from '../servicos/catalogo';
import { planejarLoteStatus, relatorioLoteCsv } from '../dominio/lote-admin';
import type { StatusDocumentacao } from '../dominio/entidades';

const tipos: {valor: TipoFila; nome: string}[] = [
  {valor:'documentacao',nome:'Documentação pendente'},
  {valor:'sem-imagem',nome:'Sem imagem'},
  {valor:'ocr',nome:'Imagens automáticas'},
  {valor:'conflitos',nome:'Origem editada'},
  {valor:'todos',nome:'Todos'},
];
export default function PaginaRevisao() {
  const { usuario, papel, carregando } = useAutenticacao();
  const { confirmar } = useDialogos();
  const cache = useQueryClient();
  const [url, setUrl] = useSearchParams();
  const [busca, setBusca] = useState('');
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [resultadoLote, setResultadoLote] = useState('');
  const [errosLote, setErrosLote] = useState<string[]>([]);
  const [ultimoLote, setUltimoLote] = useState<Array<{id:string;acao:string;resultado:'sucesso'|'ignorado'|'falha';mensagem:string}>>([]);
  const [acaoLote, setAcaoLote] = useState<'status'|'tag'>('status');
  const [statusAlvo, setStatusAlvo] = useState<StatusDocumentacao>('revisado');
  const [tagAlvo, setTagAlvo] = useState('');
  const consultaTags = useQuery({queryKey:['tags'],queryFn:listarTags,enabled:ehAdministrador(papel)});
  const tipo = tipos.find(t=>t.valor===url.get('tipo'))?.valor ?? 'documentacao';
  const pagina = Math.max(0, Math.min(9999, Number(url.get('pagina') || '0') || 0));
  const pesquisa = (url.get('q') ?? '').slice(0,100);
  const query = useQuery({queryKey:['admin','fila',tipo,pagina,pesquisa],queryFn:()=>listarFilaAdministrativa(tipo,pagina,pesquisa),enabled:ehAdministrador(papel)});
  const lote = useMutation({mutationFn: async () => {
    const ids=[...new Set(selecionados)].slice(0,25);
    if (!ids.length) return [] as Array<{id:string;acao:string;resultado:'sucesso'|'ignorado'|'falha';mensagem:string}>;
    if (acaoLote==='tag' && !tagAlvo) throw new Error('Escolha uma tag antes de aplicar.');
    const registro: Array<{id:string;acao:string;resultado:'sucesso'|'ignorado'|'falha';mensagem:string}>=[];
    const validos: Array<NonNullable<Awaited<ReturnType<typeof obterParametro>>>> = [];
    for(const id of ids) {
      try {
        const p=await obterParametro(id);
        if (!p || !p.ativo) throw new Error('Parâmetro não encontrado ou inativo');
        validos.push(p);
      } catch(e) {
        registro.push({id,acao:acaoLote,resultado:'falha',mensagem:e instanceof Error?e.message:String(e)});
      }
    }
    const planejamento=acaoLote==='status' ? planejarLoteStatus(validos.map(p=>({
      id:p.id,nome:p.nome,statusDocumentacao:p.statusDocumentacao,versao:p.versao,
    })),statusAlvo) : null;
    const ignorados=new Set(planejamento?.ignorar.map(p=>p.id)??[]);
    if(acaoLote==='tag') {
      for(const p of validos) {
        try {
          const tags=await obterTagsParametro(p.id);
          if(tags.some(t=>t.id===tagAlvo)) ignorados.add(p.id);
        } catch(e) {
          registro.push({id:p.id,acao:acaoLote,resultado:'falha',mensagem:e instanceof Error?e.message:'Falha ao consultar tags'});
          ignorados.add(p.id);
        }
      }
    }
    const executar=validos.filter(p=>!ignorados.has(p.id));
    const mensagem=acaoLote==='status'
      ? `Alterar o status de ${executar.length} parâmetro(s) para "${statusAlvo}"? ${ignorados.size} já estão nesse status e serão ignorados. ${registro.length} falharam na verificação inicial.`
      : `Adicionar a tag selecionada a ${executar.length} parâmetro(s)? ${registro.length} falharam na verificação inicial.`;
    if(!await confirmar(`${mensagem} A operação é sequencial e não pode ser desfeita em bloco.`)) return [];
    for(const id of ignorados) {
      if(!registro.some(x=>x.id===id)) registro.push({id,acao:acaoLote,resultado:'ignorado',mensagem:acaoLote==='tag'?'Tag já aplicada':'Já está no status escolhido'});
    }
    for(const p of executar){
      try {
        if(acaoLote==='tag') await aplicarTag(p.id,tagAlvo);
        else await salvarDocumentacao({
          id:p.id,versaoEsperada:p.versao,oQueFaz:p.oQueFaz,impacto:p.impacto,
          valorPadrao:p.valorPadrao,observacoes:p.observacoes,statusDocumentacao:statusAlvo,
        });
        registro.push({id:p.id,acao:acaoLote,resultado:'sucesso',mensagem:'Atualizado'});
      } catch(e){
        registro.push({id:p.id,acao:acaoLote,resultado:'falha',mensagem:e instanceof Error?e.message:String(e)});
      }
    }
    return registro;
  }, onSuccess: async resultados=>{
    if(!resultados.length) return;
    setUltimoLote(resultados);
    setSelecionados([]);
    const ok=resultados.filter(x=>x.resultado==='sucesso').length;
    const ignorados=resultados.filter(x=>x.resultado==='ignorado').length;
    setResultadoLote(`${ok} atualizados, ${ignorados} ignorados e ${resultados.filter(x=>x.resultado==='falha').length} falhas.`);
    setErrosLote(resultados.filter(x=>x.resultado==='falha').map(x=>`${x.id}: ${x.mensagem}`));
    await Promise.all(['admin','parametros','parametro','historico','tags'].map(k=>cache.invalidateQueries({queryKey:[k]})));
  }});
  if (carregando || (usuario && papel===null)) return <Carregando/>;
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
    {ultimoLote.length>0 && <button type="button" className="botao fantasma mb-4"
      onClick={()=>baixarArquivo('resultado-lote.csv',relatorioLoteCsv(ultimoLote),'text/csv;charset=utf-8')}>Baixar resultado do lote (CSV)</button>
    {errosLote.length>0 && <div className="erro" role="alert"><strong>Itens não atualizados:</strong><ul>{errosLote.map(x=><li key={x}>{x}</li>)}</ul></div>}
    {lote.error && <p className="erro" role="alert">{lote.error.message}</p>}
    {query.error && <ErroCarregamento erro={query.error} aoTentarNovamente={()=>void query.refetch()}/>}
    {query.isPending ? <Carregando/> : dados && <>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-3 text-sm">
        <span className="text-suave">{dados.total} resultado(s) — página {pagina+1}</span>
        <div className="flex flex-wrap gap-2 items-center">
          <select aria-label="Ação em lote" value={acaoLote} onChange={e=>setAcaoLote(e.target.value as 'status'|'tag')}>
            <option value="status">Alterar status</option><option value="tag">Adicionar tag</option>
          </select>
          {acaoLote==='status' ?
            <select aria-label="Status desejado" value={statusAlvo} onChange={e=>setStatusAlvo(e.target.value as StatusDocumentacao)}>
              <option value="pendente">Pendente</option><option value="documentado">Documentado</option><option value="revisado">Revisado</option>
            </select> :
            <select aria-label="Tag desejada" value={tagAlvo} onChange={e=>setTagAlvo(e.target.value)}>
              <option value="">Escolha uma tag</option>{(consultaTags.data??[]).map(tag=><option key={tag.id} value={tag.id}>{tag.nome}</option>)}
            </select>}
          <button className="botao fantasma" type="button" disabled={lote.isPending||!selecionados.length||(acaoLote==='tag'&&!tagAlvo)}
            onClick={()=>lote.mutate()}><CheckSquare size={16} aria-hidden/>{lote.isPending?'Aplicando…':`Aplicar (${selecionados.length})`}</button>
        </div>
      </div>
      <div className="border border-linha rounded-xl overflow-hidden">
        <div className="p-3 border-b border-linha bg-elevada">
          <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={todosSelecionados} onChange={e=>setSelecionados(e.target.checked?visiveis:[])} />Selecionar esta página (máximo de 25)</label>
        </div>
        {dados.itens.map(p=><div key={p.id} className="flex gap-3 p-4 border-b border-linha last:border-0 hover:bg-superficie">
          <input type="checkbox" aria-label={`Selecionar ${p.nome}`} checked={selecionados.includes(p.id)}
            onChange={e=>setSelecionados(atual=>e.target.checked?[...atual,p.id]:atual.filter(x=>x!==p.id))}/>
          {tipo==='ocr' && <div className="w-24 h-16 sm:w-32 sm:h-20 border border-linha rounded-lg bg-elevada overflow-hidden shrink-0">
            <img className="w-full h-full object-contain" loading="lazy" alt={`Recorte importado do parâmetro ${p.nome}`}
              src={`${import.meta.env.BASE_URL}imagens-parametro/${encodeURIComponent(p.id)}.png`}/>
          </div>}
          {tipo==='sem-imagem' && <div className="hidden sm:flex w-20 h-16 border border-linha rounded-lg bg-elevada items-center justify-center shrink-0">
            <Image size={22} aria-label="Sem imagem" className="text-suave"/>
          </div>}
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
