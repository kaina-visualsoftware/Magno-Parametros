import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, FileInput, FolderTree, History, Image, ListChecks, Plus, Tags, BookOpenText } from 'lucide-react';
import { contarPendencias } from '../servicos/administracao';
import { ehAdministrador, useAutenticacao } from '../aplicacao/autenticacao';
import { Carregando, ErroCarregamento } from '../componentes/Estado';

const acoes = [
  { rota: '/novo', titulo: 'Novo parâmetro', descricao: 'Cadastrar manualmente', Icone: Plus },
  { rota: '/admin/revisao?tipo=documentacao', titulo: 'Revisar documentação', descricao: 'Pendências do catálogo', Icone: ListChecks },
  { rota: '/admin/imagens', titulo: 'Revisar imagens', descricao: 'Capturas ausentes ou automáticas', Icone: Image },
  { rota: '/importar', titulo: 'Importar parâmetros', descricao: 'Conferir antes de gravar', Icone: FileInput },
  { rota: '/abas', titulo: 'Telas e abas', descricao: 'Corrigir a estrutura', Icone: FolderTree },
  { rota: '/tags', titulo: 'Gerenciar tags', descricao: 'Organização e classificação', Icone: Tags },
  { rota: '/admin/historico', titulo: 'Histórico de importações', descricao: 'Registros e relatórios desta sessão', Icone: History },
];
export default function PaginaAdmin() {
  const { usuario, papel, carregando } = useAutenticacao();
  const indicadores = useQuery({queryKey:['admin','contagens'],queryFn:contarPendencias,enabled:ehAdministrador(papel),staleTime:60_000});
  if (carregando || (usuario && papel === null)) return <Carregando />;
  if (!ehAdministrador(papel)) return <div className="erro" role="alert">Acesso restrito a administradores. <Link to="/entrar">Entrar</Link></div>;
  const resumo = indicadores.data;
  return <section className="admin-pagina" aria-labelledby="admin-titulo">
    <div className="flex flex-wrap gap-4 justify-between items-start mb-8">
      <div><p className="text-sm text-acento font-semibold mb-2">ÁREA ADMINISTRATIVA</p><h1 id="admin-titulo">Painel administrativo</h1><p className="text-suave max-w-2xl">Acompanhe pendências e acesse as ferramentas de manutenção do catálogo.</p></div>
      <Link to="/novo" className="botao"><Plus size={17} aria-hidden/>Novo parâmetro</Link>
    </div>
    {indicadores.error && <ErroCarregamento erro={indicadores.error} aoTentarNovamente={() => void indicadores.refetch()}/>}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10" aria-label="Indicadores do catálogo">
      {[{titulo:'Parâmetros ativos',valor:resumo?.total,icone:BookOpenText},
        {titulo:'Documentação pendente',valor:resumo?.pendentes,icone:ListChecks},
        {titulo:'Sem imagem',valor:resumo?.semImagem,icone:Image},
        {titulo:'Origem editada',valor:resumo?.conflitos,icone:AlertTriangle}].map(x=><div key={x.titulo} className="cartao !mb-0">
          <x.icone size={20} aria-hidden className="text-acento mb-3" />
          <strong className="text-3xl tabular-nums block">{x.valor ?? (indicadores.isPending?'…':'—')}</strong>
          <span className="text-sm text-suave">{x.titulo}</span>
        </div>)}
    </div>
    <h2>Ferramentas administrativas</h2>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {acoes.map(({rota,titulo,descricao,Icone})=><Link key={rota} to={rota} className="admin-acao">
        <Icone size={24} aria-hidden className="text-acento"/><strong className="text-tinta">{titulo}</strong><span className="text-sm text-suave">{descricao}</span>
      </Link>)}
    </div>
  </section>;
}
