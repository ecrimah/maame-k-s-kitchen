import { createClient as createSupabaseJsClient, type SupabaseClient } from '@supabase/supabase-js';
import { isPlainPostgres } from './db/mode';
import { createClient as createPgClient } from './db/supabase-compat';

/**
 * Server-side admin client.
 * - Plain Postgres (DATABASE_URL set): in-process pg compat + auth/storage shims
 * - Otherwise: hosted Supabase service-role client
 *
 * ONLY use in API routes / server actions — never in client components.
 * Lazily initialized so `next build` can collect page data without full env.
 */

let _admin: any = null;

function createAdminClient() {
  if (isPlainPostgres()) {
    return createPgClient();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl) {
    console.warn(
      '[supabase-admin] Missing NEXT_PUBLIC_SUPABASE_URL — using inert build stub'
    );
    return createSupabaseJsClient('http://127.0.0.1:9', 'service-role-stub', {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  if (!supabaseServiceKey) {
    console.error(
      'CRITICAL: Missing SUPABASE_SERVICE_ROLE_KEY — admin operations will fail'
    );
  }

  return createSupabaseJsClient(supabaseUrl, supabaseServiceKey || '', {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function getAdmin(): any {
  if (!_admin) _admin = createAdminClient();
  return _admin;
}

export const supabaseAdmin: any = new Proxy(
  {},
  {
    get(_target, prop, receiver) {
      const client = getAdmin();
      const value = Reflect.get(client, prop, receiver);
      return typeof value === 'function' ? (value as Function).bind(client) : value;
    },
  }
);
