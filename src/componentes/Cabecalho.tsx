import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Bug, LayoutDashboard, LogIn, LogOut, Menu, UserRound, X } from 'lucide-react';
import { useAutenticacao } from '../aplicacao/autenticacao';
import { AlternadorTema } from './AlternadorTema';
import { ReportarProblema } from './ReportarProblema';
import { cn } from '../lib/cn';

export function Cabecalho() {
  const { usuario, papel, sair } = useAutenticacao();
  const localizacao = useLocation();
  const [aberto, setAberto] = useState(false);
  const [contaAberta, setContaAberta] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [erro, setErro] = useState('');
  const [reportarAberto, setReportarAberto] = useState(false);
  const id = /^\/parametro\/([^/]+)\/?$/.exec(localizacao.pathname)?.[1];
  const parametroInicial = id ? decodeURIComponent(id) : null;

  async function encerrar() {
    setSaindo(true); setErro('');
    try { await sair(); setContaAberta(false); }
    catch { setErro('Não foi possível sair. Tente novamente.'); }
    finally { setSaindo(false); }
  }

  return <header className="border-b border-linha bg-fundo/95">
    <div className="max-w-7xl 3xl:max-w-[1440px] mx-auto flex flex-wrap items-center gap-2 sm:gap-4 px-3 sm:px-6 lg:px-10 py-3">
      <Link to="/" className="flex items-center gap-2 sm:gap-3 !text-tinta mr-auto" aria-label="MyCommerce, catálogo de parâmetros">
        <img src={`${import.meta.env.BASE_URL}app-icon.svg`} width={40} height={40} alt="" aria-hidden="true" className="rounded-xl shrink-0" />
        <span className="flex flex-col leading-tight"><strong className="text-base tracking-tight">MyCommerce</strong><span className="hidden min-[360px]:block text-xs text-suave mt-1">Referência de parâmetros</span></span>
      </Link>
      <button type="button" className="botao-icone md:hidden" aria-expanded={aberto} aria-controls="menu-principal"
        aria-label={aberto ? 'Fechar menu' : 'Abrir menu'} onClick={() => setAberto(!aberto)}>
        {aberto ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
      </button>
      <nav id="menu-principal" aria-label="Navegação principal" className={cn('items-center gap-1 w-full md:w-auto md:flex', aberto ? 'flex flex-wrap' : 'hidden')}>
        <NavLink to="/" end className={({isActive}) => cn('rounded-lg px-3 py-2 text-sm !text-suave hover:bg-elevada', isActive && 'bg-elevada !text-tinta')} onClick={() => setAberto(false)}>Catálogo</NavLink>
        <NavLink to="/tags" className={({isActive}) => cn('rounded-lg px-3 py-2 text-sm !text-suave hover:bg-elevada', isActive && 'bg-elevada !text-tinta')} onClick={() => setAberto(false)}>Tags</NavLink>
        {papel === 'administrador' && <NavLink to="/admin" className={({isActive}) => cn('botao-icone !text-sm', isActive && 'bg-elevada !text-tinta')} onClick={() => setAberto(false)}><LayoutDashboard size={17} aria-hidden />Administração</NavLink>}
        {parametroInicial && <button type="button" className="botao-icone !text-sm" title="Sugerir correção deste parâmetro"
          onClick={() => { setReportarAberto(true); setAberto(false); }}><Bug size={17} aria-hidden />Sugerir correção</button>}
      </nav>
      <AlternadorTema />
      {usuario ? <div className="relative">
        <button type="button" className="botao-icone" aria-label="Menu da conta" aria-expanded={contaAberta}
          aria-controls="menu-conta" onClick={() => setContaAberta(!contaAberta)}>
          <UserRound size={20} aria-hidden/><span className="hidden sm:inline text-xs">{papel === 'administrador' ? 'Admin' : 'Conta'}</span>
        </button>
        {contaAberta && <div id="menu-conta" className="absolute right-0 top-full mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-xl bg-superficie border border-linha p-3 shadow-xl z-50">
          <p className="text-sm font-semibold break-all mb-1">{usuario.email}</p>
          <p className="text-xs text-suave mb-3">Acesso: {papel ?? 'carregando…'}</p>
          {papel === 'administrador' && <Link to="/admin" className="botao fantasma w-full !justify-start mb-2" onClick={() => setContaAberta(false)}><LayoutDashboard size={17} aria-hidden/>Painel administrativo</Link>}
          <button type="button" className="botao fantasma w-full !justify-start" onClick={() => void encerrar()} disabled={saindo}><LogOut size={17} aria-hidden />{saindo ? 'Saindo…' : 'Sair da conta'}</button>
        </div>}
      </div> : <Link className="botao-icone" to="/entrar"><LogIn size={17} aria-hidden /><span className="text-sm hidden sm:inline">Entrar</span></Link>}
      {erro && <p role="alert" className="erro w-full">{erro}</p>}
    </div>
    {reportarAberto && parametroInicial && <ReportarProblema aberto={true}
      fechar={() => setReportarAberto(false)} parametroInicial={parametroInicial} usuario={usuario?.email} />}
  </header>;
}
