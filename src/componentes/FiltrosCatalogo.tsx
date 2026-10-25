import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listarTags, listarTipos } from '../servicos/catalogo';
import { FiltrosCatalogo as Filtros } from '../dominio/catalogo';
import { Dialogo } from './Dialogo';
import { ErroCarregamento } from './Estado';

export function FiltrosCatalogo({ filtros, aplicar, fechar, tagFixa }: {
  filtros: Filtros; aplicar(f: Filtros): void; fechar(): void; tagFixa?: string;
}) {
  const [rascunho, setRascunho] = useState(filtros);
  const tipos = useQuery({ queryKey: ['tipos'], queryFn: listarTipos, staleTime: 600_000 });
  const tags = useQuery({ queryKey: ['tags'], queryFn: listarTags, staleTime: 300_000 });
  function mudar<K extends keyof Filtros>(chave: K, valor: Filtros[K]) { setRascunho(f => ({ ...f, [chave]: valor })); }
  return <Dialogo titulo="Filtrar parâmetros" fechar={fechar}>
    <form onSubmit={e => { e.preventDefault(); aplicar(rascunho); fechar(); }}>
      <p className="dica">Combine critérios para encontrar a configuração certa.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <label className="campo"><span>Tipo</span><select value={rascunho.tipo ?? ''} onChange={e => mudar('tipo', e.target.value || undefined)}>
          <option value="">Todos os tipos</option>{(tipos.data ?? []).map(t => <option key={t.codigo}>{t.codigo}</option>)}
        </select></label>
        <label className="campo"><span>Documentação</span><select value={rascunho.status ?? ''} onChange={e => mudar('status', e.target.value as Filtros['status'] || undefined)}>
          <option value="">Todos os status</option><option value="pendente">Pendente</option><option value="documentado">Documentado</option><option value="revisado">Revisado</option>
        </select></label>
        <label className="campo"><span>Origem</span><select value={rascunho.origem ?? ''} onChange={e => mudar('origem', e.target.value as Filtros['origem'] || undefined)}>
          <option value="">Todas</option><option value="manual">Manual</option><option value="importado">Importado</option>
        </select></label>
        <label className="campo"><span>Situação</span><select value={String(rascunho.ativo)} onChange={e => mudar('ativo', e.target.value === 'null' ? null : e.target.value === 'true')}>
          <option value="true">Ativos</option><option value="false">Inativos</option><option value="null">Todos</option>
        </select></label>
      </div>
      {tipos.isLoading && <p role="status" className="dica">Carregando tipos…</p>}
      {tipos.error && <ErroCarregamento erro={tipos.error} aoTentarNovamente={() => void tipos.refetch()} />}
      <fieldset className="border-t border-linha pt-4 mb-5"><legend className="font-semibold pr-3">Tags</legend>
        {!tagFixa && <label className="alternancia mb-3"><input type="checkbox" checked={rascunho.semTag} onChange={e => setRascunho(f => ({ ...f, semTag: e.target.checked, tags: [] }))} />Somente parâmetros sem tag</label>}
        {tags.isLoading && <p role="status" className="dica">Carregando tags…</p>}
        {tags.error && <ErroCarregamento erro={tags.error} aoTentarNovamente={() => void tags.refetch()} />}
        {!rascunho.semTag && <>
          <div className="max-h-48 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1 mb-3">
            {(tags.data ?? []).map(t => <label className="alternancia" key={t.id}><input type="checkbox" disabled={t.id === tagFixa}
              checked={rascunho.tags.includes(t.id)} onChange={e => mudar('tags', e.target.checked ? [...rascunho.tags,t.id] : rascunho.tags.filter(id => id !== t.id))} />{t.nome}</label>)}
            {tags.data?.length === 0 && <p className="dica">Nenhuma tag cadastrada.</p>}
          </div>
          <label className="campo"><span>Combinação de tags</span><select value={rascunho.operador} onChange={e => mudar('operador', e.target.value as Filtros['operador'])}>
            <option value="OU">Qualquer uma das tags</option><option value="E">Todas as tags</option>
          </select></label>
        </>}
      </fieldset>
      <div className="sticky bottom-0 bg-superficie flex gap-3 justify-end border-t border-linha pt-4 pb-1"><button type="button" className="botao fantasma" onClick={fechar}>Cancelar</button><button type="submit" className="botao">Aplicar filtros</button></div>
    </form>
  </Dialogo>;
}
