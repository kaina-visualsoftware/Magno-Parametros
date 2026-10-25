import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export function AlternadorTema() {
  const [tema, setTema] = useState(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
  useEffect(() => {
    document.documentElement.dataset.theme = tema;
    document.documentElement.style.colorScheme = tema;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', tema === 'dark' ? '#0b0d10' : '#f6f7f9');
    try { localStorage.setItem('magno-parametros:tema', tema); } catch { /* Storage pode estar bloqueado. */ }
  }, [tema]);
  useEffect(() => {
    const sincronizar = (evento: StorageEvent) => {
      if (evento.key === 'magno-parametros:tema') setTema(evento.newValue === 'light' ? 'light' : 'dark');
    };
    window.addEventListener('storage', sincronizar);
    return () => window.removeEventListener('storage', sincronizar);
  }, []);
  return <button className="botao-icone" type="button" aria-label={`Ativar modo ${tema === 'dark' ? 'claro' : 'escuro'}`}
    onClick={() => setTema(tema === 'dark' ? 'light' : 'dark')}>
    {tema === 'dark' ? <Sun size={19} aria-hidden /> : <Moon size={19} aria-hidden />}
  </button>;
}
