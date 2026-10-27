/**
 * Melhoria: localizar cada parâmetro cadastrado na captura de tela de origem
 * e gerar um recorte com retângulo vermelho em volta dele.
 *
 *   npm run marcar-imagens [-- --limite N] [-- --imagem nome.png] [-- --recarregar]
 *
 * Pipeline: OCR (tesseract.js) → correspondência do rótulo (janela de palavras,
 * com variantes "grupo: item" e junção de linhas vizinhas) → destaque com
 * retângulo vermelho (sharp) → recorte com contexto → public/imagens-parametro/
 * → parametros.imagem_marcada = true no banco (conexão direta).
 */

import { createWorker } from 'tesseract.js';
import sharp from 'sharp';
import { Pool } from 'pg';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { carregarAmbiente } from './ambiente';
import { removerAcentos } from '../src/dominio/normalizador';

carregarAmbiente();

const PASTA_BUSCA = process.env.PASTA_IMAGENS ?? 'dados/imagens-origem';
const PASTA_CACHE = 'dados/ocr-cache';
const PASTA_SAIDA = 'public/imagens-parametro';
const COR_RETANGULO = '#e11d1d';
const NOTA_MINIMA = 0.8;

const argumentos = process.argv.slice(2);
const valorDeOpcao = (nome: string): string | undefined => {
  const indice = argumentos.indexOf(`--${nome}`);
  return indice >= 0 ? argumentos[indice + 1] : undefined;
};
const recarregar = argumentos.includes('--recarregar');
const limite = Number(valorDeOpcao('limite') ?? Number.POSITIVE_INFINITY);
const imagemEspecifica = valorDeOpcao('imagem');

