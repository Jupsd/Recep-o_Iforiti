import React, { createContext, useContext, useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { getLocalSeedProfiles } from '../services/dataService';
import type { PerfilAcesso, PerfilUsuario } from '../types/database';

const LOCAL_AUTH_KEY = 'iforiti_local_auth_v1';

interface AuthContextValue {
  perfil: PerfilAcesso | null;
  loading: boolean;
  isModoLocal: boolean;
  signIn: (email: string, password: string) => Promise<PerfilAcesso>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [perfil, setPerfil] = useState<PerfilAcesso | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;

    async function carregarSessaoInicial() {
      if (isSupabaseConfigured && supabase) {
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (session?.user) {
            const { data: row } = await supabase
              .from('perfis_acesso')
              .select('*')
              .eq('id', session.user.id)
              .eq('ativo', true)
              .maybeSingle();

            if (mounted) {
              setPerfil((row as PerfilAcesso | null) ?? null);
            }
          }
        } catch {
          if (mounted) setPerfil(null);
        } finally {
          if (mounted) setLoading(false);
        }
        return;
      }

      // Modo Local
      try {
        const raw = localStorage.getItem(LOCAL_AUTH_KEY);
        if (raw && mounted) {
          setPerfil(JSON.parse(raw) as PerfilAcesso);
        }
      } catch {
        if (mounted) setPerfil(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    carregarSessaoInicial();

    if (isSupabaseConfigured && supabase) {
      const client = supabase;
      const {
        data: { subscription },
      } = client.auth.onAuthStateChange(async (_event, session) => {
        if (!session?.user) {
          if (mounted) setPerfil(null);
          return;
        }
        const { data: row } = await client
          .from('perfis_acesso')
          .select('*')
          .eq('id', session.user.id)
          .eq('ativo', true)
          .maybeSingle();
        if (mounted) {
          setPerfil((row as PerfilAcesso | null) ?? null);
        }
      });

      return () => {
        mounted = false;
        subscription.unsubscribe();
      };
    }

    return () => {
      mounted = false;
    };
  }, []);

  async function signIn(email: string, password: string): Promise<PerfilAcesso> {
    const emailNorm = email.trim().toLowerCase();

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailNorm,
        password,
      });

      if (error) throw error;
      if (!data.user) {
        throw new Error('Falha ao autenticar usuário.');
      }

      const { data: row, error: perfilErr } = await supabase
        .from('perfis_acesso')
        .select('*')
        .eq('id', data.user.id)
        .eq('ativo', true)
        .maybeSingle();

      if (perfilErr) throw perfilErr;
      if (!row) {
        await supabase.auth.signOut();
        throw new Error(
          'Seu usuário não possui registro ativo na tabela perfis_acesso. Solicite liberação ao Administrador.'
        );
      }

      const perfilAtivo = row as PerfilAcesso;
      setPerfil(perfilAtivo);
      return perfilAtivo;
    }

    // Modo Local / Demonstração
    if (password !== '123456') {
      throw new Error('No modo demonstração local, utilize a senha padrão: 123456');
    }

    const perfis = getLocalSeedProfiles();
    const encontrado = perfis.find(
      (p) => p.email?.toLowerCase() === emailNorm && p.ativo
    );
    if (!encontrado) {
      throw new Error(
        'Usuário não encontrado. Utilize admin@terreiro.org ou cambono@terreiro.org.'
      );
    }

    localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify(encontrado));
    setPerfil(encontrado);
    return encontrado;
  }

  async function signOut(): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    } else {
      localStorage.removeItem(LOCAL_AUTH_KEY);
    }
    setPerfil(null);
  }

  return (
    <AuthContext.Provider
      value={{
        perfil,
        loading,
        isModoLocal: !isSupabaseConfigured,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser utilizado dentro de AuthProvider.');
  }
  return ctx;
}

export function possuiPermissao(
  perfil: PerfilAcesso | null,
  rolesPermitidos?: PerfilUsuario[]
): boolean {
  if (!perfil || !perfil.ativo) return false;
  if (!rolesPermitidos || rolesPermitidos.length === 0) return true;
  return rolesPermitidos.includes(perfil.perfil);
}

