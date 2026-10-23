import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Cabecalho } from './componentes/Cabecalho';
import { Carregando, TelaConfiguracao } from './componentes/Estado';
import PaginaCatalogo from './paginas/PaginaCatalogo';
import PaginaBusca from './paginas/PaginaBusca';
import PaginaParametro from './paginas/PaginaParametro';
import PaginaNovoParametro from './paginas/PaginaNovoParametro';
import PaginaTags from './paginas/PaginaTags';
import PaginaTag from './paginas/PaginaTag';
import PaginaEntrar from './paginas/PaginaEntrar';
import PaginaNaoEncontrada from './paginas/PaginaNaoEncontrada';
import { configuracaoPresente } from './raiz-composicao';

// A página de importação carrega o JSON de origem — importada de forma tardia
// para não pesar no pacote principal.
const PaginaImportacao = lazy(() => import('./paginas/PaginaImportacao'));

export default function App() {
  if (!configuracaoPresente()) {
    return <TelaConfiguracao />;
  }

  return (
    <div className="aplicacao">
      <Cabecalho />
      <main className="conteudo">
        <Suspense fallback={<Carregando />}>
          <Routes>
            <Route path="/" element={<PaginaCatalogo />} />
            <Route path="/busca" element={<PaginaBusca />} />
            <Route path="/parametro/:id" element={<PaginaParametro />} />
            <Route path="/novo" element={<PaginaNovoParametro />} />
            <Route path="/tags" element={<PaginaTags />} />
            <Route path="/tag/:slug" element={<PaginaTag />} />
            <Route path="/importar" element={<PaginaImportacao />} />
            <Route path="/entrar" element={<PaginaEntrar />} />
            <Route path="*" element={<PaginaNaoEncontrada />} />
          </Routes>
        </Suspense>
      </main>
      <footer className="rodape">
        Catálogo de parâmetros do MyCommerce · Administração do Sistema
      </footer>
    </div>
  );
}
