import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Bug, LogIn, LogOut, Menu, X } from 'lucide-react';
import { useAutenticacao } from '../aplicacao/autenticacao';
import { AlternadorTema } from './AlternadorTema';
import { ReportarProblema } from './ReportarProblema';
import { cn } from '../lib/cn';

export function Cabecalho() {
  const { usuario, papel, sair } = useAutenticacao();
  const localizacao = useLocation();
  const identificadorParametro = /^\/parametro\/([^/]+)\/?$/.exec(localizacao.pathname)?.[1];
  const referenciaParametro = identificadorParametro ? decodeURIComponent(identificadorParametro) : null;
  const [aberto, setAberto] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [erro, setErro] = useState('');
  const [reportarAberto, setReportarAberto] = useState(false);

  return <header className="border-b border-linha bg-fundo/95">
    <div className="max-w-7xl 3xl:max-w-[1440px] mx-auto flex flex-wrap items-center gap-2 sm:gap-4 px-3 sm:px-6 lg:px-10 py-4">
      <Link to="/" className="flex items-center gap-2 sm:gap-3 !text-tinta mr-auto" aria-label="MyCommerce, catálogo de parâmetros">
        <img src={`${import.meta.env.BASE_URL}app-icon.svg`} width={40} height={40} alt="" aria-hidden="true" className="rounded-xl shrink-0" />
        <span className="flex flex-col leading-tight"><strong className="text-base tracking-tight">MyCommerce</strong><span className="hidden min-[360px]:block text-xs text-suave mt-1">Referência de parâmetros</span></span>
      </Link>
      <AlternadorTema />
      <button type="button" className="botao-icone md:hidden" aria-expanded={aberto} aria-controls="menu-principal" aria-label="Menu de navegação" onClick={() => setAberto(!aberto)}>
        {aberto ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
      </button>
      <nav id="menu-principal" aria-label="Navegação principal" className={cn('items-center gap-1 w-full md:w-auto md:flex', aberto ? 'flex flex-wrap' : 'hidden')}>
        {[['/', 'Catálogo'], ['/tags', 'Tags'], ...(papel === 'administrador' ? [['/novo','Novo parâmetro'], ['/abas','Abas'], ['/importar','Importar']] : [])].map(([rota,nome]) =>
          <NavLink key={rota} to={rota} end className={({ isActive }) => cn('rounded-lg px-3 py-2.5 text-sm !text-suave hover:bg-elevada', isActive && 'bg-elevada !text-tinta')} onClick={() => setAberto(false)}>{nome}</NavLink>)}
        {referenciaParametro && <button type="button" className="botao-icone" title="Sugerir correção deste parâmetro" onClick={() => { setReportarAberto(true); setAberto(false); }}><Bug size={17} aria-hidden /><span className="text-sm hidden sm:inline">Sugerir correção</span></button>}
        {usuario ? (
          <>
            <span className="text-xs text-suave px-2" title="Permissões registradas no Supabase">Papel: {papel ?? 'carregando…'}</span>
            <button
              className="botao-icone"
              title={usuario.email}
              disabled={saindo}
              onClick={async () => {
                setSaindo(true);
                setErro('');
                try { await sair(); } catch { setErro('Não foi possível sair. Tente novamente.'); }
                finally { setSaindo(false); }
              }}
            >
              <LogOut size={17} aria-hidden />
              <span className="text-sm">{saindo ? 'Saindo…' : 'Sair'}</span>
            </button>
          </>
        ) : (
          <Link className="botao-icone" to="/entrar" onClick={() => setAberto(false)}>
            <LogIn size={17} aria-hidden />
            <span className="text-sm">Entrar</span>
          </Link>
        )}
      </nav>
      {erro && <p role="alert" className="erro w-full">{erro}</p>}
    </div>
    {reportarAberto && referenciaParametro && (
      <ReportarProblema
        aberto={reportarAberto}
        fechar={() => setReportarAberto(false)}
        usuario={usuario?.email}
        parametroInicial={referenciaParametro}
      />
    )}
  </header>;
}
