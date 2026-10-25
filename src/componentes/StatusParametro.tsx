import { StatusDocumentacao } from '../dominio/entidades';

const rotulos = { pendente: 'Pendente', documentado: 'Documentado', revisado: 'Revisado' };
export function StatusParametro({ status }: { status: StatusDocumentacao }) {
  return <span className={`status-ponto ${status}`}>{rotulos[status]}</span>;
}
