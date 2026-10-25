import { useState } from 'react';
import { X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Tag } from '../dominio/entidades';
import { aplicarTag, criarTag, removerTag } from '../servicos/catalogo';

interface Propriedades {
  parametroId: string;
  tagsVinculadas: Tag[];
  todasTags: Tag[];
  podeEditar: boolean;
}

/**
 * Editor de vínculos tag ↔ parâmetro. Criar/aplicar/remover — as sugestões
 * automáticas ficam para a fase 2 (nunca são aplicadas sozinhas).
 */
export function EditorTags({ parametroId, tagsVinculadas, todasTags, podeEditar }: Propriedades) {
  const consulta = useQueryClient();
  const [idSelecionada, setIdSelecionada] = useState('');
  const [novaTag, setNovaTag] = useState('');
  const [erro, setErro] = useState('');

  async function invalidar() {
    await consulta.invalidateQueries({ queryKey: ['parametro-tags', parametroId] });
    await consulta.invalidateQueries({ queryKey: ['parametros'] });
    await consulta.invalidateQueries({ queryKey: ['parametro', parametroId] });
    await consulta.invalidateQueries({ queryKey: ['tags'] });
  }

  const aplicar = useMutation({
    mutationFn: async (tagId: string) => {
      await aplicarTag(parametroId, tagId);
    },
    onSuccess: () => {
      setIdSelecionada('');
      setErro('');
      void invalidar();
    },
    onError: (causa) => setErro(causa instanceof Error ? causa.message : String(causa)),
  });

  const remover = useMutation({
    mutationFn: async (tagId: string) => {
      await removerTag(parametroId, tagId);
    },
    onSuccess: () => void invalidar(),
    onError: (causa) => setErro(causa instanceof Error ? causa.message : String(causa)),
  });

  const criarEAplicar = useMutation({
    mutationFn: async (nome: string) => {
      const tag = await criarTag(nome);
      await aplicarTag(parametroId, tag.id);
    },
    onSuccess: () => {
      setNovaTag('');
      setErro('');
      void invalidar();
    },
    onError: (causa) => setErro(causa instanceof Error ? causa.message : String(causa)),
  });

  if (!podeEditar) {
    if (tagsVinculadas.length === 0) return <p className="vazio">Sem tags vinculadas.</p>;
    return (
      <ul className="chips">
        {tagsVinculadas.map((tag) => (
          <li key={tag.id} className="chip">
            {tag.nome}
          </li>
        ))}
      </ul>
    );
  }

  const idsVinculadas = new Set(tagsVinculadas.map((tag) => tag.id));
  const disponiveis = todasTags.filter((tag) => !idsVinculadas.has(tag.id));

  return (
    <div className="editor-tags">
      {tagsVinculadas.length === 0 ? (
        <p className="vazio">Sem tags vinculadas.</p>
      ) : (
        <ul className="chips">
          {tagsVinculadas.map((tag) => (
            <li key={tag.id} className="chip">
              {tag.nome}
              <button
                type="button"
                className="remover-chip"
                title={`Remover tag ${tag.nome}`}
                aria-label={`Remover tag ${tag.nome}`}
                onClick={() => remover.mutate(tag.id)}
                disabled={remover.isPending}
              >
                <X size={16} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="linha-tags">
        <select
          value={idSelecionada}
          onChange={(evento) => setIdSelecionada(evento.target.value)}
          aria-label="Aplicar tag existente"
        >
          <option value="">Aplicar tag existente…</option>
          {disponiveis.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.nome}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="botao"
          disabled={!idSelecionada || aplicar.isPending}
          onClick={() => aplicar.mutate(idSelecionada)}
        >
          Aplicar
        </button>
      </div>

      <div className="linha-tags">
        <input
          type="text"
          value={novaTag}
          onChange={(evento) => setNovaTag(evento.target.value)}
          placeholder="Criar nova tag (ex.: orçamento)"
          aria-label="Nome da nova tag"
        />
        <button
          type="button"
          className="botao fantasma"
          disabled={!novaTag.trim() || criarEAplicar.isPending}
          onClick={() => criarEAplicar.mutate(novaTag.trim())}
        >
          Criar e aplicar
        </button>
      </div>

      {erro && <p className="erro">{erro}</p>}
    </div>
  );
}
