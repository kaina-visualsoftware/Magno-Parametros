import { useState } from 'react';
import { Bug } from 'lucide-react';
import { Dialogo } from './Dialogo';

interface ReportarProblemaProps {
  aberto: boolean;
  fechar(): void;
  usuario?: string;
}

export function ReportarProblema({ fechar, usuario }: ReportarProblemaProps) {
  const [descricao, setDescricao] = useState('');
  const [urlParametro, setUrlParametro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const titulo = urlParametro
      ? `Sugestão de parâmetro: ${urlParametro}`
      : 'Sugestão de parâmetro ou correção';

    const corpo = [
      `**Descrição:** ${descricao}`,
      '',
      usuario ? `**Usuário:** ${usuario}` : '',
      urlParametro ? `**URL do parâmetro:** ${urlParametro}` : '',
      '',
      '---',
      '',
      'Este é um relatório enviado pelo catálogo de parâmetros do MyCommerce.',
    ].filter(Boolean).join('\n');

    setEnviando(true);

    try {
      const response = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_GITHUB_TOKEN}`,
        },
        body: JSON.stringify({
          query: `
            mutation createIssue($input: CreateIssueInput!) {
              createIssue(input: $input) {
                issue {
                  id
                  number
                  title
                  url
                }
              }
            }
          `,
          variables: {
            input: {
              repositoryOwner: 'kaina-visualsoftware',
              repositoryName: 'Myc.config',
              title: titulo,
              body: corpo,
              labels: ['bug', 'enhancement', 'catalogo'],
            },
          },
        }),
      });

      const data = await response.json();

      if (data.errors) {
        throw new Error(data.errors.map((e: any) => e.message).join(', '));
      }

      alert('Issue criado com sucesso! Você será redirecionado para a issue no GitHub.');
      setDescricao('');
      setUrlParametro('');
      fechar();
    } catch (erro) {
      console.error('Erro ao criar issue:', erro);
      alert(`Erro ao criar issue: ${(erro as Error).message}. Por favor, tente novamente ou abra manualmente um issue no GitHub.`);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialogo titulo="Reportar problema ou sugerir parâmetro" fechar={fechar}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="dica">
          Use este botão para solicitar a adição de novos parâmetros ou para corrigir parâmetros existentes que estão incorretos ou incompletos.
        </p>

        <div className="campo">
          <label htmlFor="descricao">Descrição do problema ou sugestão *</label>
          <textarea
            id="descricao"
            required
            rows={4}
            placeholder="Descreva o parâmetro, o problema encontrado ou a sugestão..."
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className="min-h-[100px]"
          />
        </div>

        <div className="campo">
          <label htmlFor="url-parametro">URL do parâmetro (opcional)</label>
          <input
            id="url-parametro"
            type="text"
            placeholder="Ex: MyCommerce > Financeiro > Configuração > Orçamento"
            value={urlParametro}
            onChange={(e) => setUrlParametro(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-2 mt-2">
          <button type="button" className="botao fantasma" onClick={fechar}>
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!descricao.trim() || enviando}
            className="botao"
          >
            {enviando ? 'Enviando...' : (
              <>
                <Bug size={16} aria-hidden />Enviar para GitHub Issues
              </>
            )}
          </button>
        </div>
      </form>
    </Dialogo>
  );
}
