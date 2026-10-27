import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ImagePlus, RotateCcw, Upload } from 'lucide-react';
import type { Parametro } from '../dominio/entidades';
import { obterClienteSupabase } from '../raiz-composicao';
import { useDialogos } from './Dialogo';

const BUCKET = 'imagens-parametros';
const LIMITE = 5 * 1024 * 1024;
const EXTENSOES: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp',
};

export function urlImagemParametro(parametro: Parametro): string | null {
  if (parametro.imagemPersonalizadaPath) {
    return obterClienteSupabase().storage.from(BUCKET)
      .getPublicUrl(parametro.imagemPersonalizadaPath).data.publicUrl;
  }
  return parametro.imagemMarcada
    ? `${import.meta.env.BASE_URL}imagens-parametro/${encodeURIComponent(parametro.id)}.png` : null;
}

async function validarImagem(arquivo: File): Promise<string> {
  const extensao = EXTENSOES[arquivo.type];
  if (!extensao) throw new Error('Selecione PNG, JPG ou WebP.');
  if (!arquivo.size || arquivo.size > LIMITE) throw new Error('A imagem deve ter no máximo 5 MB.');
  const bytes = new Uint8Array(await arquivo.slice(0, 12).arrayBuffer());
  const png = bytes.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10';
  const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  if (!({ png, jpg, webp }[extensao])) throw new Error('O conteúdo não corresponde ao formato da imagem.');
  return extensao;
}

export function ImagemParametro({ parametro, admin }: { parametro: Parametro; admin: boolean }) {
  const consulta = useQueryClient();
  const { confirmar } = useDialogos();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [falha, setFalha] = useState(false);

  useEffect(() => {
    if (!arquivo) { setPrevia(null); return; }
    const url = URL.createObjectURL(arquivo);
    setPrevia(url);
    return () => URL.revokeObjectURL(url);
  }, [arquivo]);

  useEffect(() => { setFalha(false); setErro(''); setMensagem(''); setArquivo(null); }, [parametro.id, parametro.imagemPersonalizadaPath]);

  const atual = urlImagemParametro(parametro);
  const limparConsulta = async () => {
    await Promise.all([
      consulta.invalidateQueries({ queryKey: ['parametro', parametro.id] }),
      consulta.invalidateQueries({ queryKey: ['historico'] }),
    ]);
  };

  async function enviar() {
    if (!arquivo || salvando || !admin) return;
    setErro(''); setMensagem('');
    setSalvando(true);
    let caminho: string | null = null;
    try {
      const extensao = await validarImagem(arquivo);
      if (atual && !(await confirmar('Substituir a imagem exibida por este novo arquivo?'))) return;
      caminho = `${parametro.id}/${crypto.randomUUID()}.${extensao}`;
      const cliente = obterClienteSupabase();
      const { error: erroUpload } = await cliente.storage.from(BUCKET)
        .upload(caminho, arquivo, { contentType: arquivo.type, upsert: false, cacheControl: '31536000' });
      if (erroUpload) throw erroUpload;
      const { error: erroRpc } = await cliente.rpc('definir_imagem_parametro', {
        p_id: parametro.id,
        p_versao_esperada: parametro.versao,
        p_caminho: caminho,
      });
      if (erroRpc) {
        await cliente.storage.from(BUCKET).remove([caminho]);
        throw erroRpc;
      }
      setArquivo(null);
      setMensagem('Imagem atualizada com sucesso.');
      await limparConsulta();
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Não foi possível enviar a imagem.');
    } finally {
      setSalvando(false);
    }
  }

  async function restaurar() {
    if (!admin || salvando || !parametro.imagemPersonalizadaPath) return;
    if (!(await confirmar('Restaurar a imagem importada? A imagem personalizada deixará de ser exibida.'))) return;
    setSalvando(true); setErro(''); setMensagem('');
    try {
      const { error } = await obterClienteSupabase().rpc('definir_imagem_parametro', {
        p_id: parametro.id, p_versao_esperada: parametro.versao, p_caminho: null,
      });
      if (error) throw error;
      setMensagem('Imagem importada restaurada.');
      await limparConsulta();
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Não foi possível restaurar a imagem.');
    } finally { setSalvando(false); }
  }

  return <section className="cartao cartao-imagem">
    <h2>Imagem do parâmetro</h2>
    {atual && !falha ? <img className="imagem-destacada" src={atual}
      alt={parametro.imagemPersonalizadaPath
        ? `Imagem de referência do parâmetro ${parametro.nome}`
        : `Recorte da tela de origem com ${parametro.nome} destacado`}
      loading="lazy" onError={() => setFalha(true)} />
      : <p className="dica">Este parâmetro ainda não possui imagem disponível.</p>}
    {parametro.imagemPersonalizadaPath
      ? <p className="dica">Imagem cadastrada pelo administrador.</p>
      : atual && !falha ? <p className="dica">Imagem gerada a partir da captura de origem.</p> : null}
    {admin && <div className="mt-4 flex flex-col gap-3">
      <label className="campo">
        <span><ImagePlus size={16} className="inline mr-2" aria-hidden="true" />{atual ? 'Substituir imagem' : 'Adicionar imagem'}</span>
        <input type="file" accept="image/png,image/jpeg,image/webp" disabled={salvando}
          onChange={e => { setArquivo(e.target.files?.[0] ?? null); setErro(''); e.currentTarget.value = ''; }} />
      </label>
      {previa && <img src={previa} alt="Prévia do arquivo escolhido" className="imagem-destacada" />}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="botao primario" disabled={!arquivo || salvando}
          onClick={() => void enviar()}><Upload size={16} aria-hidden="true" />{salvando ? 'Salvando…' : 'Salvar imagem'}</button>
        {parametro.imagemPersonalizadaPath && <button type="button" className="botao fantasma" disabled={salvando}
          onClick={() => void restaurar()}><RotateCcw size={16} aria-hidden="true" />Restaurar imagem importada</button>}
      </div>
      <p className="dica">PNG, JPG ou WebP, até 5 MB. Envie um recorte que mostre o parâmetro correto.</p>
    </div>}
    {erro && <p className="erro" role="alert">{erro}</p>}
    {mensagem && <p className="mensagem-sucesso" role="status">{mensagem}</p>}
  </section>;
}
