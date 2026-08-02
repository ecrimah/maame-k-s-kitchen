import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Browser / shared supabase-js client.
 *
 * In plain-Postgres mode, set:
 *   NEXT_PUBLIC_USE_PLAIN_PG=true
 *   NEXT_PUBLIC_SUPABASE_URL=<this app origin>
 * so requests hit /auth/v1, /rest/v1, and /storage/v1 shims.
 *
 * Lazily initialized so `next build` can collect page data without full env.
 */

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseKey) {
    console.warn(
      '[supabase] Missing NEXT_PUBLIC_SUPABASE_URL / ANON_KEY — using inert build stub'
    );
    _client = createClient('http://127.0.0.1:9', 'public-anon-key', {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return _client;
  }

  _client = createClient(supabaseUrl, supabaseKey);
  return _client;
}

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === 'function' ? (value as Function).bind(client) : value;
  },
});
