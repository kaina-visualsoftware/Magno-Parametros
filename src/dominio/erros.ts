/** Erros de domínio — usados por casos de uso e portas. */

export class ErroDominio extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = new.target.name;
  }
}

/** A importação encontrou um problema que impede a execução (ex.: total divergente). */
export class ErroImportacao extends ErroDominio {}

/** Entidade não localizada. */
export class ParametroNaoEncontrado extends ErroDominio {}
