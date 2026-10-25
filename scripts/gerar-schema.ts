/** Gera a instalação SQL alternativa a partir das mesmas migrações versionadas. */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const arquivos = readdirSync(resolve('migracoes')).filter(f => f.endsWith('.sql')).sort();
const sql = '-- Gerado por npm run gerar-schema. Não editar: altere migracoes/*.sql.\n' +
  arquivos.map(f => readFileSync(resolve('migracoes', f), 'utf8').trim()).join('\n\n') + '\n';
writeFileSync(resolve('supabase/schema.sql'), sql);
