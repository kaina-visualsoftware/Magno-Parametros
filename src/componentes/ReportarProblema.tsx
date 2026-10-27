import { useState } from 'react';
import { Bug, ExternalLink } from 'lucide-react';
import { Dialogo } from './Dialogo';

interface ReportarProblemaProps {
  aberto: boolean;
  fechar(): void;
  usuario?: string;
  parametroInicial?: string;
}

interface RespostaSugestao {
  url?: string;
  error?: string;
}

// A função está no Supabase do catálogo; não depende de Worker ou variável extra.
function urlApi(): string {
  const supabase = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const host = supabase?.startsWith('https://') && new URL(supabase).hostname.endsWith('.supabase.co')
    ? new URL(supabase).origin
    : 'https://dmgmalzqywrjecvzbkjy.supabase.co';
  return `${host}/functions/v1/criar-sugestao`;
}

export function construirUrlIssue(descricao: string, parametro: string): string {
  const url = new URL('https://github.com/kaina-visualsoftware/Myc.config/issues/new');
  url.searchParams.set('title', parametro.trim()
    ? `Sugestão de parâmetro: ${parametro.trim().slice(0, 110)}`
    : 'Sugestão de parâmetro ou correção');
  url.searchParams.set('body', [
    '## Descrição',
    descricao.trim(),
    parametro.trim() ? `**Referência do parâmetro:** ${parametro.trim()}` : '',
    '',
    '---',
    'Enviado pelo catálogo público de parâmetros do MyCommerce.',
  ].filter(Boolean).join('\n'));
  return url.toString();
}

export function ReportarProblema({ fechar, parametroInicial = '' }: ReportarProblemaProps) {
  const [descricao, setDescricao] = useState('');
  const [parametro, setParametro] = useState(parametroInicial);
  const [site, setSite] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [issue, setIssue] = useState('');
  const [falhouEnvio, setFalhouEnvio] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setErro('');
    setFalhouEnvio(false);
    const endpoint = urlApi();
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
      setFalhouEnvio(true);
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
          <p className="dica">Envie correções ou sugestões diretamente, sem precisar de uma conta no GitHub. Se o serviço estiver indisponível, será possível abrir no GitHub.</p>
          <label className="campo">
            <span>Descrição do problema ou sugestão *</span>
            <textarea required minLength={10} maxLength={4000} rows={4}
              placeholder="Descreva o parâmetro, o problema encontrado ou a sugestão..."
              value={descricao} onChange={e => setDescricao(e.target.value)} />
          </label>
          <label className="campo">
            <span>Parâmetro relacionado</span>
            <input type="text" maxLength={400} value={parametro}
              placeholder="MyCommerce > Financeiro > Configuração..."
              onChange={e => setParametro(e.target.value)} />
          </label>
          <label className="sr-only" aria-hidden="true">Deixe este campo vazio
            <input tabIndex={-1} autoComplete="off" value={site} onChange={e => setSite(e.target.value)} />
          </label>
          {erro && <p className="erro" role="alert">{erro}</p>}
          {falhouEnvio && <p className="dica">Seu texto foi preservado. Você pode concluir o envio pelo GitHub.</p>}
          <div className="flex justify-end gap-2 mt-2">
            <button type="button" className="botao fantasma" onClick={fechar} disabled={enviando}>Cancelar</button>
            <button type="submit" disabled={enviando || descricao.trim().length < 10} className="botao">
              <Bug size={16} aria-hidden /> {enviando ? 'Enviando…' : 'Enviar sugestão'}
            </button>
            {falhouEnvio && <a
              className="botao"
              href={construirUrlIssue(descricao, parametro)}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={descricao.trim().length < 10}
              onClick={evento => { if (descricao.trim().length < 10) evento.preventDefault(); }}>
              <ExternalLink size={16} aria-hidden /> Abrir no GitHub
            </a>}
          </div>
        </form>
      )}
    </Dialogo>
  );
}