interface Caixa {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface PalavraOcr {
  texto: string;
  caixa: Caixa;
}

interface LinhaOcr {
  texto: string;
  palavras: PalavraOcr[];
  caixa: Caixa;
}

interface Candidato {
  caixa: Caixa;
  nota: number;
  linhasUsadas: number[];
}

function normalizar(texto: string): string {
  return removerAcentos(texto.toLowerCase()).replace(/[^a-z0-9]+/g, ' ').trim();
}

function acharArquivoRecursivo(pasta: string, nomeArquivo: string): string | null {
  for (const entrada of readdirSync(pasta, { withFileTypes: true })) {
    const caminho = join(pasta, entrada.name);
    if (entrada.isDirectory()) {
      const achado = acharArquivoRecursivo(caminho, nomeArquivo);
      if (achado) return achado;
    } else if (entrada.name === nomeArquivo) {
      return caminho;
    }
  }
  return null;
}

/** Extrai as linhas do resultado do OCR (com posição de cada palavra). */
function extrairLinhas(dados: unknown): LinhaOcr[] {
  const linhas: LinhaOcr[] = [];
  const raiz = dados as {
    blocks?: Array<{
      paragraphs?: Array<{
        lines?: Array<{
          text?: string;
          bbox?: Caixa;
          words?: Array<{ text?: string; bbox?: Caixa }>;
        }>;
      }>;
    }>;
  };
  for (const bloco of raiz.blocks ?? []) {
    for (const paragrafo of bloco.paragraphs ?? []) {
      for (const linha of paragrafo.lines ?? []) {
        const palavras = (linha.words ?? [])
          .filter((palavra) => palavra.text && palavra.bbox)
          .map((palavra) => ({ texto: String(palavra.text), caixa: palavra.bbox as Caixa }));
        const caixa =
          linha.bbox ??
          (palavras.length > 0
            ? {
                x0: Math.min(...palavras.map((p) => p.caixa.x0)),
                y0: Math.min(...palavras.map((p) => p.caixa.y0)),
                x1: Math.max(...palavras.map((p) => p.caixa.x1)),
                y1: Math.max(...palavras.map((p) => p.caixa.y1)),
              }
            : null);
        if (caixa) linhas.push({ texto: String(linha.text ?? ''), palavras, caixa });
      }
    }
  }
  return linhas;
}

/** Variantes do rótulo para casar com o que está desenhado na tela. */
function variantesDoNome(nome: string): string[] {
  const variantes = [normalizar(nome)];
  const indiceDoisPontos = nome.lastIndexOf(':');
  if (indiceDoisPontos >= 0 && indiceDoisPontos < nome.length - 1) {
    variantes.push(normalizar(nome.slice(indiceDoisPontos + 1)));
    variantes.push(normalizar(nome.slice(0, indiceDoisPontos)));
  }
  return [...new Set(variantes)].filter(Boolean);
}

/** Pontua uma janela de texto contra um alvo normalizado. */
function pontuarJanela(alvo: string, janela: string, tokensAlvo: string[]): number {
  if (!janela) return 0;
  if (janela === alvo) return 1;
  if (alvo.includes(janela) && janela.length >= alvo.length * 0.5) return 0.95;
  if (janela.includes(alvo)) return 0.9;
  const tokensJanela = new Set(janela.split(' '));
  const coincidem = tokensAlvo.filter((token) => tokensJanela.has(token)).length;
  const cobertura = coincidem / Math.max(1, tokensAlvo.length);
  return cobertura >= 0.75 ? 0.8 + cobertura * 0.1 : 0;
}

/**
 * Procura o melhor retângulo para o rótulo: janela deslizante de palavras
 * consecutivas dentro de cada linha (e cauda de uma linha + trecho da
 * seguinte, para rótulos que o OCR divide ao meio em telas com duas colunas).
 */
function procurarCaixa(nome: string, linhas: LinhaOcr[], linhasUsadas: Set<number>): Candidato | null {
  const alvos = variantesDoNome(nome);
  const candidatos: Candidato[] = [];

  function examinar(palavras: PalavraOcr[], indiceLinha: number): void {
    const tokens = palavras.map((palavra) => normalizar(palavra.texto));
    for (const alvo of alvos) {
      const tokensAlvo = alvo.split(' ').filter((token) => token.length > 1);
      if (tokensAlvo.length === 0) continue;
      const comprimentoMaximo = Math.min(tokensAlvo.length + 2, tokens.length);
      for (let tamanho = comprimentoMaximo; tamanho >= 1; tamanho--) {
        for (let inicio = 0; inicio + tamanho <= tokens.length; inicio++) {
          if (linhasUsadas.has(indiceLinha) && candidatos.length > 0) continue;
          const janela = tokens.slice(inicio, inicio + tamanho).join(' ');
          const nota = pontuarJanela(alvo, janela, tokensAlvo);
          if (nota > 0) {
            candidatos.push({
              caixa: {
                x0: Math.min(...palavras.slice(inicio, inicio + tamanho).map((p) => p.caixa.x0)),
                y0: Math.min(...palavras.slice(inicio, inicio + tamanho).map((p) => p.caixa.y0)),
                x1: Math.max(...palavras.slice(inicio, inicio + tamanho).map((p) => p.caixa.x1)),
                y1: Math.max(...palavras.slice(inicio, inicio + tamanho).map((p) => p.caixa.y1)),
              },
              nota,
              linhasUsadas: [indiceLinha],
            });
          }
        }
      }
    }
  }

  linhas.forEach((linha, indice) => examinar(linha.palavras, indice));
  const melhorUnica = escolherMelhor(candidatos);

  // Rótulos divididos pelo OCR entre linhas vizinhas (comum em telas com duas
  // colunas): junta a CAUDA de uma linha com qualquer TRECHO da seguinte.
  if ((melhorUnica?.nota ?? 0) < 0.95) {
    const candidatosPares: Candidato[] = [];
    for (let i = 0; i + 1 < linhas.length; i++) {
      const a = linhas[i].palavras;
      const b = linhas[i + 1].palavras;
      for (let cauda = 1; cauda <= a.length; cauda++) {
        const caudaPalavras = a.slice(a.length - cauda);
        for (let inicioB = 0; inicioB < b.length; inicioB++) {
          for (let tamanhoB = 1; inicioB + tamanhoB <= b.length; tamanhoB++) {
            if (linhasUsadas.has(i) && candidatosPares.length > 0) break;
            const combinadas = [...caudaPalavras, ...b.slice(inicioB, inicioB + tamanhoB)];
            for (const alvo of alvos) {
              const tokensAlvo = alvo.split(' ').filter((token) => token.length > 1);
              if (tokensAlvo.length === 0) continue;
              const janela = combinadas.map((palavra) => normalizar(palavra.texto)).join(' ');
              const nota = pontuarJanela(alvo, janela, tokensAlvo);
              if (nota > 0) {
                candidatosPares.push({
                  caixa: {
                    x0: Math.min(...combinadas.map((p) => p.caixa.x0)),
                    y0: Math.min(...combinadas.map((p) => p.caixa.y0)),
                    x1: Math.max(...combinadas.map((p) => p.caixa.x1)),
                    y1: Math.max(...combinadas.map((p) => p.caixa.y1)),
                  },
                  nota,
                  linhasUsadas: [i, i + 1],
                });
              }
            }
          }
        }
      }
    }
    return escolherMelhor([...candidatos, ...candidatosPares]);
  }

  return melhorUnica;
}

/** Mantém o candidato de maior nota; em empates, o primeiro (leitura superior). */
function escolherMelhor(candidatos: Candidato[]): Candidato | null {
  return candidatos.reduce<Candidato | null>(
    (melhor, candidato) => (!melhor || candidato.nota > melhor.nota ? candidato : melhor),
    null,
  );
}

async function principal(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error('Defina DATABASE_URL no .env.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: true },
    max: 2,
  });

  const { rows } = await pool.query<{ id: string; nome: string; imagem_origem: string }>(
    `select id, nome, imagem_origem from parametros
      where ativo and imagem_origem is not null ${recarregar ? '' : 'and not imagem_marcada'}
        ${imagemEspecifica ? 'and imagem_origem = $1' : ''}
      order by imagem_origem, ordem`,
    imagemEspecifica ? [imagemEspecifica] : [],
  );

