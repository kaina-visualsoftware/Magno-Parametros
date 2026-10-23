import { describe, expect, it } from 'vitest';
import { criarSlug, montarTextoBusca } from '../normalizador';
import { calcularCaminhoAba, calcularCaminhoParametro } from '../calculadora-caminho';
import { compararParametros } from '../comparador-importacao';
import { ManipuladorTipoGenerico, manipuladorDoTipo, registrarTipoParametro, tipoExigeOpcoes } from '../tipos-parametro';
import { Parametro } from '../entidades';

describe('Normalização de tags', () => {
  it('"Orçamento", "orcamento" e "ORÇAMENTO" geram a mesma slug (mesma tag)', () => {
    expect(criarSlug('Orçamento')).toBe('orcamento');
    expect(criarSlug('orcamento')).toBe('orcamento');
    expect(criarSlug('ORÇAMENTO')).toBe('orcamento');
  });

  it('monta texto de busca sem acentos e em minúsculas', () => {
    expect(montarTextoBusca(['Solicitar o Número da Comanda', 'Orçamento'])).toBe(
      'solicitar o numero da comanda orcamento',
    );
  });
});

describe('Calculadora de caminho', () => {
  it('calcula o caminho completo do ERP na tela auxiliar (+ Configurações)', () => {
    const caminho = calcularCaminhoParametro(
      'Utilitários > Configuração > Administração do Sistema > + Configurações',
      ['Geral', 'Orçamento'],
      'Solicitar o Número da Comanda ao finalizar Orçamento?',
    );
    expect(caminho).toBe(
      'Utilitários > Configuração > Administração do Sistema > + Configurações > Geral > Orçamento > ' +
        'Solicitar o Número da Comanda ao finalizar Orçamento?',
    );
  });

  it('calcula o caminho de uma aba na tela principal', () => {
    expect(calcularCaminhoAba('Utilitários > Configuração > Administração do Sistema', ['Financeiro', 'Recebimentos'])).toBe(
      'Utilitários > Configuração > Administração do Sistema > Financeiro > Recebimentos',
    );
  });
});

describe('Comparador de importação (idempotência)', () => {
  function parametroDeTeste(hash: string, id = 'id-teste'): Parametro {
    return {
      id,
      abaId: 'aba',
      grupo: 'Geral',
      nome: 'Parâmetro Teste',
      tipo: 'checkbox',
      opcoes: [],
      descricaoOriginal: null,
      oQueFaz: null,
      impacto: null,
      valorPadrao: null,
      observacoes: null,
      statusDocumentacao: 'pendente',
      origem: 'importado',
      hashOrigem: hash,
      editadoNaOrigem: false,
      ordem: 0,
      ativo: true,
      caminho: 'Utilitários > Configuração > Parâmetro Teste',
      imagemOrigem: null,
      imagemMarcada: false,
      textoBusca: 'parametro teste',
    };
  }

  it('classifica novo, inalterado e conflito corretamente', () => {
    const entradas = [parametroDeTeste('hash-1'), parametroDeTeste('hash-2', 'id-2')];
    const existentes = new Map([
      // Mesmo hash → inalterado (rodar 2x não duplica).
      [entradas[0].id, parametroDeTeste('hash-1')],
      // Origem mudou e alguém editou manualmente → conflito, não sobrescreve.
      [entradas[1].id, { ...parametroDeTeste('hash-antigo', 'id-2'), editadoNaOrigem: true }],
    ]);

    const resultado = compararParametros(entradas, existentes);
    expect(resultado.novos).toBe(0);
    expect(resultado.inalterados).toBe(1);
    expect(resultado.conflitos).toHaveLength(1);
    expect(resultado.conflitos[0].id).toBe('id-2');
  });

  it('parâmetro ausente no mapa é classificado como novo', () => {
    const resultado = compararParametros([parametroDeTeste('hash-x')], new Map());
    expect(resultado.novos).toBe(1);
    expect(resultado.paraSalvar[0].statusDocumentacao).toBe('pendente');
  });
});

describe('Registro de tipos de parâmetro (OCP)', () => {
  it('um tipo desconhecido registrado como fictício funciona sem alterar código existente', () => {
    registrarTipoParametro(new ManipuladorTipoGenerico('tipo_ficticio_do_teste'));
    const manipulador = manipuladorDoTipo('tipo_ficticio_do_teste');
    expect(manipulador.validarOpcoes(null)).toBeNull();
    expect(manipulador.componentes()).toEqual([]);
  });

  it('tipos de lista exigem opções; tipos simples não', () => {
    expect(tipoExigeOpcoes('select')).toBe(true);
    expect(tipoExigeOpcoes('checkbox')).toBe(false);
    expect(manipuladorDoTipo('checkbox').validarOpcoes(null)).toBeNull();
    expect(manipuladorDoTipo('select').validarOpcoes([])).not.toBeNull();
  });
});
