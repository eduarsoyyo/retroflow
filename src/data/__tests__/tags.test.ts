import { describe, it, expect, vi, beforeEach } from 'vitest';

// Build chainable mock
function makeChain(response: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  ['select', 'insert', 'update', 'delete', 'eq', 'maybeSingle', 'single', 'order'].forEach(m => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  // Make awaitable
  chain.then = (resolve: (v: unknown) => void) => { resolve(response); return Promise.resolve(response); };
  return chain;
}

const mockFrom = vi.fn();
vi.mock('../supabase', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

import { saveTag, deleteTag, toggleTagAssignment } from '../tags';

describe('saveTag', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates new tag without id', async () => {
    const newTag = { sala: 'vwfs', name: 'Urgente', color: '#FF3B30' };
    const saved = { id: 'tag-1', ...newTag };
    mockFrom.mockReturnValue(makeChain({ data: saved, error: null }));

    const result = await saveTag(newTag);
    expect(result).toEqual(saved);
    expect(mockFrom).toHaveBeenCalledWith('tags');
  });

  it('updates existing tag with id', async () => {
    const tag = { id: 'tag-1', sala: 'vwfs', name: 'Updated', color: '#007AFF' };
    mockFrom.mockReturnValue(makeChain({ data: tag, error: null }));

    const result = await saveTag(tag);
    expect(result).toEqual(tag);
  });

  it('returns null on error', async () => {
    mockFrom.mockImplementation(() => { throw new Error('DB error'); });
    const result = await saveTag({ sala: 'x', name: 'y', color: '#000' });
    expect(result).toBeNull();
  });
});

describe('deleteTag', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes assignments then tag', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: null }));
    await deleteTag('tag-1');
    expect(mockFrom).toHaveBeenCalledWith('tag_assignments');
    expect(mockFrom).toHaveBeenCalledWith('tags');
  });
});

describe('toggleTagAssignment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('removes assignment if exists', async () => {
    mockFrom.mockReturnValue(makeChain({ data: { id: 'assign-1' }, error: null }));
    const result = await toggleTagAssignment('tag-1', 'action', 'task-1', 'vwfs');
    expect(result).toBe(false); // removed
  });

  it('creates assignment if not exists', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: null }));
    const result = await toggleTagAssignment('tag-1', 'action', 'task-1', 'vwfs');
    expect(result).toBe(true); // added
  });
});
