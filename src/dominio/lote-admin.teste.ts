import { describe,expect,it } from 'vitest';
import { planejarLoteStatus, relatorioLoteCsv } from './lote-admin';

describe('planejamento de lote administrativo',()=>{
  it('ignora estado igual e IDs duplicados',()=>{
    const p=planejarLoteStatus([
      {id:'a',nome:'A',statusDocumentacao:'revisado',versao:1},
      {id:'b',nome:'B',statusDocumentacao:'pendente',versao:2},
      {id:'b',nome:'B',statusDocumentacao:'pendente',versao:2},
    ],'revisado');
    expect(p.alterar.map(x=>x.id)).toEqual(['b']);
    expect(p.ignorar.map(x=>x.id)).toEqual(['a']);
  });
  it('exporta mensagens com aspas sem quebrar CSV',()=>{
    const csv=relatorioLoteCsv([{id:'a',acao:'status',resultado:'falha',mensagem:'Erro "conflito"'}]);
    expect(csv).toContain('"Erro ""conflito"""');
  });
});
