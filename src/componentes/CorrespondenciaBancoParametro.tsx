import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Copy, Database, Info } from 'lucide-react';
import {
  encontrarCorrespondencia, gerarConsultaLeitura,
  type BaseCorrespondenciasBanco,
} from '../dominio/correspondencia-banco';

async function carregarCorrespondencias(): Promise<BaseCorrespondenciasBanco> {
  const resposta = await fetch(`${import.meta.env.BASE_URL}dados/correspondencias-banco.json`);
  if (!resposta.ok) throw new Error('Não foi possível carregar as correspondências do banco.');
  return await resposta.json() as BaseCorrespondenciasBanco;
}

export function CorrespondenciaBancoParametro({ parametroId }: { parametroId: string }) {
  const [copiado, setCopiado] = useState<'colunas'|'consulta'|null>(null);
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['correspondencias-banco'],
    queryFn: carregarCorrespondencias,
    staleTime: Infinity,
  });

  async function copiar(valor: string, tipo: 'colunas'|'consulta') {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(tipo);
    } catch {
      setCopiado(null);
    }
  }

  const resultado = data ? encontrarCorrespondencia(data, parametroId) : null;
  return <section className="cartao" aria-labelledby="titulo-correspondencia-banco">
    <h2 id="titulo-correspondencia-banco" className="flex items-center gap-2">
      <Database size={19} aria-hidden /> Correspondência no banco de dados
    </h2>
    {isPending ? <p className="dica">Carregando correspondência...</p> :
      error ? <div role="alert"><p className="erro">Não foi possível carregar as correspondências.</p>
        <button type="button" className="botao fantasma" onClick={() => void refetch()}>Tentar novamente</button>
      </div> : resultado?.estado === 'mapeado' ? <>
        <p className="dica">Tabela <code>{resultado.tabela}</code> · Confiança do mapeamento: <strong>{resultado.correspondencia.confianca}</strong></p>
        <div className="flex flex-wrap gap-2 my-3">
          {resultado.correspondencia.colunas.map(coluna =>
            <code key={coluna} className="rounded-lg border border-linha bg-elevada px-3 py-2 break-all">{coluna}</code>)}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="botao fantasma" onClick={() => void copiar(resultado.correspondencia.colunas.join(', '), 'colunas')}>
            {copiado==='colunas'?<Check size={16} aria-hidden/>:<Copy size={16} aria-hidden/>}
            {copiado==='colunas'?'Colunas copiadas':'Copiar colunas'}
          </button>
          <button type="button" className="botao fantasma" onClick={() => void copiar(gerarConsultaLeitura(resultado.tabela, resultado.correspondencia.colunas), 'consulta')}>
            {copiado==='consulta'?<Check size={16} aria-hidden/>:<Copy size={16} aria-hidden/>}
            {copiado==='consulta'?'Consulta copiada':'Copiar SELECT'}
          </button>
        </div>
        {resultado.correspondencia.observacao && <p className="dica mt-3"><strong>Observação:</strong> {resultado.correspondencia.observacao}</p>}
        {resultado.compartilhadas.length>0 &&
          <p className="dica mt-3"><Info size={15} className="inline mr-1" aria-hidden/>
            {resultado.compartilhadas.length===1?'A coluna':'As colunas'} <strong>{resultado.compartilhadas.join(', ')}</strong> também {resultado.compartilhadas.length===1?'é utilizada':'são utilizadas'} por outro(s) parâmetro(s) do catálogo.
          </p>}
        {resultado.correspondencia.confianca !== 'alta' &&
          <p className="dica mt-3">Esta correspondência é {resultado.correspondencia.confianca === 'media' ? 'provável' : 'incerta'}; confirme no sistema antes de alterar dados.</p>}
      </> : resultado?.estado === 'sem-coluna' ?
        <p className="dica">O arquivo de correspondências não identificou uma coluna da tabela <code>{resultado.tabela}</code> para este parâmetro. Ele pode estar armazenado em outro local.</p> :
        <p className="dica">Este parâmetro não consta no arquivo de correspondências fornecido.</p>}
  </section>;
}
