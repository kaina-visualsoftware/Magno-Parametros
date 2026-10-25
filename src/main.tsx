import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { ProvedorAutenticacao } from './aplicacao/autenticacao';
import { configuracaoPresente } from './raiz-composicao';
import { TelaConfiguracao } from './componentes/Estado';
import './index.css';

const clienteConsulta = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 60_000,
      gcTime: 30 * 60_000,
    },
  },
});

ReactDOM.createRoot(document.getElementById('raiz') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={clienteConsulta}>
      {configuracaoPresente() ? <ProvedorAutenticacao>
        <HashRouter>
          <App />
        </HashRouter>
      </ProvedorAutenticacao> : <TelaConfiguracao />}
    </QueryClientProvider>
  </React.StrictMode>,
);
