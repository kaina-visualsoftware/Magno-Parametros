import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { obterClienteSupabase } from '../raiz-composicao';
import { ehAdministrador, useAutenticacao } from '../aplicacao/autenticacao';
import { useDialogos } from './Dialogo';
import { Check, Copy, Database, Info, Pencil, RotateCcw } from 'lucide-react';
import {
  encontrarCorrespondencia, gerarConsultaLeitura,
  type BaseCorrespondenciasBanco,
} from '../dominio/correspondencia-banco';

async function carregarCorrespondencias(): Promise<BaseCorrespondenciasBanco> {
  const resposta = await fetch(`${import.meta.env.BASE_URL}dados/correspondencias-banco.json`);
  if (!resposta.ok) throw new Error('Não foi possível carregar as correspondências do banco.');
  return await resposta.json() as BaseCorrespondenciasBanco;
}


type Correcao = { parametro_id: string; tabela: string; colunas: string[]; observacao: string };
async function buscarCorrecao(id: string): Promise<Correcao|null> {
  const {data,error} = await obterClienteSupabase().from('correspondencias_banco')
    .select('parametro_id,tabela,colunas,observacao').eq('parametro_id',id).maybeSingle();
  if(error) throw error;
  return data as Correcao|null;
}

export function CorrespondenciaBancoParametro({ parametroId }: { parametroId: string }) {
  const {papel}=useAutenticacao();
  const admin=ehAdministrador(papel);
  const {confirmar}=useDialogos();
  const cache=useQueryClient();
  const [editando,setEditando]=useState(false);
  const [tabela,setTabela]=useState('config');
  const [colunas,setColunas]=useState('');
  const [observacao,setObservacao]=useState('');
  const [salvando,setSalvando]=useState(false);
  const [erroEdicao,setErroEdicao]=useState('');
  const [sucesso,setSucesso]=useState('');
  const correcao=useQuery({queryKey:['correspondencia-override',parametroId],
    queryFn:()=>buscarCorrecao(parametroId),enabled:Boolean(parametroId)});

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


  const original=data?encontrarCorrespondencia(data,parametroId):null;
  const resultado=correcao.data ? {
    estado:'mapeado' as const,tabela:correcao.data.tabela,
    correspondencia:{colunas:correcao.data.colunas,confianca:'alta' as const,observacao:correcao.data.observacao},
    compartilhadas:data?correcao.data.colunas.filter(c=>data.colunasCompartilhadas.includes(c)):[],
  } : original;
  useEffect(()=>{setEditando(false);setErroEdicao('');setSucesso('');},[parametroId]);
  function abrirEdicao(){
    if(!admin) return;
    setTabela(correcao.data?.tabela??original?.tabela??'config');
    setColunas((correcao.data?.colunas??(original?.estado==='mapeado'?original.correspondencia.colunas:[])).join('\n'));
    setObservacao(correcao.data?.observacao??(original?.estado==='mapeado'?original.correspondencia.observacao??'':''));
    setEditando(true);setErroEdicao('');setSucesso('');
  }
  async function salvarEdicao(evento:React.FormEvent){
    evento.preventDefault();
    if(!admin||salvando)return;
    const lista=[...new Set(colunas.split(/[\n,;]+/).map(c=>c.trim()).filter(Boolean))];
    const identificador=/^[A-Za-z_][A-Za-z0-9_]{0,62}$/;
    if(!identificador.test(tabela.trim())||lista.length===0||lista.length>30||lista.some(c=>!identificador.test(c))){
      setErroEdicao('Informe uma tabela e de 1 a 30 colunas válidas (letras, números e _).');return;
    }
    setSalvando(true);setErroEdicao('');
    try{
      const {error}=await obterClienteSupabase().from('correspondencias_banco').upsert({
        parametro_id:parametroId,tabela:tabela.trim(),colunas:lista,observacao:observacao.trim()
      },{onConflict:'parametro_id'});
      if(error)throw error;
      await cache.invalidateQueries({queryKey:['correspondencia-override',parametroId]});
      setEditando(false);setSucesso('Correspondência salva.');
    }catch(e){setErroEdicao(e instanceof Error?e.message:'Falha ao salvar.');}
    finally{setSalvando(false);}
  }
  async function restaurar(){
    if(!admin||!correcao.data||salvando)return;
    if(!await confirmar('Remover a correção e restaurar a correspondência do arquivo original?'))return;
    setSalvando(true);setErroEdicao('');
    try{
      const {error}=await obterClienteSupabase().from('correspondencias_banco')
        .delete().eq('parametro_id',parametroId);
      if(error)throw error;
      await cache.invalidateQueries({queryKey:['correspondencia-override',parametroId]});
      setEditando(false);setSucesso('Correspondência original restaurada.');
    }catch(e){setErroEdicao(e instanceof Error?e.message:'Falha ao restaurar.');}
    finally{setSalvando(false);}
  }

  return <section className="cartao" aria-labelledby="titulo-correspondencia-banco">
    <h2 id="titulo-correspondencia-banco" className="flex items-center gap-2">
      <Database size={19} aria-hidden /> Correspondência no banco de dados
    </h2>
    {correcao.isPending && <p className="dica">Consultando correções salvas...</p>}
    {correcao.error && <p className="erro" role="alert">Não foi possível consultar as correções salvas.</p>}
    {correcao.data && <p className="dica">Correspondência personalizada pelo administrador.</p>}
    {isPending ? <p className="dica">Carregando correspondência...</p> :
      error ? <div role="alert"><p className="erro">Não foi possível carregar as correspondências.</p>
        <button type="button" className="botao fantasma" onClick={() => void refetch()}>Tentar novamente</button>
      </div> : resultado?.estado === 'mapeado' ? <>
        <p className="dica">Tabela <code>{resultado.tabela}</code> · Confiança do mapeamento: <strong>{correcao.data ? 'ajustada pelo administrador' : resultado.correspondencia.confianca}</strong></p>
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

    {admin && !editando && !isPending && !correcao.isPending && !correcao.error && <div className="flex flex-wrap gap-2 mt-4">
      <button type="button" className="botao fantasma" onClick={abrirEdicao}>
        <Pencil size={16} aria-hidden/>{correcao.data?'Editar correspondência':'Cadastrar/editar correspondência'}
      </button>
      {correcao.data && <button type="button" className="botao fantasma" disabled={salvando}
        onClick={()=>void restaurar()}><RotateCcw size={16} aria-hidden/>Restaurar original</button>}
    </div>}
    {admin && editando && <form onSubmit={e=>void salvarEdicao(e)} className="cartao mt-4">
      <h3>Editar correspondência</h3>
      <label className="campo"><span>Tabela do ERP</span>
        <input type="text" required maxLength={63} value={tabela} disabled={salvando}
          onChange={e=>setTabela(e.target.value)}/></label>
      <label className="campo"><span>Colunas (uma por linha)</span>
        <textarea required rows={4} maxLength={2000} value={colunas} disabled={salvando}
          placeholder="Ex.: DiasJuro" onChange={e=>setColunas(e.target.value)}/></label>
      <label className="campo"><span>Observações sobre a correspondência</span>
        <textarea rows={3} maxLength={2000} value={observacao} disabled={salvando}
          onChange={e=>setObservacao(e.target.value)}/></label>
      <p className="dica">O catálogo será atualizado, mas nenhuma alteração será executada no banco do ERP.</p>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="botao primario" disabled={salvando}>{salvando?'Salvando…':'Salvar correspondência'}</button>
        <button type="button" className="botao fantasma" disabled={salvando} onClick={()=>setEditando(false)}>Cancelar</button>
      </div>
    </form>}
    {erroEdicao && <p className="erro" role="alert">{erroEdicao}</p>}
    {sucesso && <p className="mensagem-sucesso" role="status">{sucesso}</p>}
    <p className="dica mt-4">
      <strong>Atenção:</strong> correspondências estimadas por nome e contexto, sem confirmação no código-fonte ou nos dados do ERP.
      O SELECT é somente para consulta. Os valores necessários para ativar ou desativar cada parâmetro não foram informados.
      Faça backup e confirme o tipo e a semântica da coluna antes de qualquer UPDATE no banco do MyCommerce.
    </p>
  </section>;
}
