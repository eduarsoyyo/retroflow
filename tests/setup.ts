// ═══ TEST SETUP ═══
// Runs before every test file.

import { vi } from 'vitest';

// Mock import.meta.env for tests
vi.stubGlobal('import', {
  meta: {
    env: {
      VITE_SUPABASE_URL: 'https://test.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-key',
      VITE_LOG_LEVEL: 'error',
      VITE_ENABLE_CELEBRATION: 'false',
      VITE_ENABLE_REALTIME: 'false',
    },
  },
});

// Suppress console noise in tests
vi.spyOn(console, 'debug').mockImplementation(() => {});
vi.spyOn(console, 'info').mockImplementation(() => {});
