import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, ImageOff, Search, X } from 'lucide-react';
import { ehAdministrador, useAutenticacao } from '../aplicacao/autenticacao';
import { Carregando, ErroCarregamento } from '../componentes/Estado';
import { ImagemParametro } from '../componentes/ImagemParametro';
import { listarFilaAdministrativa, type TipoFila } from '../servicos/administracao';
import { obterParametro } from '../servicos/catalogo';
import { obterClienteSupabase } from '../raiz-composicao';

const categorias: { id: TipoFila; rotulo: string }[] = [
  { id:'sem-imagem', rotulo:'Sem imagem' },
  { id:'ocr', rotulo:'Recortes automáticos' },
  { id:'manual', rotulo:'Imagens corrigidas' },
  { id:'todos', rotulo:'Todos os parâmetros' },
];

export default function PaginaImagensAdmin() {
  const { usuario, papel, carregando } = useAutenticacao();
  const [params, setParams] = useSearchParams();
  const [textoBusca, setTextoBusca] = useState(params.get('q') ?? '');
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const cliente = useQueryClient();
  const tipo = categorias.find(c=>c.id===params.get('tipo'))?.id ?? 'sem-imagem';
  const pagina = Math.max(0, Math.min(9999, Number(params.get('pagina'))||0));
  const busca = params.get('q') ?? '';
  const fila = useQuery({
    queryKey:['admin','fila',tipo,pagina,busca],
    queryFn:()=>listarFilaAdministrativa(tipo,pagina,busca),enabled:ehAdministrador(papel),
  });
  const detalhe = useQuery({
    queryKey:['parametro',selecionado],queryFn:()=>obterParametro(selecionado!),
    enabled:ehAdministrador(papel)&&!!selecionado,
  });
  if (carregando || (usuario && papel===null)) return <Carregando/>;
  if (!ehAdministrador(papel)) return <p className="erro">Acesso restrito a administradores. <Link to="/entrar">Entrar</Link></p>;

  function filtros(novoTipo:TipoFila,t = busca, pg=0){
    setSelecionado(null);
    setParams({tipo:novoTipo,q:t,pagina:String(pg)});
  }
  function urlImagem(p:{id:string;imagem_marcada:boolean;imagem_personalizada_path:string|null}):string|null{
    if(p.imagem_personalizada_path) return obterClienteSupabase().storage.from('imagens-parametros').getPublicUrl(p.imagem_personalizada_path).data.publicUrl;
    if(p.imagem_marcada) return `${import.meta.env.BASE_URL}imagens-parametro/${encodeURIComponent(p.id)}.png`;
    return null;
  }
  return <section aria-labelledby="titulo-imagens-admin">
    <Link to="/admin" className="text-sm">Voltar ao painel</Link>
    <h1 className="mt-5" id="titulo-imagens-admin">Central de imagens</h1>
    <p className="text-suave">Encontre capturas ausentes ou incorretas e corrija a imagem diretamente, sem sair desta página.</p>
    <div className="flex flex-wrap gap-2 mb-5">
      {categorias.map(c=><button key={c.id} type="button" className={tipo===c.id?'botao':'botao fantasma'} aria-pressed={tipo===c.id} onClick={()=>filtros(c.id)}>{c.rotulo}</button>)}
    </div>
    <form role="search" className="flex gap-2 mb-6" onSubmit={e=>{e.preventDefault();filtros(tipo,textoBusca.trim().slice(0,100));}}>
      <input aria-label="Buscar imagem por parâmetro" type="search" className="flex-1" value={textoBusca} onChange={e=>setTextoBusca(e.target.value)} placeholder="Buscar por nome do parâmetro"/>
      <button className="botao fantasma" type="submit"><Search size={18} aria-hidden/>Buscar</button>
    </form>
    {fila.error && <ErroCarregamento erro={fila.error} aoTentarNovamente={()=>void fila.refetch()}/>}
    {fila.isPending ? <Carregando/> : fila.data && <>
      <p className="text-sm text-suave mb-4">{fila.data.total} parâmetro(s) nesta categoria</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {fila.data.itens.map(p=>{
          const src=urlImagem(p);
          return <article key={p.id} className="cartao !mb-0 !p-3 flex flex-col gap-3">
            <div className="h-40 border border-linha bg-elevada rounded-lg overflow-hidden flex items-center justify-center">
              {src ? <img className="w-full h-full object-contain" loading="lazy" src={src} alt={`Imagem do parâmetro ${p.nome}`}/> :
                <div className="text-suave flex flex-col items-center gap-2"><ImageOff size={32} aria-hidden/>Sem imagem</div>}
            </div>
            <div className="flex-1 min-w-0"><strong className="block break-words">{p.nome}</strong>
              <p className="text-xs text-suave line-clamp-2 break-words">{p.caminho}</p></div>
            <button type="button" className="botao fantasma" onClick={()=>setSelecionado(p.id)}>
              <ImagePlus size={16} aria-hidden/>{src?'Corrigir imagem':'Adicionar imagem'}
            </button>
          </article>;
        })}
      </div>
      {!fila.data.itens.length && <p className="vazio">Nenhum parâmetro encontrado.</p>}
      <div className="flex justify-end gap-2 mt-6">
        <button className="botao fantasma" disabled={pagina===0} onClick={()=>filtros(tipo,busca,pagina-1)}>Anterior</button>
        <button className="botao fantasma" disabled={(pagina+1)*25>=fila.data.total} onClick={()=>filtros(tipo,busca,pagina+1)}>Próxima</button>
      </div>
    </>}
    {selecionado && <div className="fixed inset-0 z-50 bg-black/70 overflow-y-auto p-3 md:p-8" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setSelecionado(null);}}>
      <section role="dialog" aria-modal="true" aria-labelledby="titulo-editar-imagem" className="relative max-w-3xl mx-auto p-5 rounded-xl bg-fundo border border-linha">
        <div className="flex justify-between items-center mb-4 gap-3">
          <h2 id="titulo-editar-imagem" className="!mb-0">Corrigir imagem</h2>
          <button className="botao-icone" type="button" aria-label="Fechar editor de imagem" onClick={()=>{setSelecionado(null);void cliente.invalidateQueries({queryKey:['admin','fila']});}}><X size={20}/></button>
        </div>
        {detalhe.isPending ? <Carregando/> : detalhe.error ? <ErroCarregamento erro={detalhe.error}/> : detalhe.data ? <>
          <p className="text-sm text-suave">{detalhe.data.nome}</p>
          <ImagemParametro key={`${detalhe.data.id}-${detalhe.data.imagemPersonalizadaPath ?? 'original'}`} parametro={detalhe.data} admin={true}/>
          <Link to={`/parametro/${encodeURIComponent(detalhe.data.id)}`}>Abrir detalhes do parâmetro</Link>
        </> : <p className="erro">Parâmetro não encontrado.</p>}
      </section>
    </div>}
  </section>;
}
