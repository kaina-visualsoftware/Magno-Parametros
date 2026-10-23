import { useState } from 'react';

/** Botão compacto para copiar o caminho completo de um parâmetro. */
export function CopiarCaminho({ caminho }: { caminho: string }) {
  const [copiado, setCopiado] = useState(false);

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
    <button
      type="button"
      className="botao-icone pequeno"
      title={`Copiar caminho: ${caminho}`}
      onClick={() => void copiar()}
    >
      {copiado ? 'copiado ✓' : 'copiar'}
    </button>
  );
}
