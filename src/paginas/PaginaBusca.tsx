import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { TabelaParametros } from '../componentes/TabelaParametros';
import { Carregando, ErroCarregamento } from '../componentes/Estado';
import { buscarParametros, listarTipos } from '../servicos/catalogo';
import { FiltrosParametros } from '../dados/portas';
import { StatusDocumentacao } from '../dominio/entidades';

const POR_PAGINA = 50;

export default function PaginaBusca() {
  const [parametrosUrl] = useSearchParams();
  const [termo, setTermo] = useState(parametrosUrl.get('termo') ?? '');
  const [termoEfetivo, setTermoEfetivo] = useState(parametrosUrl.get('termo') ?? '');
  const [status, setStatus] = useState(parametrosUrl.get('status') ?? '');
  const [tipo, setTipo] = useState('');
  const [pagina, setPagina] = useState(0);

  const tipos = useQuery({ queryKey: ['tipos'], queryFn: listarTipos });

  const consulta = useQuery({
    queryKey: ['parametros', 'busca', termoEfetivo, status, tipo, pagina],
    queryFn: async () => {
      const filtros: FiltrosParametros = {
        termo: termoEfetivo || undefined,
        statusDocumentacao: (status || undefined) as StatusDocumentacao | undefined,
        tipo: tipo || undefined,
        pagina,
        porPagina: POR_PAGINA,
        ordenarPor: 'caminho',
        direcao: 'asc',
        ativo: true,
      };
      return buscarParametros(filtros);
    },
  });

  const total = consulta.data?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <div className="pagina-busca">
      <h1>Busca</h1>
      <form
        className="barra-filtros"
        onSubmit={(evento) => {
          evento.preventDefault();
          setTermoEfetivo(termo);
          setPagina(0);
        }}
      >
        <input
          type="search"
          value={termo}
          onChange={(evento) => setTermo(evento.target.value)}
          placeholder="Buscar por nome, descrição, o que faz, grupo ou caminho… (sem diferença de acento/maiúscula)"
          aria-label="Termo de busca"
        />
        <select
          value={tipo}
          onChange={(evento) => {
            setTipo(evento.target.value);
            setPagina(0);
          }}
          aria-label="Filtrar por tipo"
        >
          <option value="">Todos os tipos</option>
          {(tipos.data ?? []).map((tipoParametro) => (
            <option key={tipoParametro.codigo} value={tipoParametro.codigo}>
              {tipoParametro.codigo}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(evento) => {
            setStatus(evento.target.value);
            setPagina(0);
          }}
          aria-label="Filtrar por status de documentação"
        >
          <option value="">Documentação: todas</option>
          <option value="pendente">Pendentes</option>
          <option value="documentado">Documentados</option>
          <option value="revisado">Revisados</option>
        </select>
        <button type="submit" className="botao">
          Buscar
        </button>
      </form>

      {consulta.isLoading ? (
        <Carregando />
      ) : consulta.error ? (
        <ErroCarregamento erro={consulta.error} />
      ) : (
        <>
          <TabelaParametros parametros={consulta.data?.itens ?? []} />
          <div className="paginacao">
            <span>
              {total} resultado{total === 1 ? '' : 's'} · página {pagina + 1} de {totalPaginas}
            </span>
            <div className="botoes-paginacao">
              <button
                type="button"
                className="botao fantasma"
                disabled={pagina === 0}
                onClick={() => setPagina((atual) => Math.max(0, atual - 1))}
              >
                ← Anterior
              </button>
              <button
                type="button"
                className="botao fantasma"
                disabled={pagina + 1 >= totalPaginas}
                onClick={() => setPagina((atual) => atual + 1)}
              >
                Próxima →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
