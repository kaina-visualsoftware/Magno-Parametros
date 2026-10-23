import { existsSync } from 'node:fs';

/** Carrega o arquivo .env da raiz (Node 20+), se existir. */
export function carregarAmbiente(): void {
  if (existsSync('.env')) {
    process.loadEnvFile();
  }
}
