import { useEffect, useMemo, useRef, useState } from 'react';
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, ArrowDownToLine, ChevronRight, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { listarCatalogo, listarTags, baixarArquivo } from '../servicos/catalogo';
import { type CursorCatalogo, type FiltrosCatalogo as Filtros, escreverFiltros, lerFiltros } from '../dominio/catalogo';
import { FiltrosCatalogo } from '../componentes/FiltrosCatalogo';
import { ErroCarregamento, SkeletonLinhas } from '../componentes/Estado';
import { StatusParametro } from '../componentes/StatusParametro';
import { CopiarCaminho } from '../componentes/CopiarCaminho';
import { useAutenticacao } from '../aplicacao/autenticacao';

export default function PaginaCatalogo({ tagFixa, titulo }: { tagFixa?: string; titulo?: string }) {
  const [url, setUrl] = useSearchParams();
  const local = useLocation();
  const { papel } = useAutenticacao();
  const filtros = useMemo(() => {
    const f = lerFiltros(url);
    return tagFixa ? { ...f, tags: [...new Set([...f.tags, tagFixa.toLowerCase()])].sort(), semTag: false } : f;
  }, [url, tagFixa]);
  const [termo, setTermo] = useState(filtros.termo ?? '');
  const [menu, setMenu] = useState(false);
  const busca = useRef<HTMLInputElement>(null);
  const urlRef = useRef(url);
  urlRef.current = url;
  useEffect(() => { setTermo(filtros.termo ?? ''); }, [filtros.termo]);
  useEffect(() => {
    if (termo === (filtros.termo ?? '')) return;
    const timer = setTimeout(() => {
      const f = lerFiltros(urlRef.current);
      setUrl(escreverFiltros({ ...f, termo: termo.trim().slice(0,200) || undefined }), { replace: true });
    }, 300);
    return () => clearTimeout(timer);
  }, [termo, filtros.termo, setUrl]);
  useEffect(() => {
    const atalho = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement;
      if (alvo.closest('dialog[open]')) return;
      if ((e.key === '/' && !alvo.closest('input,textarea,select,[contenteditable]')) || ((e.ctrlKey || e.metaKey) && e.key === 'k')) {
        e.preventDefault(); busca.current?.focus();
      }
    };
    window.addEventListener('keydown', atalho);
    return () => window.removeEventListener('keydown', atalho);
  }, []);
  const consulta = useInfiniteQuery({
    queryKey: ['parametros', 'cursor', filtros],
    initialPageParam: null as CursorCatalogo | null,
    queryFn: ({ pageParam, signal }) => listarCatalogo(filtros, pageParam, signal),
    getNextPageParam: pagina => pagina.proximoCursor ?? undefined,
    placeholderData: keepPreviousData,
  });
  const itens = [...new Map((consulta.data?.pages.flatMap(p => p.itens) ?? []).map(p => [p.id,p])).values()];
  const atualizando = consulta.isPlaceholderData || (consulta.isFetching && !consulta.isFetchingNextPage && !consulta.isPending);
  const nomesTags = useQuery({ queryKey: ['tags'], queryFn: listarTags, enabled: filtros.tags.length > 0, staleTime: 300_000 });
  const mapaTags = new Map((nomesTags.data ?? []).map(tag => [tag.id, tag.nome]));
  function aplicar(f: Filtros) { setUrl(escreverFiltros(f)); }
  const chips: Array<{ chave: string; nome: string; remover(): void }> = [];
  const rotulosStatus = { pendente: 'Pendente', documentado: 'Documentado', revisado: 'Revisado' } as const;
  const rotulosOrigem = { manual: 'Manual', importado: 'Importado' } as const;
  for (const campo of ['tipo', 'origem', 'aba'] as const) {
    const rotulo = campo === 'aba' ? 'Aba' : campo === 'origem' ? 'Origem' : 'Tipo';
    const valor = campo === 'origem' && filtros.origem ? rotulosOrigem[filtros.origem] : filtros[campo];
    if (valor) chips.push({ chave: campo, nome: `${rotulo}: ${valor}`, remover: () => aplicar({ ...filtros, [campo]: undefined }) });
  }
  if (filtros.status) chips.push({ chave: 'status', nome: `Status: ${rotulosStatus[filtros.status]}`, remover: () => aplicar({ ...filtros, status: undefined }) });
  if (filtros.semTag) chips.push({ chave: 'semTag', nome: 'Sem tag', remover: () => aplicar({ ...filtros, semTag: false }) });
  if (filtros.ativo !== true) chips.push({ chave: 'ativo', nome: filtros.ativo === null ? 'Incluindo inativos' : 'Somente inativos', remover: () => aplicar({ ...filtros, ativo: true }) });
  filtros.tags.filter(id => id !== tagFixa).forEach(id => {
    const nomeTag = mapaTags.get(id) ?? (nomesTags.error ? id.slice(0, 8) : 'carregando…');
    chips.push({ chave: `tag:${id}`, nome: `Tag: ${nomeTag}`, remover: () => aplicar({ ...filtros, tags: filtros.tags.filter(t => t !== id) }) });
  });
  function limpar() { setTermo(''); setUrl(new URLSearchParams()); }
  return <section aria-labelledby="titulo-catalogo">
    <div className="flex flex-wrap items-start justify-between gap-4 mb-8 md:mb-10">
      <div><h1 id="titulo-catalogo" className="!mb-3">{titulo ?? 'Cada configuração, no seu lugar.'}</h1>
        <p className="text-suave max-w-2xl !mb-0">Explore os parâmetros do MyCommerce. Encontre o caminho, entenda o impacto e consulte a documentação.</p></div>
      {papel === 'administrador' && <Link className="botao fantasma" to="/novo"><Plus size={17} aria-hidden />Novo parâmetro</Link>}
    </div>
    <form role="search" className="flex flex-wrap sm:flex-nowrap gap-3" onSubmit={e => { e.preventDefault(); aplicar({ ...filtros, termo: termo.trim() || undefined }); }}>
      <label className="relative flex-1 min-w-0 basis-full sm:basis-auto"><span className="sr-only">Buscar parâmetros</span>
        <Search size={20} aria-hidden className="absolute left-4 top-4 text-suave" />
        <input ref={busca} type="search" maxLength={200} value={termo} onChange={e => setTermo(e.target.value)}
          placeholder="Buscar parâmetros" className="w-full !pl-12 !py-3.5 !bg-superficie !text-base" />
      </label>
      <button type="button" className="botao fantasma" aria-haspopup="dialog" aria-expanded={menu} onClick={() => setMenu(true)}><SlidersHorizontal size={18} aria-hidden />Filtros{chips.length > 0 && <span className="bg-elevada rounded px-1.5 tabular-nums">{chips.length}</span>}</button>
      {(chips.length > 0 || termo) && <button type="button" className="botao-icone text-sm" onClick={limpar}>Limpar</button>}
    </form>
    {menu && <FiltrosCatalogo filtros={filtros} tagFixa={tagFixa} aplicar={aplicar} fechar={() => setMenu(false)} />}
    {chips.length > 0 && <div className="flex flex-wrap gap-2 mt-3" aria-label="Filtros ativos">{chips.map(c => <button type="button" key={c.chave} className="chip !pr-2 min-h-11" onClick={c.remover}>{c.nome}<X size={15} aria-label="Remover filtro" /></button>)}</div>}
    <div className="flex flex-wrap justify-between items-center gap-3 mt-7 mb-2 text-sm text-suave">
      <span role="status" aria-live="polite">{atualizando ? 'Atualizando resultados…' : consulta.isPending ? 'Preparando catálogo…' : `${itens.length} parâmetros carregados`}</span>
      <div className="flex items-center gap-1"><label className="flex items-center gap-2"><span className="sr-only sm:not-sr-only">Ordenar por</span><select aria-label="Ordenar por" value={filtros.ordem} className="!border-transparent !bg-transparent !text-sm" onChange={e => aplicar({ ...filtros, ordem: e.target.value as Filtros['ordem'] })}>
        <option value="nome">Nome</option><option value="grupo">Grupo</option><option value="caminho">Caminho</option><option value="ordem">Ordem no ERP</option>
      </select></label><button type="button" className="botao-icone" aria-label={filtros.direcao === 'asc' ? 'Ordenar decrescente' : 'Ordenar crescente'} onClick={() => aplicar({ ...filtros, direcao: filtros.direcao === 'asc' ? 'desc' : 'asc' })}>{filtros.direcao === 'asc' ? <ArrowDown size={16} aria-hidden /> : <ArrowUp size={16} aria-hidden />}</button></div>
    </div>
    {consulta.error && <ErroCarregamento erro={consulta.error} aoTentarNovamente={() => void (consulta.isFetchNextPageError ? consulta.fetchNextPage() : consulta.refetch())} />}
    {consulta.isPending ? <SkeletonLinhas /> : <div aria-busy={atualizando} className={atualizando ? 'opacity-60' : ''}>
      <ul className="border-t border-linha" aria-label="Parâmetros">
        {itens.map(p => <li key={p.id} className="group relative grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1fr)_160px_140px_auto] items-center gap-x-4 py-5 px-1 sm:px-4 border-b border-linha hover:bg-superficie">
          <div className="min-w-0"><Link to={`/parametro/${encodeURIComponent(p.id)}`} state={{ voltar: `${local.pathname}${local.search}` }} className="font-semibold text-[15px] !text-tinta hover:!text-acento after:absolute after:inset-0 focus-visible:after:outline-2 focus-visible:after:outline-acento">
            {p.nome}</Link>
            <p className="text-xs font-mono text-suave mt-1.5 !mb-0 break-words line-clamp-2" title={p.caminho}>{p.caminho}</p>
            <span className="text-xs text-suave md:hidden block mt-2">{p.tipo} / {p.grupo || 'Sem grupo'}</span>
          </div>
          <div className="hidden md:block min-w-0 text-xs text-suave break-words"><span className="block text-tinta mb-1">{p.grupo || 'Sem grupo'}</span>{p.tipo}</div>
          <div className="col-start-1 md:col-start-auto mt-2 md:mt-0"><StatusParametro status={p.statusDocumentacao} />{!p.ativo && <span className="block text-xs text-suave">Inativo</span>}</div>
          <div className="row-start-1 col-start-2 md:col-start-4 flex items-center gap-1 relative z-10">
            <span className="hidden lg:inline-flex"><CopiarCaminho caminho={p.caminho} /></span><ChevronRight size={17} aria-hidden className="text-suave" />
          </div>
        </li>)}
      </ul>
      {!itens.length && !consulta.error && <div className="text-center py-16"><Search size={28} className="mx-auto text-suave mb-4" aria-hidden /><h2>Nenhum parâmetro encontrado</h2><p className="text-suave">Tente outro termo ou remova alguns filtros.</p><button type="button" className="botao fantasma" onClick={limpar}>Limpar filtros</button></div>}
    </div>}
    {itens.length > 0 && <div className="flex flex-col items-center gap-3 py-8">
      {consulta.hasNextPage ? <button type="button" className="botao fantasma" disabled={consulta.isFetching || consulta.isPlaceholderData} onClick={() => void consulta.fetchNextPage()}>{consulta.isFetchingNextPage ? 'Carregando…' : 'Carregar mais 50'}</button> : !consulta.error && <p className="text-xs text-suave">Você chegou ao fim da lista.</p>}
      {tagFixa && <button className="botao-icone text-xs" type="button" disabled={atualizando} onClick={() => baixarArquivo('parametros-carregados.json', JSON.stringify(itens,null,2), 'application/json')}><ArrowDownToLine size={16} aria-hidden />Exportar {itens.length} itens carregados</button>}
    </div>}
  </section>;
}
