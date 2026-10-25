import { CopiarCaminho } from './CopiarCaminho';

/**
 * Breadcrumb no formato do ERP + botão "copiar caminho".
 * O caminho é exibido como trilha (o objeto visual de assinatura do catálogo).
 */
export function Migalhas({ segmentos }: { segmentos: string[] }) {
  const caminho = segmentos.join(' > ');

  return (
    <div className="migalhas">
      <ol className="trilha flex-1">
        {segmentos.map((segmento, indice) => (
          <li key={`${indice}-${segmento}`} className={indice === segmentos.length - 1 ? 'atual' : ''}>
            {segmento}
          </li>
        ))}
      </ol>
      <CopiarCaminho caminho={caminho} />
    </div>
  );
}
