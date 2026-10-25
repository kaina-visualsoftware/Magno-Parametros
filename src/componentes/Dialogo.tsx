import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function Dialogo({ titulo, children, fechar }: { titulo: string; children: ReactNode; fechar(): void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  // Capturado no render: o autoFocus do React já focou o campo interno antes do efeito.
  const [gatilho] = useState<HTMLElement | null>(() => document.activeElement as HTMLElement | null);
  useEffect(() => {
    const dialogo = ref.current!;
    const focoDoCampo = document.activeElement as HTMLElement | null;
    dialogo.showModal();
    // showModal foca o botão de fechar quando não há autoFocus; prefira o campo interno.
    const ativo = document.activeElement as HTMLElement | null;
    if (focoDoCampo && focoDoCampo !== gatilho && dialogo.contains(focoDoCampo)) {
      focoDoCampo.focus();
    } else if (!ativo || ativo === dialogo || ativo.hasAttribute('data-fechar') || !dialogo.contains(ativo)) {
      const primeiro = dialogo.querySelector<HTMLElement>('input, select, textarea')
        ?? dialogo.querySelector<HTMLElement>('button[type="button"]')
        ?? dialogo.querySelector<HTMLElement>('button');
      (primeiro ?? dialogo).focus();
    }
    return () => {
      dialogo.close();
      if (gatilho?.isConnected) gatilho.focus();
    };
  }, [gatilho]);
  return <dialog ref={ref} tabIndex={-1} className="dialogo flex flex-col max-h-[85dvh] overflow-hidden" aria-labelledby={id}
    onCancel={evento => { evento.preventDefault(); fechar(); }}>
    <div className="flex items-center justify-between gap-4 mb-4 shrink-0">
      <h2 id={id} className="!mb-0 text-xl">{titulo}</h2>
      <button type="button" className="botao-icone" data-fechar onClick={fechar} aria-label="Fechar diálogo"><X size={20} aria-hidden /></button>
    </div>
    <div className="min-h-0 overflow-y-auto pr-1">{children}</div>
  </dialog>;
}

type Pedido = { titulo: string; mensagem: string; valor?: string; resolver(valor: string | null): void };
type Solicitar = (mensagem: string, valor?: string) => Promise<string | null>;
const Contexto = createContext<Solicitar | null>(null);

/** Confirmações nativas assíncronas, com foco e cancelamento, sem bloquear a thread. */
export function ProvedorDialogos({ children }: { children: ReactNode }) {
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [texto, setTexto] = useState('');
  const pendente = useRef<Pedido | null>(null);
  useEffect(() => () => { pendente.current?.resolver(null); }, []);
  const solicitar: Solicitar = (mensagem, valor) => new Promise(resolve => {
    pendente.current?.resolver(null);
    const novo = { titulo: valor === undefined ? 'Confirmar ação' : 'Editar informação', mensagem, valor, resolver: resolve };
    pendente.current = novo;
    setTexto(valor ?? '');
    setPedido(novo);
  });
  function concluir(valor: string | null) {
    pedido?.resolver(valor);
    pendente.current = null;
    setPedido(null);
  }
  return <Contexto.Provider value={solicitar}>{children}{pedido &&
    <Dialogo titulo={pedido.titulo} fechar={() => concluir(null)}>
      <form onSubmit={e => { e.preventDefault(); concluir(pedido.valor === undefined ? 'sim' : texto.trim()); }}>
        <p className="whitespace-pre-line text-suave">{pedido.mensagem}</p>
        {pedido.valor !== undefined && <label className="campo"><span>Novo valor</span>
          <input autoFocus value={texto} maxLength={20000} onChange={e => setTexto(e.target.value)} /></label>}
        <div className="flex justify-end gap-3 mt-6"><button autoFocus={pedido.valor === undefined} type="button" className="botao fantasma" onClick={() => concluir(null)}>Cancelar</button>
          <button className="botao" type="submit">Confirmar</button></div>
      </form>
    </Dialogo>}
  </Contexto.Provider>;
}

export function useDialogos() {
  const solicitar = useContext(Contexto);
  if (!solicitar) throw new Error('ProvedorDialogos ausente');
  return {
    perguntar: solicitar,
    confirmar: async (mensagem: string) => (await solicitar(mensagem)) !== null,
  };
}
