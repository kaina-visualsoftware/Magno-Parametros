import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAutenticacao } from '../aplicacao/autenticacao';
import { NoArvore, renomearAba } from '../servicos/catalogo';
import { Tela } from '../dominio/entidades';

interface Propriedades {
  telas: Tela[];
  /** Nós raiz (abas de primeiro nível) por tela. */
  raizes: Record<string, NoArvore[]>;
  abaSelecionadaId: string | null;
  aoSelecionar(abaId: string): void;
}

/** Encontra a cadeia de ancestrais de uma aba na árvore (para expandi-la). */
function caminhoAte(nos: NoArvore[], alvoId: string): string[] {
  for (const no of nos) {
    if (no.aba.id === alvoId) return [no.aba.id];
    const subcaminho = caminhoAte(no.filhos, alvoId);
    if (subcaminho.length > 0) return [no.aba.id, ...subcaminho];
  }
  return [];
}

export function Arvore({ telas, raizes, abaSelecionadaId, aoSelecionar }: Propriedades) {
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const { usuario, papel } = useAutenticacao();
  const consulta = useQueryClient();

  // Ao abrir um nó pelo URL, expande automaticamente todos os ancestrais.
  useEffect(() => {
    if (!abaSelecionadaId) return;
    let ancestrais: string[] = [];
    for (const lista of Object.values(raizes)) {
      const caminho = caminhoAte(lista, abaSelecionadaId);
      if (caminho.length > 0) {
        ancestrais = caminho;
        break;
      }
    }
    if (ancestrais.length > 0) {
      setAbertos((anterior) => {
        const novo = new Set(anterior);
        for (const id of ancestrais) novo.add(id);
        return novo;
      });
    }
  }, [abaSelecionadaId, raizes]);

  function alternar(id: string) {
    setAbertos((anterior) => {
      const novo = new Set(anterior);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  async function renomear(no: NoArvore) {
    const nome = window.prompt(
      'Novo nome da aba (o nome original importado será preservado):',
      no.aba.nome,
    );
    if (!nome || nome === no.aba.nome) return;
    await renomearAba({ abaId: no.aba.id, novoNome: nome, usuario: usuario?.email ?? null });
    await consulta.invalidateQueries();
  }

  function No({ no }: { no: NoArvore }) {
    const temFilhos = no.filhos.length > 0;
    const aberto = abertos.has(no.aba.id);
    const selecionado = no.aba.id === abaSelecionadaId;
    return (
      <li>
        <div className={`no-arvore${selecionado ? ' selecionado' : ''}`}>
          {temFilhos ? (
            <button
              type="button"
              className="alternador"
              aria-label={aberto ? 'Recolher' : 'Expandir'}
              aria-expanded={aberto}
              onClick={() => alternar(no.aba.id)}
            >
              {aberto ? '▾' : '▸'}
            </button>
          ) : (
            <span className="alternador vazio" aria-hidden="true" />
          )}
          <button
            type="button"
            className="nome-no"
            title={
              no.aba.nomeTruncadoNaTela
                ? `Nome truncado na captura de origem — original: ${no.aba.nomeOriginalImportado ?? ''}`
                : no.aba.caminho
            }
            onClick={() => aoSelecionar(no.aba.id)}
          >
            {no.aba.nome}
            {no.aba.nomeTruncadoNaTela && (
              <span className="aviso-truncado" title="Nome truncado na captura de origem">
                {' '}
                (truncado)
              </span>
            )}
          </button>
          <span className="contagem" title={`${no.contagemPropria} diretos · ${no.contagemTotal} no total`}>
            {no.contagemTotal}
          </span>
          {papel === 'administrador' && (
            <button
              type="button"
              className="botao-icone pequeno"
              title="Renomear aba (recalcula os caminhos dos descendentes)"
              onClick={() => void renomear(no)}
            >
              ✎
            </button>
          )}
        </div>
        {temFilhos && aberto && (
          <ul>
            {no.filhos.map((filho) => (
              <No key={filho.aba.id} no={filho} />
            ))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <nav className="arvore" aria-label="Árvore de telas e abas">
      {telas.length === 0 ? (
        <p className="vazio">Nenhuma tela importada ainda. Rode a importação.</p>
      ) : (
        telas.map((tela) => {
          const nos = raizes[tela.id] ?? [];
          return (
            <section key={tela.id} className="grupo-tela">
              <h3 className="titulo-tela" title={tela.prefixoCaminho}>
                {tela.nome}
              </h3>
              {nos.length === 0 ? (
                <p className="vazio">Sem abas.</p>
              ) : (
                <ul>
                  {nos.map((no) => (
                    <No key={no.aba.id} no={no} />
                  ))}
                </ul>
              )}
            </section>
          );
        })
      )}
    </nav>
  );
}
