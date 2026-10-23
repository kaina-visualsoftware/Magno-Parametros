import { useState } from 'react';

/**
 * Breadcrumb no formato do ERP + botão "copiar caminho".
 * O caminho é exibido como trilha (o objeto visual de assinatura do catálogo).
 */
export function Migalhas({ segmentos }: { segmentos: string[] }) {
  const [copiado, setCopiado] = useState(false);
  const caminho = segmentos.join(' > ');

  async function copiar() {
    try {
      await navigator.clipboard.writeText(caminho);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <div className="migalhas">
      <ol className="trilha">
        {segmentos.map((segmento, indice) => (
          <li key={`${indice}-${segmento}`} className={indice === segmentos.length - 1 ? 'atual' : ''}>
            {segmento}
          </li>
        ))}
      </ol>
      <button type="button" className="botao-icone" title="Copiar caminho completo" onClick={() => void copiar()}>
        {copiado ? 'copiado ✓' : 'copiar caminho'}
      </button>
    </div>
  );
}
