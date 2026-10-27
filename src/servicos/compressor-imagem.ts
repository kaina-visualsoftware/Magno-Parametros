/** Compressão local de capturas antes de enviá-las ao Supabase Storage. */
export const LIMITE_ORIGINAL = 20 * 1024 * 1024;
export const LIMITE_UPLOAD = 5 * 1024 * 1024;
const DIMENSAO_MAXIMA = 2560;

export type ImagemPreparada = {
  arquivo: File;
  tamanhoOriginal: number;
  comprimida: boolean;
};

const MIME_EXT: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp',
};

export function escolherMenor(original: File, convertido: Blob | null, maximo = LIMITE_UPLOAD): ImagemPreparada {
  if (convertido && convertido.size > 0 && convertido.size <= maximo &&
      (original.size > maximo || convertido.size < original.size) &&
      convertido.type === 'image/webp') {
    return {
      arquivo: new File([convertido], original.name.replace(/\.[^.]+$/, '') + '.webp', { type: 'image/webp' }),
      tamanhoOriginal: original.size,
      comprimida: true,
    };
  }
  if (original.size <= maximo) return { arquivo: original, tamanhoOriginal: original.size, comprimida: false };
  throw new Error('Não foi possível reduzir a imagem para 5 MB. Use uma imagem menor.');
}

async function blobCanvas(canvas: HTMLCanvasElement, qualidade: number): Promise<Blob | null> {
  return new Promise((resolver) => canvas.toBlob(resolver, 'image/webp', qualidade));
}

/** Usa Canvas/WebP, mantendo a imagem original se a conversão aumentar o tamanho. */
export async function prepararImagem(original: File): Promise<ImagemPreparada> {
  if (!MIME_EXT[original.type]) throw new Error('Selecione uma imagem PNG, JPG ou WebP.');
  if (!original.size || original.size > LIMITE_ORIGINAL) {
    throw new Error('A imagem original deve ter no máximo 20 MB.');
  }

  const bytes = new Uint8Array(await original.slice(0, 12).arrayBuffer());
  const png = bytes.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10';
  const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  if (!({ 'image/png': png, 'image/jpeg': jpg, 'image/webp': webp }[original.type])) {
    throw new Error('O conteúdo não corresponde ao formato informado.');
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(original);
  } catch {
    throw new Error('Não foi possível abrir a imagem escolhida.');
  }
  try {
    const escala = Math.min(1, DIMENSAO_MAXIMA / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * escala));
    canvas.height = Math.max(1, Math.round(bitmap.height * escala));
    const contexto = canvas.getContext('2d');
    if (!contexto) {
      if (original.size <= LIMITE_UPLOAD) return escolherMenor(original, null);
      throw new Error('Este navegador não permite comprimir a imagem.');
    }
    contexto.imageSmoothingEnabled = true;
    contexto.imageSmoothingQuality = 'high';
    contexto.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    let melhor: Blob | null = null;
    for (const qualidade of [0.92, 0.86, 0.78, 0.68]) {
      const tentativa = await blobCanvas(canvas, qualidade);
      if (tentativa?.type !== 'image/webp' || !tentativa.size) continue;
      if (!melhor || tentativa.size < melhor.size) melhor = tentativa;
      // Mantém a maior qualidade que reduz o tamanho e atende ao limite.
      if (tentativa.size <= LIMITE_UPLOAD && tentativa.size < original.size) {
        melhor = tentativa;
        break;
      }
    }
    return escolherMenor(original, melhor);
  } finally {
    bitmap.close();
  }
}

export function formatarTamanho(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
