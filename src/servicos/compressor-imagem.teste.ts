import { describe, expect, it } from 'vitest';
import { escolherMenor, formatarTamanho, LIMITE_UPLOAD } from './compressor-imagem';

const arquivo = (tamanho: number) => new File([new Uint8Array(tamanho)], 'captura.png', { type: 'image/png' });

describe('Compressão de imagem', () => {
  it('seleciona WebP menor e mantém nome/formatos corretos', () => {
    const origem = arquivo(200_000);
    const resultado = escolherMenor(origem, new Blob([new Uint8Array(60_000)], { type: 'image/webp' }));
    expect(resultado.comprimida).toBe(true);
    expect(resultado.arquivo.name).toBe('captura.webp');
    expect(resultado.arquivo.type).toBe('image/webp');
    expect(resultado.arquivo.size).toBe(60_000);
    expect(resultado.tamanhoOriginal).toBe(200_000);
  });

  it('não substitui PNG menor por WebP maior', () => {
    const origem = arquivo(100);
    expect(escolherMenor(origem, new Blob([new Uint8Array(200)], { type: 'image/webp' })).arquivo).toBe(origem);
  });

  it('aceita original abaixo do limite se navegador não suporta WebP', () => {
    expect(escolherMenor(arquivo(1000), null).comprimida).toBe(false);
  });

  it('recusa arquivos que não foram reduzidos ao limite final', () => {
    expect(() => escolherMenor(arquivo(LIMITE_UPLOAD + 1), null)).toThrow(/5 MB/);
  });

  it('formata tamanhos para comparação', () => {
    expect(formatarTamanho(1024 * 1024)).toBe('1.00 MB');
  });
});
