import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

/** Botão compacto para copiar o caminho completo de um parâmetro. */
export function CopiarCaminho({ caminho }: { caminho: string }) {
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(caminho);
      setCopiado(true);
      setErro(false);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      setCopiado(false);
      setErro(true);
    }
  }

  return (
    <span className="inline-flex items-center gap-1"><button
      type="button"
      className="botao-icone pequeno"
      title={`Copiar caminho: ${caminho}`}
      aria-label={copiado ? 'Caminho copiado' : `Copiar caminho: ${caminho}`}
      onClick={() => void copiar()}
    >
      {copiado ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
    </button>{erro && <span role="alert" className="text-xs">Não foi possível copiar.</span>}</span>
  );
}
