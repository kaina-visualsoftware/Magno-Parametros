import type { Parametro, StatusDocumentacao, OrigemItem } from './entidades';

export type ResumoParametro = Pick<Parametro, 'id' | 'nome' | 'tipo' | 'grupo' | 'caminho' | 'statusDocumentacao' | 'origem' | 'ativo'>;
export interface CursorCatalogo { v: number; f: string; id: string; valor: string | number }
export interface PaginaCursor { itens: ResumoParametro[]; proximoCursor: CursorCatalogo | null }
export interface FiltrosCatalogo {
  termo?: string;
  tipo?: string;
  status?: StatusDocumentacao;
  origem?: OrigemItem;
  ativo: boolean | null;
  aba?: string;
  tags: string[];
  operador: 'E' | 'OU';
  semTag: boolean;
  ordem: 'nome' | 'grupo' | 'caminho' | 'ordem';
  direcao: 'asc' | 'desc';
}
export function lerFiltros(url: URLSearchParams): FiltrosCatalogo {
  const status = url.get('status');
  const origem = url.get('origem');
  const ordem = url.get('ordem');
  const semTag = url.get('semTag') === '1';
  return {
    termo: (url.get('q') ?? url.get('termo') ?? '').trim().slice(0, 200) || undefined,
    tipo: url.get('tipo')?.slice(0, 100) || undefined,
    status: ['pendente','documentado','revisado'].includes(status ?? '') ? status as StatusDocumentacao : undefined,
    origem: ['manual','importado'].includes(origem ?? '') ? origem as OrigemItem : undefined,
    ativo: url.get('ativo') === 'todos' ? null : url.get('ativo') !== 'false',
    aba: url.get('aba')?.slice(0, 500) || undefined,
    tags: semTag ? [] : [...new Set(url.getAll('tag')
      .filter(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
      .map(id => id.toLowerCase()))].sort().slice(0, 50),
    operador: url.get('op') === 'E' ? 'E' : 'OU', semTag,
    ordem: ['nome','grupo','caminho','ordem'].includes(ordem ?? '') ? ordem as FiltrosCatalogo['ordem'] : 'nome',
    direcao: url.get('direcao') === 'desc' ? 'desc' : 'asc',
  };
}
export function escreverFiltros(f: FiltrosCatalogo): URLSearchParams {
  const url = new URLSearchParams();
  if (f.termo) url.set('q', f.termo);
  for (const campo of ['tipo','status','origem','aba'] as const) if (f[campo]) url.set(campo, f[campo]!);
  if (f.ativo !== true) url.set('ativo', f.ativo === null ? 'todos' : 'false');
  if (f.semTag) url.set('semTag','1');
  else [...new Set(f.tags)].sort().forEach(tag => url.append('tag', tag));
  if (f.operador === 'E') url.set('op','E');
  if (f.ordem !== 'nome') url.set('ordem', f.ordem);
  if (f.direcao !== 'asc') url.set('direcao', f.direcao);
  return url;
}
