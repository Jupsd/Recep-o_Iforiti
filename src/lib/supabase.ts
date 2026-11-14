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

function isValidSupabaseUrl(url: string): boolean {
  return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url);
}

function isValidSupabaseKey(key: string): boolean {
  const k = key.trim();
  return k.length > 20 && (k.startsWith('sb_publishable_') || k.startsWith('eyJ'));
}

function getRuntimeConfig(): RuntimeSupabaseConfig | null {
  try {
    const raw = localStorage.getItem(RUNTIME_CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RuntimeSupabaseConfig>;
    if (parsed.url && parsed.anonKey) {
      const normalizedUrl = normalizarSupabaseUrl(parsed.url);
      const trimmedKey = parsed.anonKey.trim();
      if (isValidSupabaseUrl(normalizedUrl) && isValidSupabaseKey(trimmedKey)) {
        return {
          url: normalizedUrl,
          anonKey: trimmedKey,
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

const rawEnvUrl = normalizarSupabaseUrl(
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) || ''
);
const rawEnvKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || '';
const envUrl = isValidSupabaseUrl(rawEnvUrl) ? rawEnvUrl : '';
const envKey = isValidSupabaseKey(rawEnvKey) ? rawEnvKey : '';
const runtime = typeof window !== 'undefined' ? getRuntimeConfig() : null;

const activeUrl = runtime?.url || envUrl || DEFAULT_SUPABASE_URL;
const activeKey = runtime?.anonKey || envKey || DEFAULT_SUPABASE_ANON_KEY;

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

export function saveSupabaseRuntimeConfig(url: string, anonKey: string): void {
  localStorage.setItem(
    RUNTIME_CONFIG_KEY,
    JSON.stringify({ url: normalizarSupabaseUrl(url), anonKey: anonKey.trim() })
  );
}

export function clearSupabaseRuntimeConfig(): void {
  localStorage.removeItem(RUNTIME_CONFIG_KEY);
}

