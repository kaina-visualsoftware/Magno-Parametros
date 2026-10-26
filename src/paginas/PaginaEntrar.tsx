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
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
      <h1>Entrar</h1>
      <p className="dica">
        A leitura do catálogo é pública. Entre para <strong>editar documentação</strong> (editor) ou{' '}
        <strong>gerenciar parâmetros, tags e importações</strong> (administrador).
      </p>

      <form className="cartao formulario" onSubmit={submeter}>
        <label className="campo">
          <span>E-mail</span>
          <input
            type="email"
            value={email}
            onChange={(evento) => setEmail(evento.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label className="campo">
          <span>Senha</span>
          <input
            type="password"
            value={senha}
            onChange={(evento) => setSenha(evento.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {erro && <p className="erro">{erro}</p>}
        <button type="submit" className="botao primario" disabled={aguardando}>
          {aguardando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>

      <p className="dica">
        As contas são criadas pelo administrador no painel do Supabase (Authentication → Users). O
        primeiro administrador é promovido via SQL — veja o passo a passo no README.
      </p>
    </div>
  );
}
