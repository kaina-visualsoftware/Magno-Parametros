export function Carregando() {
  return <p className="carregando">Carregando…</p>;
}

export function Vazio({ mensagem }: { mensagem: string }) {
  return <p className="vazio">{mensagem}</p>;
}

export function ErroCarregamento({ erro }: { erro: unknown }) {
  return (
    <p className="erro">
      Não foi possível carregar: {erro instanceof Error ? erro.message : String(erro)}
    </p>
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
