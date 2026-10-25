import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { obterTag } from '../servicos/catalogo';
import { Carregando, ErroCarregamento, Vazio } from '../componentes/Estado';
import PaginaCatalogo from './PaginaCatalogo';

export default function PaginaTag() {
  const { slug = '' } = useParams();
  const tag = useQuery({ queryKey: ['tag', slug], queryFn: () => obterTag(slug) });
  if (tag.isPending) return <Carregando />;
  if (tag.error) return <ErroCarregamento erro={tag.error} aoTentarNovamente={() => void tag.refetch()} />;
  if (!tag.data) return <Vazio mensagem="Tag não encontrada." />;
  return <PaginaCatalogo key={slug} tagFixa={tag.data.id} titulo={`Parâmetros de ${tag.data.nome}`} />;
}
