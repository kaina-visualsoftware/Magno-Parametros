import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Carregando } from '../componentes/Estado';
import { ehAdministrador, useAutenticacao } from '../aplicacao/autenticacao';
import { importarCatalogoAtual } from '../servicos/catalogo';
import { RelatorioImportacao } from '../aplicacao/caso-uso-importar';
import { ConteudoFlat } from '../dominio/mapeador-arquivo';
import urlOrigem from '../../dados/origem/parametros_myc_flat.json?url';
import { useDialogos } from '../componentes/Dialogo';

/**
 * Importação com pré-visualização (dry-run) antes de confirmar.
 * O arquivo de origem embutido é o mesmo distribuído em dados/origem/.
 * Idempotente: rodar de novo não duplica nem sobrescreve edições manuais.
 */
export default function PaginaImportacao() {
  const { confirmar } = useDialogos();
  const consulta = useQueryClient();
  const { usuario, papel, carregando } = useAutenticacao();
  const [dryRun, setDryRun] = useState(true);
  const [usarArquivoEnviado, setUsarArquivoEnviado] = useState(false);
  const [conteudoEnviado, setConteudoEnviado] = useState<ConteudoFlat | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [relatorio, setRelatorio] = useState<RelatorioImportacao | null>(null);
  const [erro, setErro] = useState('');
  const referenciaArquivo = useRef<HTMLInputElement>(null);

  const executar = useMutation({
    mutationFn: async () => {
      let dados = conteudoEnviado;
      if (!usarArquivoEnviado) {
        const resposta = await fetch(urlOrigem);
        if (!resposta.ok) throw new Error('Não foi possível carregar o arquivo de origem.');
        dados = await resposta.json() as ConteudoFlat;
      }
      if (!dados || !Array.isArray(dados.parametros)) throw new Error('Selecione um arquivo de origem válido.');
      return importarCatalogoAtual(dados, { dryRun, usuario: usuario?.email ?? null });
    },
    onSuccess: async (resultado) => {
      setRelatorio(resultado);
      setErro('');
      if (!resultado.dryRun) await Promise.all(['parametros','parametro','arvore','abas','telas','tipos','historico'].map(chave => consulta.invalidateQueries({ queryKey: [chave] })));
    },
    onError: (causa) => setErro(causa instanceof Error ? causa.message : String(causa)),
  });

  async function aoEscolherArquivo(evento: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    if (!arquivo) return;
    try {
      const dados = JSON.parse(await arquivo.text()) as ConteudoFlat;
      if (!Array.isArray(dados.parametros)) throw new Error('estrutura inesperada');
      setConteudoEnviado(dados);
      setNomeArquivo(arquivo.name);
      setErro('');
    } catch {
      setConteudoEnviado(null);
      setNomeArquivo('');
      setErro('Arquivo JSON inválido (esperado o formato de parametros_myc_flat.json).');
    }
  }

  if (carregando) return <Carregando />;
  if (!ehAdministrador(papel)) {
    return (
      <p className="erro">
        A importação é exclusiva de administradores. <Link to="/entrar">Entrar</Link>
      </p>
    );
  }

  return (
    <div className="pagina-importacao">
      <h1>Importação de parâmetros</h1>
      <p className="dica">
        A importação é <strong>idempotente</strong>: identifica cada parâmetro pelo <code>id</code> e
        pelo hash dos campos de origem. Nunca apaga itens ausentes no arquivo e nunca sobrescreve
        campos editados por pessoas (divergências viram <strong>conflitos</strong> para revisão).
      </p>

      {erro && <p className="erro">{erro}</p>}

      <form
        className="cartao"
        onSubmit={async (evento) => {
          evento.preventDefault();
          if (!dryRun && !await confirmar('Executar importação e gravar alterações? Revise a pré-visualização antes de continuar.')) return;
          executar.mutate();
        }}
      >
        <fieldset className="campo">
          <legend>Fonte dos dados</legend>
          <label className="alternancia">
            <input
              type="radio"
              name="fonte"
              checked={!usarArquivoEnviado}
              onChange={() => setUsarArquivoEnviado(false)}
            />
            Arquivo de origem embutido (dados/origem/parametros_myc_flat.json)
          </label>
          <label className="alternancia">
            <input
              type="radio"
              name="fonte"
              checked={usarArquivoEnviado}
              onChange={() => setUsarArquivoEnviado(true)}
            />
            Enviar outro arquivo JSON plano
          </label>
          {usarArquivoEnviado && (
            <div className="linha-tags">
              <input
                ref={referenciaArquivo}
                type="file"
                accept=".json,application/json"
                onChange={(evento) => void aoEscolherArquivo(evento)}
              />
              {nomeArquivo && <span className="dica">carregado: {nomeArquivo}</span>}
            </div>
          )}
        </fieldset>

        <label className="alternancia">
          <input type="checkbox" checked={dryRun} onChange={(evento) => setDryRun(evento.target.checked)} />
          Pré-visualização (dry-run) — calcula o relatório sem gravar nada
        </label>

        <button type="submit" className="botao primario" disabled={executar.isPending || (usarArquivoEnviado && !conteudoEnviado)}>
          {executar.isPending ? 'Processando…' : dryRun ? 'Pré-visualizar importação' : 'Executar importação'}
        </button>
      </form>

      {relatorio && (
        <section className="cartao relatorio-importacao">
          <h2>
            Relatório {relatorio.dryRun ? '(pré-visualização — nada foi gravado)' : '(executado)'}
          </h2>
          <dl className="grade-totais">
            <div>
              <dt>Parâmetros lidos</dt>
              <dd>{relatorio.totalLido}</dd>
            </div>
            <div>
              <dt>Novos</dt>
              <dd>{relatorio.novos}</dd>
            </div>
            <div>
              <dt>Alterados na origem</dt>
              <dd>{relatorio.alterados}</dd>
            </div>
            <div>
              <dt>Inalterados</dt>
              <dd>{relatorio.inalterados}</dd>
            </div>
            <div>
              <dt>Conflitos</dt>
              <dd>{relatorio.conflitos.length}</dd>
            </div>
            <div>
              <dt>Telas novas</dt>
              <dd>{relatorio.telasNovas}</dd>
            </div>
            <div>
              <dt>Abas novas</dt>
              <dd>{relatorio.abasNovas}</dd>
            </div>
            <div>
              <dt>Tipos novos</dt>
              <dd>{relatorio.tiposNovos.length}</dd>
            </div>
          </dl>

          {relatorio.tiposNovos.length > 0 && (
            <p>
              Tipos criados automaticamente: <code>{relatorio.tiposNovos.join(', ')}</code>
            </p>
          )}
          {relatorio.conflitos.length > 0 && (
            <div>
              <h3>Conflitos (decisão humana)</h3>
              <p className="dica">
                Estes parâmetros foram editados manualmente na origem e também mudaram no arquivo.
                Eles NÃO foram sobrescritos. Revise cada um na tela de detalhe.
              </p>
              <ul>
                {relatorio.conflitos.map((idItem) => (
                  <li key={idItem}>
                    <Link to={`/parametro/${idItem}`}>{idItem}</Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {relatorio.naoEncontradosNaOrigem.length > 0 && (
            <div>
              <h3>Não encontrados na origem (preservados)</h3>
              <ul>
                {relatorio.naoEncontradosNaOrigem.map((idItem) => (
                  <li key={idItem}>{idItem}</li>
                ))}
              </ul>
            </div>
          )}
          {relatorio.alertas.length > 0 && (
            <div>
              <h3>Alertas</h3>
              <ul className="lista-alertas">
                {relatorio.alertas.map((alerta, indice) => (
                  <li key={indice}>{alerta}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
