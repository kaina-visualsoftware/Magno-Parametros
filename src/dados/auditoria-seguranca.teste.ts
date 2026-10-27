import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('regras estáticas de segurança da aplicação', () => {
  it('não permite conexões PostgreSQL com validação TLS desabilitada', () => {
    const arquivos = readdirSync(resolve('scripts')).filter(nome => nome.endsWith('.ts'));
    for (const nome of arquivos) {
      const texto = readFileSync(resolve('scripts', nome), 'utf8');
      expect(texto, `Configuração TLS insegura em ${nome}`).not.toMatch(/rejectUnauthorized\s*:\s*false/);
    }
  });

  it('restringe o controle de migrações e a execução das funções internas', () => {
    const sql = readFileSync(resolve('migracoes/0012_endurecimento_rls.sql'), 'utf8');
    expect(sql).toMatch(/alter table public\._migracoes enable row level security/i);
    expect(sql).toMatch(/revoke all privileges on table public\._migracoes from public, anon, authenticated/i);
    expect(sql).toMatch(/revoke all on function public\.criar_profile\(\) from public, anon, authenticated/i);
    expect(sql).toMatch(/revoke all on function public\.papel_atual\(\) from public, anon/i);
    expect(sql).toMatch(/leitura equipe/);
  });

  it('não testa senhas administrativas fixas no script de verificação', () => {
    const script = readFileSync(resolve('scripts/verificar-banco.ts'),'utf8');
    expect(script).not.toMatch(/encrypted_password|crypt\s*\(/i);
  });
});
