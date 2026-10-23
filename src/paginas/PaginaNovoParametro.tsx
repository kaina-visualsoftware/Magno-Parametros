import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { calcularCaminhoParametro } from '../dominio/calculadora-caminho';
import { tipoExigeOpcoes } from '../dominio/tipos-parametro';
import { ehAdministrador, useAutenticacao } from '../aplicacao/autenticacao';
import { criarParametro, listarAbas, listarTipos, listarTelas } from '../servicos/catalogo';
import { Aba } from '../dominio/entidades';

export default function PaginaNovoParametro() {
  const { usuario, papel } = useAutenticacao();
  const navegar = useNavigate();
  const consulta = useQueryClient();
  const [parametrosUrl] = useSearchParams();

  const [abaId, setAbaId] = useState(parametrosUrl.get('aba') ?? '');
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState('checkbox');
  const [grupo, setGrupo] = useState('');
  const [opcoesTexto, setOpcoesTexto] = useState('');
  const [erro, setErro] = useState('');

  const telas = useQuery({ queryKey: ['telas'], queryFn: listarTelas });
  const abas = useQuery({ queryKey: ['abas'], queryFn: listarAbas });
  const tipos = useQuery({ queryKey: ['tipos'], queryFn: listarTipos });

  const abaSelecionada = useMemo<Aba | null>(
    () => (abas.data ?? []).find((aba) => aba.id === abaId) ?? null,
    [abas.data, abaId],
  );

  // Profundidade de cada aba (para indentar o seletor hierárquico).
  const profundidades = useMemo(() => {
    const mapa = new Map<string, number>();
    const porId = new Map((abas.data ?? []).map((aba) => [aba.id, aba]));
    for (const aba of abas.data ?? []) {
      let profundidade = 0;
      let atual: Aba | undefined = aba;
      while (atual?.abaPaiId) {
        profundidade++;
        atual = porId.get(atual.abaPaiId);
      }
      mapa.set(aba.id, profundidade);
    }
    return mapa;
  }, [abas.data]);

  // Pré-visualização em tempo real do caminho resultante (nunca digitado).
  const caminhoPrevisto = useMemo(() => {
    if (!abaSelecionada || !abas.data || !telas.data) return null;
    const porId = new Map((abas.data ?? []).map((aba) => [aba.id, aba]));
    const nomes: string[] = [];
    let atual: Aba | null = abaSelecionada;
    while (atual) {
      nomes.unshift(atual.nome);
      atual = atual.abaPaiId ? (porId.get(atual.abaPaiId) ?? null) : null;
    }
    const tela = telas.data.find((t) => t.id === abaSelecionada.telaId) ?? null;
    return calcularCaminhoParametro(
      tela?.prefixoCaminho ?? '',
      nomes,
      nome.trim() || '«nome do parâmetro»',
    );
  }, [abaSelecionada, abas.data, telas.data, nome]);

  const criar = useMutation({
    mutationFn: () =>
      criarParametro({
        abaId,
        nome: nome.trim(),
        tipo,
        opcoes: opcoesTexto
          .split('\n')
          .map((linha) => linha.trim())
          .filter(Boolean),
        grupo: grupo.trim(),
        usuario: usuario?.email ?? null,
      }),
    onSuccess: async (parametro) => {
      await consulta.invalidateQueries();
      navegar(`/parametro/${parametro.id}`);
    },
    onError: (causa) => setErro(causa instanceof Error ? causa.message : String(causa)),
  });

  if (!usuario) {
    return (
      <p className="erro">
        Entrar como <strong>administrador</strong> é obrigatório para criar parâmetros.{' '}
        <Link to="/entrar">Entrar</Link>
      </p>
    );
  }
  if (!ehAdministrador(papel)) {
    return (
      <p className="erro">
        A criação de parâmetros é exclusiva de administradores.{' '}
        <Link to="/entrar">Entrar com conta de administrador</Link>
      </p>
    );
  }

  return (
    <div className="pagina-formulario">
      <h1>Novo parâmetro</h1>
      <p className="dica">
        O caminho completo é derivado da aba escolhida — nunca digitado. O parâmetro nasce como{' '}
        <strong>pendente de documentação</strong>.
      </p>

      {erro && <p className="erro">{erro}</p>}

      <form
        className="cartao formulario"
        onSubmit={(evento) => {
          evento.preventDefault();
          criar.mutate();
        }}
      >
        <label className="campo">
          <span>Aba (local no ERP)</span>
          <select
            value={abaId}
            onChange={(evento) => setAbaId(evento.target.value)}
            aria-label="Selecione a aba"
            required
          >
            <option value="">Selecione…</option>
            {(telas.data ?? []).map((tela) => {
              const daTela = (abas.data ?? []).filter((aba) => aba.telaId === tela.id);
              if (daTela.length === 0) return null;
              return (
                <optgroup key={tela.id} label={tela.nome}>
                  {daTela.map((aba) => (
                    <option key={aba.id} value={aba.id}>
                      {'— '.repeat(profundidades.get(aba.id) ?? 0)}
                      {aba.nome}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </label>

        <label className="campo">
          <span>Nome (rótulo exatamente como aparece na tela)</span>
          <input
            type="text"
            value={nome}
            onChange={(evento) => setNome(evento.target.value)}
            required
          />
        </label>

        <label className="campo">
          <span>Tipo</span>
          <select value={tipo} onChange={(evento) => setTipo(evento.target.value)}>
            {(tipos.data ?? []).map((tipoParametro) => (
              <option key={tipoParametro.codigo} value={tipoParametro.codigo}>
                {tipoParametro.codigo}
              </option>
            ))}
          </select>
        </label>

        {tipoExigeOpcoes(tipo) && (
          <label className="campo">
            <span>Opções (uma por linha)</span>
            <textarea
              rows={4}
              value={opcoesTexto}
              onChange={(evento) => setOpcoesTexto(evento.target.value)}
              placeholder={'Opção 1\nOpção 2'}
            />
          </label>
        )}

        <label className="campo">
          <span>Grupo (quadro da tela onde o parâmetro aparece)</span>
          <input type="text" value={grupo} onChange={(evento) => setGrupo(evento.target.value)} />
        </label>

        {caminhoPrevisto && (
          <p className="previa-caminho">
            <span>Caminho resultante:</span> {caminhoPrevisto}
          </p>
        )}

        <button type="submit" className="botao primario" disabled={criar.isPending || !abaId}>
          {criar.isPending ? 'Salvando…' : 'Criar parâmetro'}
        </button>
      </form>
    </div>
  );
}
