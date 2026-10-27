import { describe, expect, it } from 'vitest';
import { construirUrlIssue } from './ReportarProblema';

describe('URL alternativa de sugestões', () => {
  it('inclui informações no link do GitHub', () => {
    const url = new URL(construirUrlIssue('Corrigir informação da tela', 'Produtos > Mais'));
    expect(url.hostname).toBe('github.com');
    expect(url.searchParams.get('title')).toContain('Produtos > Mais');
    expect(url.searchParams.get('body')).toContain('Corrigir informação da tela');
  });
});
