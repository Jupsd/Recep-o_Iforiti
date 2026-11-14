import { createClient, SupabaseClient } from '@supabase/supabase-js';

const LEGACY_RUNTIME_CONFIG_KEY = 'iforiti_supabase_runtime_v1';
const DEFAULT_SUPABASE_URL = 'https://bqlfwuckswlurnpgvcfb.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_3hDqxSuIHbYHexvDCzqs7Q_4wX_LolZ';

function normalizarSupabaseUrl(rawUrl: string): string {
  return rawUrl
    .trim()
    .replace(/\/rest\/v1\/?$/i, '')
    .replace(/\/+$/, '');
}

function isValidSupabaseUrl(url: string): boolean {
  return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url);
}

function isValidSupabaseKey(key: string): boolean {
  const k = key.trim();
  return k.length > 20 && (k.startsWith('sb_publishable_') || k.startsWith('eyJ'));
}

if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem(LEGACY_RUNTIME_CONFIG_KEY);
  } catch {
    // Ignora bloqueio de armazenamento
  }
}

const rawEnvUrl = normalizarSupabaseUrl(
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) || ''
);
const rawEnvKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || '';
const envUrl = isValidSupabaseUrl(rawEnvUrl) ? rawEnvUrl : '';
const envKey = isValidSupabaseKey(rawEnvKey) ? rawEnvKey : '';

const activeUrl = envUrl || DEFAULT_SUPABASE_URL;
const activeKey = envKey || DEFAULT_SUPABASE_ANON_KEY;

function criarClienteSeguro(url: string, key: string): SupabaseClient | null {
  if (!isValidSupabaseUrl(url) || !isValidSupabaseKey(key)) {
    return null;
  }
  try {
    return createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        lock: async <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> =>
          await fn(),
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  } catch {
    return null;
  }
}

export const supabase: SupabaseClient | null = criarClienteSeguro(activeUrl, activeKey);

export const isSupabaseConfigured = Boolean(supabase);
