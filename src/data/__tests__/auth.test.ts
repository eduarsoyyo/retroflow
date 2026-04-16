import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase before importing auth
const mockRpc = vi.fn();
vi.mock('../supabase', () => ({
  supabase: {
    rpc: mockRpc,
  },
}));

import { authenticateUser } from '../auth';

describe('authenticateUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns user on successful auth', async () => {
    mockRpc.mockResolvedValue({
      data: { ok: true, user: { id: '1', name: 'Eduardo', username: 'eybarra', is_superuser: true } },
      error: null,
    });

    const result = await authenticateUser('eybarra', 'revelio2026');
    
    expect(result.ok).toBe(true);
    expect(result.user?.name).toBe('Eduardo');
    expect(result.user?.is_superuser).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith('authenticate_user', {
      p_username: 'eybarra',
      p_password: 'revelio2026',
    });
  });

  it('returns error for wrong password', async () => {
    mockRpc.mockResolvedValue({
      data: { ok: false, error: 'WRONG_PASSWORD' },
      error: null,
    });

    const result = await authenticateUser('eybarra', 'wrong');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('WRONG_PASSWORD');
  });

  it('returns error for user not found', async () => {
    mockRpc.mockResolvedValue({
      data: { ok: false, error: 'USER_NOT_FOUND' },
      error: null,
    });

    const result = await authenticateUser('nobody', 'pass');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('USER_NOT_FOUND');
  });

  it('handles RPC failure', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'function not found' },
    });

    const result = await authenticateUser('eybarra', 'pass');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('RPC_ERROR');
  });

  it('handles network exception', async () => {
    mockRpc.mockRejectedValue(new Error('Network error'));

    const result = await authenticateUser('eybarra', 'pass');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('NETWORK_ERROR');
  });

  it('handles string JSON response', async () => {
    mockRpc.mockResolvedValue({
      data: JSON.stringify({ ok: true, user: { id: '2', name: 'Test' } }),
      error: null,
    });

    const result = await authenticateUser('test', 'test123');
    expect(result.ok).toBe(true);
    expect(result.user?.name).toBe('Test');
  });
});
