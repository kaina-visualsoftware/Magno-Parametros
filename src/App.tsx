import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Cabecalho } from './componentes/Cabecalho';
import { Carregando, TelaConfiguracao } from './componentes/Estado';
import PaginaCatalogo from './paginas/PaginaCatalogo';
import PaginaBusca from './paginas/PaginaBusca';
import PaginaNaoEncontrada from './paginas/PaginaNaoEncontrada';
import { configuracaoPresente } from './raiz-composicao';
import { ProvedorDialogos } from './componentes/Dialogo';

// A página de importação carrega o JSON de origem — importada de forma tardia
// para não pesar no pacote principal.
const PaginaImportacao = lazy(() => import('./paginas/PaginaImportacao'));
const PaginaParametro = lazy(() => import('./paginas/PaginaParametro'));
const PaginaNovoParametro = lazy(() => import('./paginas/PaginaNovoParametro'));
const PaginaTags = lazy(() => import('./paginas/PaginaTags'));
const PaginaAbas = lazy(() => import('./paginas/PaginaAbas'));
const PaginaTag = lazy(() => import('./paginas/PaginaTag'));
const PaginaEntrar = lazy(() => import('./paginas/PaginaEntrar'));
const PaginaAdmin = lazy(() => import('./paginas/PaginaAdmin'));
const PaginaImagensAdmin = lazy(() => import('./paginas/PaginaImagensAdmin'));
const PaginaRevisao = lazy(() => import('./paginas/PaginaRevisao'));
const PaginaHistoricoImportacoes = lazy(() => import('./paginas/PaginaHistoricoImportacoes'));

export default function App() {
  if (!configuracaoPresente()) {
    return <TelaConfiguracao />;
  }

  return (
    <ProvedorDialogos><div className="aplicacao">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:p-4" onClick={e => { e.preventDefault(); document.getElementById('conteudo')?.focus(); }}>Pular para o conteúdo</a>
      <Cabecalho />
      <main className="conteudo" id="conteudo" tabIndex={-1}>
        <Suspense fallback={<Carregando />}>
          <Routes>
            <Route path="/" element={<PaginaCatalogo />} />
            <Route path="/busca" element={<PaginaBusca />} />
            <Route path="/parametro/:id" element={<PaginaParametro />} />
            <Route path="/novo" element={<PaginaNovoParametro />} />
            <Route path="/tags" element={<PaginaTags />} />
            <Route path="/abas" element={<PaginaAbas />} />
            <Route path="/tag/:slug" element={<PaginaTag />} />
            <Route path="/importar" element={<PaginaImportacao />} />
            <Route path="/entrar" element={<PaginaEntrar />} />
            <Route path="/admin" element={<PaginaAdmin />} />
            <Route path="/admin/revisao" element={<PaginaRevisao />} />
            <Route path="/admin/imagens" element={<PaginaImagensAdmin />} />
            <Route path="/admin/historico" element={<PaginaHistoricoImportacoes />} />
            <Route path="*" element={<PaginaNaoEncontrada />} />
          </Routes>
        </Suspense>
      </main>
      <footer className="rodape">
        <span>MyCommerce / Referência de parâmetros</span><span>Conhecimento para configurar com confiança.</span>
      </footer>
    </div></ProvedorDialogos>
  );
}
