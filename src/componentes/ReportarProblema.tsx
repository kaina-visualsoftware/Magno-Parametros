import { useState } from 'react';
import { Bug } from 'lucide-react';
import { Dialogo } from './Dialogo';

interface ReportarProblemaProps {
  aberto: boolean;
  fechar(): void;
  usuario?: string;
}

interface RespostaSugestao {
  url?: string;
  error?: string;
}

function urlApi(): string | null {
  const configurada = import.meta.env.VITE_ISSUES_API_URL as string | undefined;
  const base = configurada || import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!base) return null;
  try {
    const url = new URL(base);
    // Não envie sugestões para o endpoint do Supabase: só o Worker possui o token.
    if (url.protocol !== 'https:' || url.hostname.endsWith('.supabase.co')) return null;
    return new URL('/api/sugestoes', url).toString();
  } catch {
    return null;
  }
}

export function ReportarProblema({ fechar }: ReportarProblemaProps) {
  const [descricao, setDescricao] = useState('');
  const [parametro, setParametro] = useState('');
  const [site, setSite] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [issue, setIssue] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setErro('');
    const endpoint = urlApi();
    if (!endpoint) {
      setErro('Envio automático ainda não configurado. Contate a administração do catálogo.');
      return;
    }
    setEnviando(true);
    try {
      const resposta = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descricao: descricao.trim(), parametro: parametro.trim(), site }),
      });
      const dados = await resposta.json() as RespostaSugestao;
      if (!resposta.ok || !dados.url) {
        throw new Error(dados.error || 'Não foi possível registrar a sugestão.');
      }
      setIssue(dados.url);
      setDescricao('');
      setParametro('');
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Falha de conexão. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialogo titulo="Reportar problema ou sugerir parâmetro" fechar={fechar}>
      {issue ? (
        <div role="status" className="flex flex-col gap-4">
          <p className="mensagem-sucesso">Sua sugestão foi registrada no GitHub com sucesso.</p>
          <a href={issue} target="_blank" rel="noopener noreferrer">Ver issue criada no GitHub</a>
          <button className="botao" type="button" onClick={fechar}>Fechar</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <p className="dica">Envie correções ou sugestões diretamente, sem precisar de uma conta no GitHub.</p>
          <label className="campo">
            <span>Descrição do problema ou sugestão *</span>
            <textarea required minLength={10} maxLength={4000} rows={4}
              placeholder="Descreva o parâmetro, o problema encontrado ou a sugestão..."
              value={descricao} onChange={e => setDescricao(e.target.value)} />
          </label>
          <label className="campo">
            <span>URL ou caminho do parâmetro (opcional)</span>
            <input type="text" maxLength={400} value={parametro}
              placeholder="MyCommerce > Financeiro > Configuração..."
              onChange={e => setParametro(e.target.value)} />
          </label>
          <label className="sr-only" aria-hidden="true">Deixe este campo vazio
            <input tabIndex={-1} autoComplete="off" value={site} onChange={e => setSite(e.target.value)} />
          </label>
          {erro && <p className="erro" role="alert">{erro}</p>}
          <div className="flex justify-end gap-2 mt-2">
            <button type="button" className="botao fantasma" onClick={fechar} disabled={enviando}>Cancelar</button>
            <button type="submit" disabled={enviando || descricao.trim().length < 10} className="botao">
              <Bug size={16} aria-hidden /> {enviando ? 'Enviando…' : 'Enviar sugestão'}
            </button>
          </div>
        </form>
      )}
    </Dialogo>
  );
}
