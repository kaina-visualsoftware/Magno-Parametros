import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpenCheck, Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useAutenticacao } from '../aplicacao/autenticacao';

export default function PaginaEntrar() {
  const { entrar, usuario, carregando } = useAutenticacao();
  const navegar = useNavigate();
  const localizacao = useLocation();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [aguardando, setAguardando] = useState(false);

  // Só aceita rotas internas do catálogo; impede redirecionamento externo.
  const destino = typeof localizacao.state?.voltar === 'string'
    && /^\/(?!\/)[\w/?#=&.%~-]*$/.test(localizacao.state.voltar)
    ? localizacao.state.voltar : '/';

  async function submeter(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (aguardando) return;
    setAguardando(true);
    setErro('');
    try {
      await entrar(email.trim(), senha);
      navegar(destino, { replace: true });
    } catch {
      // A mensagem não revela se o e-mail existe ou não.
      setErro('Não foi possível entrar. Confira seu e-mail e sua senha e tente novamente.');
    } finally {
      setAguardando(false);
    }
  }

  if (!carregando && usuario) return <Navigate to={destino} replace />;

  return (
    <section className="pagina-login" aria-labelledby="titulo-login">
      <div className="login-apresentacao">
        <div className="login-identidade">
          <img src={`${import.meta.env.BASE_URL}app-icon.svg`} width={60} height={60}
            alt="" aria-hidden="true" className="rounded-2xl" />
          <span>MyCommerce <strong>· Referência de parâmetros</strong></span>
        </div>
        <div className="login-texto">
          <span className="login-sobretitulo">CATÁLOGO DE CONFIGURAÇÕES</span>
          <h1>Conhecimento para configurar com confiança.</h1>
          <p>Encontre parâmetros, documente seu funcionamento e mantenha as informações do sistema organizadas em um só lugar.</p>
          <div className="login-beneficios">
            <div><BookOpenCheck aria-hidden="true" size={21} /><span>Consulte caminhos, descrições e informações dos parâmetros.</span></div>
            <div><ShieldCheck aria-hidden="true" size={21} /><span>Edite com segurança conforme as permissões da sua conta.</span></div>
          </div>
        </div>
        <p className="login-rodape">A consulta ao catálogo é pública e não exige login.</p>
      </div>

      <div className="login-area-formulario">
        <div className="login-cartao">
          <div className="login-simbolo"><LockKeyhole size={25} aria-hidden="true" /></div>
          <p className="login-sobretitulo">ÁREA RESTRITA</p>
          <h2 id="titulo-login">Entre na sua conta</h2>
          <p className="dica">Use suas credenciais para acessar as ferramentas de edição e administração do catálogo.</p>

          <form onSubmit={submeter} className="login-formulario">
            <label className="campo">
              <span>E-mail</span>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                autoComplete="username" autoCapitalize="off" autoCorrect="off"
                placeholder="seu@email.com" maxLength={254}
                disabled={aguardando} required autoFocus />
            </label>
            <label className="campo">
              <span>Senha</span>
              <span className="login-campo-senha">
                <input type={mostrarSenha ? 'text' : 'password'} value={senha}
                  onChange={e => setSenha(e.target.value)}
                  autoComplete="current-password" placeholder="Digite sua senha"
                  disabled={aguardando} required />
                <button type="button" className="login-mostrar-senha"
                  onClick={() => setMostrarSenha(valor => !valor)}
                  aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                  aria-pressed={mostrarSenha} disabled={aguardando}>
                  {mostrarSenha ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
                </button>
              </span>
            </label>
            {erro && <p className="erro" role="alert">{erro}</p>}
            <button type="submit" className="botao primario login-enviar" disabled={aguardando || carregando}>
              {aguardando ? 'Entrando…' : <>Entrar no catálogo <ArrowRight size={18} aria-hidden="true" /></>}
            </button>
          </form>

          <div className="login-voltar">
            <Link to="/" className="inline-flex items-center gap-2"><ArrowLeft size={16} aria-hidden="true" /> Voltar ao catálogo público</Link>
          </div>
        </div>
        <p className="login-ajuda">Não possui acesso? Solicite uma conta ao administrador do catálogo.</p>
      </div>
    </section>
  );
}
