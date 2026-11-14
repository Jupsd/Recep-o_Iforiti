import { createClient, SupabaseClient } from '@supabase/supabase-js';

const RUNTIME_CONFIG_KEY = 'iforiti_supabase_runtime_v1';
const DEFAULT_SUPABASE_URL = 'https://bqlfwuckswlurnpgvcfb.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_3hDqxSuIHbYHexvDCzqs7Q_4wX_LolZ';

interface RuntimeSupabaseConfig {
  url: string;
  anonKey: string;
}

function normalizarSupabaseUrl(rawUrl: string): string {
  return rawUrl
    .trim()
    .replace(/\/rest\/v1\/?$/i, '')
    .replace(/\/+$/, '');
}

function getRuntimeConfig(): RuntimeSupabaseConfig | null {
  try {
    const raw = localStorage.getItem(RUNTIME_CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RuntimeSupabaseConfig>;
    if (parsed.url && parsed.anonKey) {
      return {
        url: normalizarSupabaseUrl(parsed.url),
        anonKey: parsed.anonKey.trim(),
      };
    }
    return null;
  } catch {
    return null;
  }
}

const envUrl = normalizarSupabaseUrl(
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) || ''
);
const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || '';
const runtime = typeof window !== 'undefined' ? getRuntimeConfig() : null;

const activeUrl = runtime?.url || envUrl || DEFAULT_SUPABASE_URL;
const activeKey = runtime?.anonKey || envKey || DEFAULT_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  activeUrl &&
    activeKey &&
    !activeUrl.includes('SEU-PROJETO') &&
    !activeKey.includes('SUA_CHAVE')
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(activeUrl, activeKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null;

export function saveSupabaseRuntimeConfig(url: string, anonKey: string): void {
  localStorage.setItem(
    RUNTIME_CONFIG_KEY,
    JSON.stringify({ url: normalizarSupabaseUrl(url), anonKey: anonKey.trim() })
  );
}

export function clearSupabaseRuntimeConfig(): void {
  localStorage.removeItem(RUNTIME_CONFIG_KEY);
}

