import { useEffect, useRef, useState } from 'react';
import { Maximize2, Minus, Plus, RotateCcw, X } from 'lucide-react';

interface VisualizadorImagemProps {
  src: string;
  alt: string;
}

const MIN_ZOOM = 100;
const MAX_ZOOM = 400;
const PASSO = 25;

/** Visualizador nativo acessível: Escape, controles de zoom e arraste da área ampliada. */
export function VisualizadorImagem({ src, alt }: VisualizadorImagemProps) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const arraste = useRef<{ x: number; y: number; esquerda: number; topo: number } | null>(null);

  function abrir() {
    setZoom(MIN_ZOOM);
    dialogo.current?.showModal();
  }

  function fechar() {
    dialogo.current?.close();
  }

  function alterarZoom(valor: number) {
    setZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, valor)));
  }

  function aoIniciarArraste(evento: React.PointerEvent<HTMLDivElement>) {
    if (evento.pointerType !== 'mouse' || evento.button !== 0 || zoom === MIN_ZOOM) return;
    const elemento = area.current;
    if (!elemento) return;
    arraste.current = { x: evento.clientX, y: evento.clientY, esquerda: elemento.scrollLeft, topo: elemento.scrollTop };
    elemento.setPointerCapture(evento.pointerId);
  }

  function aoArrastar(evento: React.PointerEvent<HTMLDivElement>) {
    if (!arraste.current || !area.current) return;
    area.current.scrollLeft = arraste.current.esquerda - (evento.clientX - arraste.current.x);
    area.current.scrollTop = arraste.current.topo - (evento.clientY - arraste.current.y);
  }

  function terminarArraste() { arraste.current = null; }

  useEffect(() => {
    if (area.current) {
      area.current.scrollLeft = 0;
      area.current.scrollTop = 0;
    }
  }, [src]);

  return <>
    <button className="visualizador-miniatura" type="button" onClick={abrir}
      aria-label="Ampliar imagem do parâmetro" title="Ampliar imagem dentro do site">
      <img className="imagem-destacada" src={src} alt={alt} loading="lazy" />
      <span className="visualizador-indicador"><Maximize2 size={15} aria-hidden /> Ampliar</span>
    </button>
    <dialog ref={dialogo} className="visualizador-dialogo"
      aria-label="Visualizador de imagem do parâmetro"
      onClose={() => { setZoom(MIN_ZOOM); terminarArraste(); }}
      onClick={evento => { if (evento.target === evento.currentTarget) fechar(); }}>
      <div className="visualizador-painel">
        <div className="visualizador-barra">
          <strong className="text-sm">Imagem do parâmetro</strong>
          <div className="visualizador-controles" aria-label="Controles de zoom">
            <button type="button" className="botao-icone" disabled={zoom <= MIN_ZOOM}
              aria-label="Diminuir zoom" onClick={() => alterarZoom(zoom - PASSO)}><Minus size={19} aria-hidden /></button>
            <output aria-live="polite" className="visualizador-percentual">{zoom}%</output>
            <button type="button" className="botao-icone" disabled={zoom >= MAX_ZOOM}
              aria-label="Aumentar zoom" onClick={() => alterarZoom(zoom + PASSO)}><Plus size={19} aria-hidden /></button>
            <button type="button" className="botao-icone" aria-label="Restaurar zoom"
              onClick={() => alterarZoom(MIN_ZOOM)}><RotateCcw size={18} aria-hidden /></button>
            <button type="button" className="botao-icone" aria-label="Fechar visualizador"
              onClick={fechar}><X size={21} aria-hidden /></button>
          </div>
        </div>
        <div className="visualizador-area" ref={area} tabIndex={0}
          aria-label="Imagem ampliada. Use a rolagem para explorar ou arraste com o mouse quando ampliada."
          onPointerDown={aoIniciarArraste} onPointerMove={aoArrastar}
          onPointerUp={terminarArraste} onPointerCancel={terminarArraste}
          onLostPointerCapture={terminarArraste}>
          <img src={src} alt={alt} draggable={false}
            style={{ width: `${zoom}%`, maxWidth: 'none', height: 'auto' }} />
        </div>
        <p className="visualizador-ajuda">Use + e − para ampliar ou reduzir. Arraste a imagem ampliada ou use a rolagem. Pressione Esc para fechar.</p>
      </div>
    </dialog>
  </>;
}