  const porImagem = new Map<string, Array<{ id: string; nome: string }>>();
  for (const linha of rows) {
    const lista = porImagem.get(linha.imagem_origem) ?? [];
    lista.push({ id: linha.id, nome: linha.nome });
    porImagem.set(linha.imagem_origem, lista);
  }

  if (porImagem.size === 0) {
    console.log('Nada a processar — todos os parâmetros já estão marcados.');
    await pool.end();
    return;
  }

  console.log(`Capturas a processar: ${Math.min(porImagem.size, limite)} de ${porImagem.size}`);
  mkdirSync(PASTA_CACHE, { recursive: true });
  mkdirSync(PASTA_SAIDA, { recursive: true });

  const worker = await createWorker('por', 1, { cachePath: 'dados/ocr-modelos' });

  let marcados = 0;
  const semCorrespondencia: Array<{ id: string; nome: string; imagem: string }> = [];
  let capturas = 0;

  try {
    for (const [imagem, parametros] of porImagem) {
      if (capturas >= limite) break;
      capturas++;

      const caminhoImagem = acharArquivoRecursivo(PASTA_BUSCA, imagem);
      if (!caminhoImagem) {
        console.log(`⚠ captura não encontrada: ${imagem}`);
        continue;
      }

      // OCR com cache por captura.
      const caminhoCache = join(PASTA_CACHE, `${imagem}.json`);
      let linhas: LinhaOcr[];
      if (existsSync(caminhoCache)) {
        linhas = JSON.parse(readFileSync(caminhoCache, 'utf-8')) as LinhaOcr[];
      } else {
        process.stdout.write(`🔍 OCR: ${imagem} … `);
        const { data } = await worker.recognize(caminhoImagem, {}, { blocks: true } as never);
        linhas = extrairLinhas(data);
        writeFileSync(caminhoCache, JSON.stringify(linhas));
        console.log(`${linhas.length} linhas`);
      }

      const meta = await sharp(caminhoImagem).metadata();
      const larguraImagem = meta.width ?? 0;
      const alturaImagem = meta.height ?? 0;
      const linhasUsadas = new Set<number>();

      for (const parametro of parametros) {
        const candidato = procurarCaixa(parametro.nome, linhas, linhasUsadas);
        if (!candidato || candidato.nota < NOTA_MINIMA) {
          semCorrespondencia.push({ id: parametro.id, nome: parametro.nome, imagem });
          continue;
        }

        for (const indice of candidato.linhasUsadas) linhasUsadas.add(indice);

        // Retângulo vermelho em volta do rótulo (na imagem inteira).
        const pad = 3;
        const retangulo = {
          x: Math.max(0, candidato.caixa.x0 - pad),
          y: Math.max(0, candidato.caixa.y0 - pad),
          w: candidato.caixa.x1 - candidato.caixa.x0 + pad * 2,
          h: candidato.caixa.y1 - candidato.caixa.y0 + pad * 2,
        };
        const svg =
          `<svg xmlns="http://www.w3.org/2000/svg" width="${larguraImagem}" height="${alturaImagem}">` +
          `<rect x="${retangulo.x}" y="${retangulo.y}" width="${retangulo.w}" height="${retangulo.h}" ` +
          `fill="none" stroke="${COR_RETANGULO}" stroke-width="4" rx="3"/></svg>`;
        const comRetangulo = await sharp(caminhoImagem).composite([{ input: Buffer.from(svg) }]).toBuffer();

        // Recorte com contexto ao redor do destaque.
        const esquerda = Math.max(0, retangulo.x - 90);
        const topo = Math.max(0, retangulo.y - 40);
        const largura = Math.min(larguraImagem - esquerda, retangulo.w + 180);
        const altura = Math.min(alturaImagem - topo, retangulo.h + 80);

        await sharp(comRetangulo)
          .extract({ left: esquerda, top: topo, width: largura, height: altura })
          .png({ compressionLevel: 9 })
          .toFile(join(PASTA_SAIDA, `${parametro.id}.png`));

        await pool.query('update parametros set imagem_marcada = true where id = $1', [parametro.id]);
        marcados++;
      }
    }
  } finally {
    await worker.terminate();
    await pool.end();
  }

  console.log('');
  console.log('======== RELATÓRIO DE IMAGENS ========');
  console.log(`Capturas processadas:   ${capturas}`);
  console.log(`Parâmetros marcados:    ${marcados}`);
  console.log(`Sem correspondência:    ${semCorrespondencia.length}`);
  for (const item of semCorrespondencia.slice(0, 40)) {
    console.log(`  ✗ ${item.id} · "${item.nome}" · ${item.imagem}`);
  }
  if (semCorrespondencia.length > 40) {
    console.log(`  ... e mais ${semCorrespondencia.length - 40}`);
  }
  console.log('======================================');
}

principal().catch((erro) => {
  console.error('Falha ao marcar imagens:', erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
