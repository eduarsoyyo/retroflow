// ═══ SUPABASE CLIENT ═══
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '@lib/env';
import { createLogger } from '@lib/logger';

const log = createLogger('supabase');

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_client) {
    _client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
    log.info('Client initialized');
  }
  return _client;
}

// Re-export for convenience, but prefer getSupabase() for testability
export const supabase = getSupabase();
