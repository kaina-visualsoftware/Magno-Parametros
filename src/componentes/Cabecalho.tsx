import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAutenticacao } from '../aplicacao/autenticacao';

export function Cabecalho() {
  const navegar = useNavigate();
  const { usuario, papel, sair } = useAutenticacao();
  const [termo, setTermo] = useState('');

  function submeterBusca(evento: React.FormEvent) {
    evento.preventDefault();
    if (termo.trim()) navegar(`/busca?termo=${encodeURIComponent(termo.trim())}`);
  }

  return (
    <header className="cabecalho">
      <Link to="/" className="marca">
        <span className="marca-principal">Catálogo de Parâmetros</span>
        <span className="marca-secundaria">MyCommerce · Administração do Sistema</span>
      </Link>

      <nav className="navegacao" aria-label="Navegação principal">
        <NavLink to="/" end>
          Catálogo
        </NavLink>
        <NavLink to="/tags">Tags</NavLink>
        {papel === 'administrador' && <NavLink to="/importar">Importar</NavLink>}
        {papel === 'administrador' && <NavLink to="/novo">Novo parâmetro</NavLink>}
      </nav>

      <form className="busca-rapida" role="search" onSubmit={submeterBusca}>
        <input
          type="search"
          value={termo}
          onChange={(evento) => setTermo(evento.target.value)}
          placeholder="Buscar por nome, descrição ou caminho…"
          aria-label="Buscar parâmetros"
        />
      </form>

      <div className="sessao-usuario">
        {usuario ? (
          <>
            <span className="etiqueta-papel" data-papel={papel ?? 'leitor'}>
              {papel ?? 'leitor'}
            </span>
            <span className="email-usuario" title={usuario.email ?? ''}>
              {usuario.email}
            </span>
            <button type="button" className="botao fantasma" onClick={() => void sair()}>
              Sair
            </button>
          </>
        ) : (
          <Link className="botao" to="/entrar">
            Entrar
          </Link>
        )}
      </div>
    </header>
  );
}
