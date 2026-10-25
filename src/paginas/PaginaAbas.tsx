import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Arvore } from '../componentes/Arvore';
import { Carregando, ErroCarregamento } from '../componentes/Estado';
import { obterArvore } from '../servicos/catalogo';
import { ehAdministrador, useAutenticacao } from '../aplicacao/autenticacao';

/** Página administrativa dedicada à correção de nomes de abas truncados. */
export default function PaginaAbas() {
  const { usuario, papel } = useAutenticacao();
  const consulta = useQuery({
    queryKey: ['arvore'],
    queryFn: obterArvore,
    enabled: Boolean(usuario) && ehAdministrador(papel),
  });

  if (!usuario) {
    return (
      <p className="erro">
        Entrar como <strong>administrador</strong> é obrigatório para gerenciar abas.{' '}
        <Link to="/entrar">Entrar</Link>
      </p>
    );
  }
  if (!ehAdministrador(papel)) {
    return (
      <p className="erro">
        A renomeação de abas é exclusiva de administradores.{' '}
        <Link to="/entrar">Entrar com conta de administrador</Link>
      </p>
    );
  }
  if (consulta.isPending) return <Carregando />;
  if (consulta.error) {
    return <ErroCarregamento erro={consulta.error} aoTentarNovamente={() => void consulta.refetch()} />;
  }

  return (
    <div>
      <h1>Telas e abas</h1>
      <p className="dica">
        Use o lápis para renomear uma aba. O caminho de todos os parâmetros descendentes é
        recalculado e o nome original importado é preservado.
      </p>
      <Arvore telas={consulta.data.telas} raizes={consulta.data.raizes} abaSelecionadaId={null} />
    </div>
  );
}
