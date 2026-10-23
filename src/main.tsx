import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { ProvedorAutenticacao } from './aplicacao/autenticacao';
import './index.css';

const clienteConsulta = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
  },
});

ReactDOM.createRoot(document.getElementById('raiz') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={clienteConsulta}>
      <ProvedorAutenticacao>
        <HashRouter>
          <App />
        </HashRouter>
      </ProvedorAutenticacao>
    </QueryClientProvider>
  </React.StrictMode>,
);
