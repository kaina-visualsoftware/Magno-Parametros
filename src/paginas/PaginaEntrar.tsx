import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAutenticacao } from '../aplicacao/autenticacao';

export default function PaginaEntrar() {
  const { entrar } = useAutenticacao();
  const navegar = useNavigate();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [aguardando, setAguardando] = useState(false);

  async function submeter(evento: React.FormEvent) {
    evento.preventDefault();
    setAguardando(true);
    setErro('');
    try {
      await entrar(email.trim(), senha);
      navegar('/');
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Não foi possível entrar.');
    } finally {
      setAguardando(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="cartao formulario mx-auto max-w-sm">
        <h1>Entrar</h1>
        <p className="dica">
          A leitura do catálogo é pública. Entre para <strong>editar documentação</strong> (editor) ou{' '}
          <strong>gerenciar parâmetros, tags e importações</strong> (administrador).
        </p>

        <form onSubmit={submeter}>
          <label className="campo">
            <span>E-mail</span>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label className="campo">
            <span>Senha</span>
            <input
              type="password"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {erro && <p className="erro" role="alert">{erro}</p>}
          <button type="submit" className="botao primario" disabled={aguardando}>
            {aguardando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="dica">
          As contas são criadas pelo administrador no painel do Supabase (Authentication → Users). O
          primeiro administrador é promovido via SQL — veja o passo a passo no README.
        </p>
      </div>
    </div>
  );
}
