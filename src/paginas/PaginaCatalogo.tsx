import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Arvore } from '../componentes/Arvore';
import { TabelaParametros } from '../componentes/TabelaParametros';
import { Migalhas } from '../componentes/Migalhas';
import { Carregando, ErroCarregamento } from '../componentes/Estado';
import {
  buscarParametros,
  idsDeSubarvore,
  listarAbas,
  listarTipos,
  NoArvore,
  obterArvore,
} from '../servicos/catalogo';
import { FiltrosParametros } from '../dados/portas';
import { StatusDocumentacao } from '../dominio/entidades';
import { useAutenticacao } from '../aplicacao/autenticacao';

const POR_PAGINA = 50;

function acharNo(nos: NoArvore[], id: string): NoArvore | null {
  for (const no of nos) {
    if (no.aba.id === id) return no;
    const achado = acharNo(no.filhos, id);
    if (achado) return achado;
  }
  return null;
}

export default function PaginaCatalogo() {
  const [parametrosUrl, setParametrosUrl] = useSearchParams();
  const abaSelecionada = parametrosUrl.get('aba');
  const { papel } = useAutenticacao();

  const [incluirSubabas, setIncluirSubabas] = useState(false);
  const [pagina, setPagina] = useState(0);
  const [tipo, setTipo] = useState('');
  const [status, setStatus] = useState('');
  const [termo, setTermo] = useState('');

  const arvore = useQuery({ queryKey: ['arvore'], queryFn: obterArvore });
  const tipos = useQuery({ queryKey: ['tipos'], queryFn: listarTipos });

  const consultaParametros = useQuery({
    queryKey: ['parametros', 'catalogo', abaSelecionada, incluirSubabas, pagina, tipo, status, termo],
    queryFn: async () => {
      let abaIds: string[] | undefined;
      if (abaSelecionada) {
        if (incluirSubabas) {
          const abas = await listarAbas();
          abaIds = idsDeSubarvore(abas, abaSelecionada);
        } else {
          abaIds = [abaSelecionada];
        }
      }
      const filtros: FiltrosParametros = {
        abaIds,
        tipo: tipo || undefined,
        statusDocumentacao: (status || undefined) as StatusDocumentacao | undefined,
        termo: termo || undefined,
        pagina,
        porPagina: POR_PAGINA,
        ordenarPor: 'ordem',
        direcao: 'asc',
        ativo: true,
      };
      return buscarParametros(filtros);
    },
  });

  const noSelecionado = useMemo(() => {
    if (!abaSelecionada || !arvore.data) return null;
    for (const lista of Object.values(arvore.data.raizes)) {
      const achado = acharNo(lista, abaSelecionada);
      if (achado) return achado;
    }
    return null;
  }, [abaSelecionada, arvore.data]);

  const totalGeral = useMemo(() => {
    if (!arvore.data) return 0;
    let soma = 0;
    for (const nos of Object.values(arvore.data.raizes)) {
      for (const no of nos) soma += no.contagemTotal;
    }
    return soma;
  }, [arvore.data]);

  const total = consultaParametros.data?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  function selecionarAba(abaId: string) {
    setParametrosUrl({ aba: abaId });
    setPagina(0);
  }

  return (
    <div className="pagina-catalogo">
      <aside className="painel-arvore">
        {arvore.isLoading ? (
          <Carregando />
        ) : arvore.error ? (
          <ErroCarregamento erro={arvore.error} />
        ) : (
          arvore.data && (
            <Arvore
              telas={arvore.data.telas}
              raizes={arvore.data.raizes}
              abaSelecionadaId={abaSelecionada}
              aoSelecionar={selecionarAba}
            />
          )
        )}
      </aside>

      <section className="painel-lista">
        {noSelecionado && <Migalhas segmentos={noSelecionado.aba.caminho.split(' > ')} />}

        {!abaSelecionada && (
          <div className="resumo-catalogo">
            <h1>Administração do Sistema · MyCommerce</h1>
            <p>
              Catálogo de referência dos parâmetros de configuração do ERP, fiel à navegação
              original: <strong>Utilitários {'>'} Configuração {'>'} Administração do Sistema</strong>.
              Selecione uma aba na árvore ou use a busca.
            </p>
            <p className="estatistica">
              {totalGeral} parâmetros catalogados
              {arvore.data ? ` em ${arvore.data.telas.length} telas` : ''}
            </p>
          </div>
        )}

        <div className="barra-filtros">
          <input
            type="search"
            value={termo}
            onChange={(evento) => {
              setTermo(evento.target.value);
              setPagina(0);
            }}
            placeholder="Filtrar pelo nome…"
            aria-label="Filtrar parâmetros pelo nome"
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
          <label className="alternancia">
            <input
              type="checkbox"
              checked={incluirSubabas}
              onChange={(evento) => {
                setIncluirSubabas(evento.target.checked);
                setPagina(0);
              }}
            />
            incluir subabas
          </label>
          {papel === 'administrador' && (
            <Link className="botao" to={`/novo${abaSelecionada ? `?aba=${abaSelecionada}` : ''}`}>
              + Parâmetro
            </Link>
          )}
        </div>

        {consultaParametros.isLoading ? (
          <Carregando />
        ) : consultaParametros.error ? (
          <ErroCarregamento erro={consultaParametros.error} />
        ) : (
          <>
            <TabelaParametros parametros={consultaParametros.data?.itens ?? []} />
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
      </section>
    </div>
  );
}
