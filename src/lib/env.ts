// ═══ ENVIRONMENT ═══
// Validated environment configuration. Fails fast if required vars are missing.

import { z } from 'zod';

const EnvSchema = z.object({
  VITE_SUPABASE_URL: z.string().url('VITE_SUPABASE_URL debe ser una URL válida'),
  VITE_SUPABASE_ANON_KEY: z.string().min(1, 'VITE_SUPABASE_ANON_KEY es obligatorio'),
  VITE_ENABLE_CELEBRATION: z.string().transform(v => v === 'true').default('true'),
  VITE_ENABLE_REALTIME: z.string().transform(v => v === 'true').default('true'),
  VITE_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('warn'),
});

function loadEnv() {
  const raw = {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
    VITE_ENABLE_CELEBRATION: import.meta.env.VITE_ENABLE_CELEBRATION,
    VITE_ENABLE_REALTIME: import.meta.env.VITE_ENABLE_REALTIME,
    VITE_LOG_LEVEL: import.meta.env.VITE_LOG_LEVEL,
  };

  const result = EnvSchema.safeParse(raw);
  if (!result.success) {
    console.error('[revelio] Invalid environment configuration:');
    result.error.issues.forEach(issue => {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    });
    throw new Error('Invalid environment configuration. Check .env file.');
  }

  return result.data;
}

export const env = loadEnv();
