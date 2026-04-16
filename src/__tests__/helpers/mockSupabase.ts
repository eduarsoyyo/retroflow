// ═══ SUPABASE MOCK — For testing data layer without real DB ═══
import { vi } from 'vitest';

interface MockResponse {
  data: unknown;
  error: null | { message: string };
}

/**
 * Creates a chainable mock that simulates supabase's fluent API.
 * Usage: mockSupabase({ team_members: [{ id: '1', name: 'Test' }] })
 */
export function createMockSupabase(tables: Record<string, unknown[]> = {}) {
  const makeChain = (tableName: string, response?: MockResponse) => {
    const data = tables[tableName] || [];
    const defaultResponse: MockResponse = response || { data, error: null };

    const chain: Record<string, unknown> = {};
    const methods = ['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'in', 'order', 'limit', 'maybeSingle', 'single'];
    
    methods.forEach(m => {
      chain[m] = vi.fn().mockReturnValue(chain);
    });

    // Terminal methods return the response
    chain.then = (resolve: (v: MockResponse) => void) => {
      resolve(defaultResponse);
      return Promise.resolve(defaultResponse);
    };

    // Make it thenable (Promise-like)
    Object.defineProperty(chain, 'then', {
      value: (resolve: (v: MockResponse) => void) => {
        resolve(defaultResponse);
        return Promise.resolve(defaultResponse);
      },
      writable: true,
    });

    return chain;
  };

  return {
    from: vi.fn((table: string) => makeChain(table)),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn((cb: (status: string) => void) => { cb('SUBSCRIBED'); return {}; }),
      send: vi.fn(),
      track: vi.fn(),
      presenceState: vi.fn(() => ({})),
    })),
    removeChannel: vi.fn(),
    rpc: vi.fn((_fn: string, _params: Record<string, unknown>) => 
      Promise.resolve({ data: { ok: true, user: { id: '1', name: 'Test' } }, error: null }),
    ),
  };
}

/**
 * Mock the supabase module. Call in beforeEach.
 * Returns the mock client for assertions.
 */
export function mockSupabaseModule(tables: Record<string, unknown[]> = {}) {
  const mock = createMockSupabase(tables);
  vi.doMock('../data/supabase', () => ({ supabase: mock }));
  return mock;
}
