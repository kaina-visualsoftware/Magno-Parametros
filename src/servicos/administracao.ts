/**
 * Leituras administrativas paginadas. Nenhuma permissão é concedida aqui:
 * Supabase RLS protege os dados, e a UI só as apresenta a administradores.
 */
import { obterClienteSupabase } from '../raiz-composicao';
import type { StatusDocumentacao } from '../dominio/entidades';

export interface ItemRevisao {
  id: string;
  nome: string;
  caminho: string;
  status_documentacao: StatusDocumentacao;
  imagem_marcada: boolean;
  imagem_personalizada_path: string | null;
  editado_na_origem: boolean;
  ativo: boolean;
  versao: number;
  o_que_faz: string | null;
}
export type TipoFila = 'documentacao' | 'sem-imagem' | 'ocr' | 'conflitos' | 'todos';
export interface PaginaAdministrativa { itens: ItemRevisao[]; total: number }

export async function contarPendencias(): Promise<{
  total: number; pendentes: number; semImagem: number; conflitos: number;
}> {
  const cliente = obterClienteSupabase();
  const [total, pendentes, semMarcacao, conflitos] = await Promise.all([
    cliente.from('parametros').select('id', { count: 'exact', head: true }).eq('ativo', true),
    cliente.from('parametros').select('id', { count: 'exact', head: true }).eq('ativo', true).eq('status_documentacao', 'pendente'),
    cliente.from('parametros').select('id', { count: 'exact', head: true }).eq('ativo', true).eq('imagem_marcada', false).is('imagem_personalizada_path', null),
    cliente.from('parametros').select('id', { count: 'exact', head: true }).eq('ativo', true).eq('editado_na_origem', true),
  ]);
  for (const r of [total, pendentes, semMarcacao, conflitos]) if (r.error) throw r.error;
  return { total: total.count ?? 0, pendentes: pendentes.count ?? 0,
    semImagem: semMarcacao.count ?? 0, conflitos: conflitos.count ?? 0 };
}

export async function listarFilaAdministrativa(tipo: TipoFila, pagina: number, busca = ''): Promise<PaginaAdministrativa> {
  const cliente = obterClienteSupabase();
  const tamanho = 25;
  let consulta = cliente.from('parametros')
    .select('id,nome,caminho,status_documentacao,imagem_marcada,imagem_personalizada_path,editado_na_origem,ativo,versao,o_que_faz',
      { count: 'exact' })
    .eq('ativo', true)
    .order('nome', { ascending: true })
    .order('id', { ascending: true });
  if (tipo === 'documentacao') consulta = consulta.eq('status_documentacao', 'pendente');
  if (tipo === 'sem-imagem') consulta = consulta.eq('imagem_marcada', false).is('imagem_personalizada_path', null);
  if (tipo === 'ocr') consulta = consulta.eq('imagem_marcada', true).is('imagem_personalizada_path', null);
  if (tipo === 'conflitos') consulta = consulta.eq('editado_na_origem', true);
  if (busca.trim()) consulta = consulta.ilike('nome', `%${busca.trim().replace(/[%,]/g, '')}%`);
  const { data, count, error } = await consulta.range(pagina * tamanho, pagina * tamanho + tamanho - 1);
  if (error) throw error;
  return { itens: (data ?? []) as ItemRevisao[], total: count ?? 0 };
}

import type { RelatorioImportacao } from '../aplicacao/caso-uso-importar';
export interface RegistroImportacao {
  id: number;
  criado_em: string;
  usuario_id: string;
  fonte: string;
  relatorio: RelatorioImportacao;
}
export async function registrarImportacao(relatorio: RelatorioImportacao): Promise<void> {
  if (relatorio.dryRun) return;
  const { error } = await obterClienteSupabase()
    .from('importacoes_registros')
    .insert({ fonte: relatorio.fonte.slice(0,200), relatorio });
  if (error) throw error;
}
export async function listarImportacoes(): Promise<RegistroImportacao[]> {
  const { data, error } = await obterClienteSupabase()
    .from('importacoes_registros')
    .select('id,criado_em,usuario_id,fonte,relatorio')
    .order('criado_em', { ascending:false })
    .limit(50);
  if (error) throw error;
  return (data??[]) as RegistroImportacao[];
}
