import type { StatusDocumentacao } from './entidades';

export interface ItemLote {
  id: string;
  nome: string;
  statusDocumentacao: StatusDocumentacao;
  versao: number;
}
export function planejarLoteStatus(itens: ItemLote[], alvo: StatusDocumentacao) {
  const vistos=new Set<string>();
  const unicos=itens.filter(x=>{
    if(vistos.has(x.id)) return false;
    vistos.add(x.id);return true;
  });
  return {
    alterar:unicos.filter(p=>p.statusDocumentacao!==alvo),
    ignorar:unicos.filter(p=>p.statusDocumentacao===alvo),
  };
}
export function relatorioLoteCsv(resultados: Array<{id:string;acao:string;resultado:'sucesso'|'ignorado'|'falha';mensagem:string}>): string {
  const linhas=[['ID','Ação','Resultado','Mensagem'],...resultados.map(x=>[x.id,x.acao,x.resultado,x.mensagem])];
  return '\uFEFF'+linhas.map(l=>l.map(v=>`"${(/^\s*[=+@-]/.test(v) ? "'"+v : v).replaceAll('"','""')}"`).join(';')).join('\r\n');
}
