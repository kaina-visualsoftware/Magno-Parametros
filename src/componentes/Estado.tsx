export function Carregando() {
  return <p className="carregando" role="status">Carregando…</p>;
}

export function Vazio({ mensagem }: { mensagem: string }) {
  return <p className="vazio">{mensagem}</p>;
}

export function SkeletonLinhas({ total = 8 }: { total?: number } = {}) {
  return (
    <div className="skeleton-lista" role="status" aria-label="Carregando parâmetros">
      {Array.from({ length: total }).map((_, indice) => (
        <div key={indice} className="skeleton-linha">
          <span className="skeleton-celula" style={{ width: '26%' }} />
          <span className="skeleton-celula" style={{ width: '14%' }} />
          <span className="skeleton-celula" style={{ width: '18%' }} />
          <span className="skeleton-celula" style={{ width: '14%' }} />
          <span className="skeleton-celula" style={{ width: '28%' }} />
        </div>
      ))}
    </div>
  );
}

export function ErroCarregamento({
  erro,
  aoTentarNovamente,
}: {
  erro: unknown;
  aoTentarNovamente?: () => void;
}) {
  return (
    <div className="erro-com-retry" role="alert">
      <p>
        Não foi possível carregar: {erro instanceof Error ? erro.message : String(erro)}
      </p>
      {aoTentarNovamente && (
        <button type="button" className="botao fantasma" onClick={aoTentarNovamente}>
          Tentar novamente
        </button>
      )}
    </div>
  );
}

export function TelaConfiguracao() {
  return (
    <div className="tela-configuracao">
      <h1>Catálogo de Parâmetros · MyCommerce</h1>
      <p>Falta configurar a conexão com o Supabase.</p>
      <p>
        Crie um arquivo <code>.env</code> na raiz do projeto (use o <code>.env.example</code> como
        modelo) e reinicie o servidor:
      </p>
      <pre>
        {'VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co\nVITE_SUPABASE_ANON_KEY=SUA_CHAVE_ANONIMA'}
      </pre>
      <p>Instruções completas no README do projeto.</p>
    </div>
  );
}
