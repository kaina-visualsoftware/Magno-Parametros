/**
 * Raiz de composição (DIP): ÚNICO lugar onde implementações concretas são
 * instanciadas. Todo o resto do app recebe interfaces por injeção.
 */

import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { criarRepositoriosSupabase } from './dados/repositorios-supabase';
import { PortasDeDados } from './dados/portas';

const urlSupabase = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const chaveAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export function configuracaoPresente(): boolean {
  if (!urlSupabase?.trim() || !chaveAnon?.trim()) return false;
  try {
    return ['https:', 'http:'].includes(new URL(urlSupabase).protocol);
  } catch {
    return false;
  }
}

let clienteCache: SupabaseClient | null = null;
let portasCache: PortasDeDados | null = null;

export function obterClienteSupabase(): SupabaseClient {
  if (!clienteCache) {
    if (!urlSupabase || !chaveAnon) {
      throw new Error('Configuração ausente: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env');
    }
    clienteCache = createClient(urlSupabase, chaveAnon);
  }
  return clienteCache;
}

export function obterRepositorios(): PortasDeDados {
  if (!portasCache) {
    portasCache = criarRepositoriosSupabase(obterClienteSupabase());
  }
  return portasCache;
}
