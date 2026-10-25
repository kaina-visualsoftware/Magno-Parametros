/**
 * Autenticação e papéis (leitor / editor / administrador) via Supabase Auth.
 * O papel vem da tabela `profiles` (criada automaticamente por trigger).
 * A proteção de verdade está nas políticas RLS do banco; aqui só controlamos a UI.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { Papel } from '../dominio/entidades';
import { configuracaoPresente, obterClienteSupabase } from '../raiz-composicao';

interface EstadoAutenticacao {
  carregando: boolean;
  usuario: User | null;
  papel: Papel | null;
  entrar(email: string, senha: string): Promise<void>;
  sair(): Promise<void>;
}

const ContextoAutenticacao = createContext<EstadoAutenticacao | null>(null);

export function ProvedorAutenticacao({ children }: { children: ReactNode }) {
  const [carregando, setCarregando] = useState(true);
  const [usuario, setUsuario] = useState<User | null>(null);
  const [papel, setPapel] = useState<Papel | null>(null);

  useEffect(() => {
    if (!configuracaoPresente()) {
      setCarregando(false);
      return;
    }
    let ativo = true;
    const cliente = obterClienteSupabase();
    cliente.auth.getSession().then(({ data, error }) => {
      if (!ativo) return;
      if (error) {
        setUsuario(null);
        setCarregando(false);
        return;
      }
      setUsuario(data.session?.user ?? null);
      setCarregando(false);
    }).catch(() => {
      if (ativo) setCarregando(false);
    });
    const { data: assinatura } = cliente.auth.onAuthStateChange((_evento, sessao) => {
      setPapel(null);
      setUsuario(sessao?.user ?? null);
      setCarregando(false);
    });
    return () => {
      ativo = false;
      assinatura.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let ativo = true;
    setPapel(null);
    if (!usuario) {
      setPapel(null);
      return;
    }
    obterClienteSupabase()
      .from('profiles')
      .select('papel')
      .eq('id', usuario.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (ativo) setPapel(error ? null : (data?.papel as Papel | undefined) ?? 'leitor');
      });
    return () => { ativo = false; };
  }, [usuario]);

  async function entrar(email: string, senha: string): Promise<void> {
    const { error } = await obterClienteSupabase().auth.signInWithPassword({ email, password: senha });
    if (error) throw error;
  }

  async function sair(): Promise<void> {
    const { error } = await obterClienteSupabase().auth.signOut();
    if (error) throw error;
  }

  const valor: EstadoAutenticacao = { carregando, usuario, papel, entrar, sair };
  return <ContextoAutenticacao.Provider value={valor}>{children}</ContextoAutenticacao.Provider>;
}

export function useAutenticacao(): EstadoAutenticacao {
  const contexto = useContext(ContextoAutenticacao);
  if (!contexto) throw new Error('useAutenticacao deve ser usado dentro de ProvedorAutenticacao');
  return contexto;
}

export function podeEditarDocumentacao(papel: Papel | null): boolean {
  return papel === 'editor' || papel === 'administrador';
}

export function ehAdministrador(papel: Papel | null): boolean {
  return papel === 'administrador';
}
