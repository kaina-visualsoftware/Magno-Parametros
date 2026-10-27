import { describe, expect, it } from 'vitest';
import { encontrarCorrespondencia, gerarConsultaLeitura, type BaseCorrespondenciasBanco } from './correspondencia-banco';

const base: BaseCorrespondenciasBanco = {
  meta: { tabela:'config', total:950 },
  mapeamentos: {
    teste_com_coluna: { colunas:['AlertaParcelas','AlertaParcQtde'], confianca:'alta', observacao:'Flag e quantidade' },
    teste_media: { colunas:['ChaveMedia'], confianca:'media' },
  },
  semColuna:['teste_sem_coluna'],
  colunasCompartilhadas:['AlertaParcelas'],
};
describe('correspondência de banco do catálogo',()=>{
  it('exibe todas as colunas do parâmetro e sinaliza compartilhamento',()=>{
    expect(encontrarCorrespondencia(base,'teste_com_coluna')).toEqual({
      estado:'mapeado',tabela:'config',
      correspondencia:base.mapeamentos.teste_com_coluna,
      compartilhadas:['AlertaParcelas'],
    });
  });
  it('preserva níveis de confiança sem extrapolar certeza',()=>{
    const r=encontrarCorrespondencia(base,'teste_media');
    expect(r.estado).toBe('mapeado');
    if(r.estado==='mapeado') expect(r.correspondencia.confianca).toBe('media');
  });
  it('distingue ausência de coluna de parâmetro que não consta na origem',()=>{
    expect(encontrarCorrespondencia(base,'teste_sem_coluna').estado).toBe('sem-coluna');
    expect(encontrarCorrespondencia(base,'parametro_manual').estado).toBe('nao-listado');
  });
  it('gera apenas consulta SELECT e valida identificadores',()=>{
    expect(gerarConsultaLeitura('config',['DiasJuro','TaxaMulta']))
      .toBe('SELECT `DiasJuro`, `TaxaMulta` FROM `config` LIMIT 10;');
    expect(()=>gerarConsultaLeitura('config;DROP', ['DiasJuro'])).toThrow(/Identificador SQL/);
    expect(()=>gerarConsultaLeitura('config',[])).toThrow(/Nenhuma coluna/);
  });
});
