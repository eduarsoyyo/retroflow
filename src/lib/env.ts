export const ENV = {
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL ?? 'https://qrkroskozbehtmbvrxxj.supabase.co',
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFya3Jvc2tvemJlaHRtYnZyeHhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzM1NTYsImV4cCI6MjA5MjEwOTU1Nn0.NrNfLX0zjyi1xV-IEvji-s3tyJ_sSMaVCwW5JwxoBNI',
} as const
