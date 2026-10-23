import { Link } from 'react-router-dom';

export default function PaginaNaoEncontrada() {
  return (
    <div className="pagina-404">
      <h1>Caminho não encontrado</h1>
      <p>O endereço acessado não existe neste catálogo.</p>
      <Link className="botao" to="/">
        Voltar ao catálogo
      </Link>
    </div>
  );
}
