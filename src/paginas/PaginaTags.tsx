import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Carregando, ErroCarregamento } from '../componentes/Estado';
import {
  criarTag,
  listarTags,
  mesclarTags,
  renomearTag,
} from '../servicos/catalogo';
import { ehAdministrador, podeEditarDocumentacao, useAutenticacao } from '../aplicacao/autenticacao';

export default function PaginaTags() {
  const { usuario, papel } = useAutenticacao();
  const podeEditar = podeEditarDocumentacao(papel);
  const admin = ehAdministrador(papel);
  const consulta = useQueryClient();

  const consultaTags = useQuery({ queryKey: ['tags'], queryFn: listarTags });
  const [nome, setNome] = useState('');
  const [origem, setOrigem] = useState('');
  const [destino, setDestino] = useState('');
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  const criar = useMutation({
    mutationFn: () => criarTag(nome.trim()),
    onSuccess: async () => {
      setNome('');
      setErro('');
      await consulta.invalidateQueries({ queryKey: ['tags'] });
    },
    onError: (causa) => setErro(causa instanceof Error ? causa.message : String(causa)),
  });

  const mesclar = useMutation({
    mutationFn: () => mesclarTags(origem, destino, usuario?.email ?? null),
    onSuccess: async () => {
      setOrigem('');
      setDestino('');
      setMensagem('Tags mescladas: os vínculos foram movidos e o histórico registrado.');
      await consulta.invalidateQueries();
    },
    onError: (causa) => {
      setMensagem('');
      setErro(causa instanceof Error ? causa.message : String(causa));
    },
  });

  async function renomear(id: string, nomeAtual: string) {
    const novoNome = window.prompt('Novo nome da tag (o slug permanece o mesmo):', nomeAtual);
    if (!novoNome || novoNome === nomeAtual) return;
    await renomearTag(id, novoNome);
    await consulta.invalidateQueries({ queryKey: ['tags'] });
  }

  const tags = consultaTags.data ?? [];

  return (
    <div className="pagina-tags">
      <h1>Tags</h1>
      <p className="dica">
        A classificação por tags agrupa parâmetros de qualquer parte do sistema — por exemplo, a
        tag <code>orcamento</code> reúne todos os parâmetros de Orçamento, de qualquer aba.
      </p>

      {erro && <p className="erro">{erro}</p>}
      {mensagem && <p className="mensagem-sucesso">{mensagem}</p>}

      {podeEditar && (
        <form
          className="barra-filtros"
          onSubmit={(evento) => {
            evento.preventDefault();
            if (nome.trim()) criar.mutate();
          }}
        >
          <input
            type="text"
            value={nome}
            onChange={(evento) => setNome(evento.target.value)}
            placeholder="Nova tag (ex.: Orçamento — acentos e maiúsculas são normalizados)"
            aria-label="Nome da nova tag"
          />
          <button type="submit" className="botao" disabled={!nome.trim() || criar.isPending}>
            Criar tag
          </button>
        </form>
      )}

      {consultaTags.isLoading ? (
        <Carregando />
      ) : consultaTags.error ? (
        <ErroCarregamento erro={consultaTags.error} />
      ) : tags.length === 0 ? (
        <p className="vazio">Nenhuma tag criada ainda.</p>
      ) : (
        <table className="tabela">
          <thead>
            <tr>
              <th>Tag</th>
              <th>Slug</th>
              <th>Parâmetros vinculados</th>
              {admin && <th>Ações</th>}
            </tr>
          </thead>
          <tbody>
            {tags.map((tag) => (
              <tr key={tag.id}>
                <td>
                  <Link className="link-parametro" to={`/tag/${tag.slug}`}>
                    {tag.nome}
                  </Link>
                </td>
                <td className="texto-mono">{tag.slug}</td>
                <td>{tag.totalVinculos}</td>
                {admin && (
                  <td>
                    <button
                      type="button"
                      className="botao-icone pequeno"
                      onClick={() => void renomear(tag.id, tag.nome)}
                    >
                      renomear
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {admin && tags.length >= 2 && (
        <section className="cartao">
          <h2>Mesclar tags</h2>
          <p className="dica">
            Todos os vínculos da tag de origem são movidos para a de destino, sem duplicar, e a
            ação fica registrada no histórico.
          </p>
          <div className="linha-tags">
            <select value={origem} onChange={(evento) => setOrigem(evento.target.value)} aria-label="Tag de origem">
              <option value="">Origem (será excluída)…</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.nome}
                </option>
              ))}
            </select>
            <select value={destino} onChange={(evento) => setDestino(evento.target.value)} aria-label="Tag de destino">
              <option value="">Destino (recebe os vínculos)…</option>
              {tags
                .filter((tag) => tag.id !== origem)
                .map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.nome}
                  </option>
                ))}
            </select>
            <button
              type="button"
              className="botao perigo"
              disabled={!origem || !destino || mesclar.isPending}
              onClick={() => {
                if (window.confirm('Mesclar as tags? A tag de origem será excluída.')) mesclar.mutate();
              }}
            >
              Mesclar
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
