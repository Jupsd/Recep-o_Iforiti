import React, { createContext, useContext, useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { getLocalSeedProfiles } from '../services/dataService';
import type { PerfilAcesso, PerfilUsuario } from '../types/database';

const LOCAL_AUTH_KEY = 'iforiti_local_auth_v1';
const LEGACY_RUNTIME_CONFIG_KEY = 'iforiti_supabase_runtime_v1';

function construirPerfilFallback(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}): PerfilAcesso {
  const emailNorm = (user.email || '').trim().toLowerCase();
  const ehAdmin =
    emailNorm.startsWith('admin') ||
    emailNorm.startsWith('yalase') ||
    user.user_metadata?.perfil === 'ADMIN';
  const nomeMeta = user.user_metadata?.nome;

  return {
    id: user.id,
    nome:
      typeof nomeMeta === 'string' && nomeMeta.trim()
        ? nomeMeta.trim()
        : ehAdmin
        ? (emailNorm.startsWith('yalase') ? 'Yalaxé / Administrador' : 'Dirigente / Administrador')
        : 'Cambono de Plantão',
    email: user.email ?? null,
    perfil: ehAdmin ? 'ADMIN' : 'CAMBONO',
    ativo: true,
    criado_em: new Date().toISOString(),
  };
}

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
              .maybeSingle();

            if (mounted) {
              if (row) {
                const perfilRow = row as PerfilAcesso;
                setPerfil(perfilRow.ativo ? perfilRow : null);
              } else {
                setPerfil(construirPerfilFallback(session.user));
              }
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
      } = client.auth.onAuthStateChange((event, session) => {
        if (!session?.user) {
          if (mounted) setPerfil(null);
          return;
        }
        if (event === 'SIGNED_IN') {
          return;
        }
        const usuario = session.user;
        window.setTimeout(async () => {
          if (!mounted) return;
          try {
            const { data: row } = await client
              .from('perfis_acesso')
              .select('*')
              .eq('id', usuario.id)
              .maybeSingle();

            if (!mounted) return;
            if (row) {
              const perfilRow = row as PerfilAcesso;
              setPerfil(perfilRow.ativo ? perfilRow : null);
            } else {
              setPerfil(construirPerfilFallback(usuario));
            }
          } catch {
            if (mounted) {
              setPerfil(construirPerfilFallback(usuario));
            }
          }
        }, 0);
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

  async function signIn(emailOuUsuario: string, password: string): Promise<PerfilAcesso> {
    const raw = emailOuUsuario.trim().toLowerCase();
    const emailNorm = raw.includes('@') ? raw : `${raw}@terreiro.org`;

    if (isSupabaseConfigured && supabase) {
      try {
        localStorage.removeItem(LEGACY_RUNTIME_CONFIG_KEY);
      } catch {
        // Ignora falha de armazenamento
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailNorm,
        password,
      });

      if (error) throw error;
      if (!data.user) {
        throw new Error('Falha ao autenticar usuário.');
      }

      const { data: row } = await supabase
        .from('perfis_acesso')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();

      if (row) {
        const perfilRow = row as PerfilAcesso;
        if (!perfilRow.ativo) {
          await supabase.auth.signOut();
          throw new Error(
            'Seu usuário está desativado na tabela perfis_acesso. Solicite liberação ao Administrador.'
          );
        }
        setPerfil(perfilRow);
        return perfilRow;
      }

      const perfilFallback = construirPerfilFallback(data.user);
      setPerfil(perfilFallback);
      return perfilFallback;
    }

    // Modo Local / Demonstração
    const perfis = getLocalSeedProfiles();
    const encontrado = perfis.find(
      (p) =>
        (p.email?.toLowerCase() === emailNorm ||
          p.email?.toLowerCase().startsWith(raw)) &&
        p.ativo
    );
    if (!encontrado) {
      throw new Error(
        'Usuário não encontrado. Digite yalase para Administração ou cambono para atendimento.'
      );
    }

    const senhaValida =
      (raw === 'yalase' && (password === 'Tana1001' || password === '123456')) ||
      (raw === 'cambono' && (password === 'iforiti' || password === '123456')) ||
      (raw === 'admin' && (password === '123456' || password === 'Tana1001')) ||
      password === '123456';

    if (!senhaValida) {
      throw new Error('Senha incorreta. Verifique suas credenciais.');
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

