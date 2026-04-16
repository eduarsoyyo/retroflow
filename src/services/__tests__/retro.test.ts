import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock data layer
const mockSaveSnapshot = vi.fn();
const mockCreateArchive = vi.fn();
const mockSaveMetric = vi.fn();

vi.mock('../../data/retros', () => ({
  saveRetroSnapshot: (...args: unknown[]) => mockSaveSnapshot(...args),
  createRetroArchive: (...args: unknown[]) => mockCreateArchive(...args),
  saveMetric: (...args: unknown[]) => mockSaveMetric(...args),
  loadRetroHistory: vi.fn(),
}));

import { autoSave, finalizeRetro } from '../retro';

describe('autoSave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSaveSnapshot.mockResolvedValue({ ok: true, data: undefined });
  });

  it('saves when state has data', async () => {
    const state = { notes: [{ id: '1', text: 'test' }], actions: [], risks: [] };
    const result = await autoSave('vwfs', 'agile', state, 'user1');
    
    expect(result.ok).toBe(true);
    expect(mockSaveSnapshot).toHaveBeenCalledWith('vwfs', 'agile', state, 'user1', 'active');
  });

  it('skips save when state is empty', async () => {
    const state = { notes: [], actions: [], risks: [] };
    const result = await autoSave('vwfs', 'agile', state, 'user1');
    
    expect(result.ok).toBe(true);
    expect(mockSaveSnapshot).not.toHaveBeenCalled();
  });

  it('saves when only risks have data', async () => {
    const state = { notes: [], actions: [], risks: [{ id: 'r1' }] };
    await autoSave('vwfs', 'agile', state, 'user1');
    
    expect(mockSaveSnapshot).toHaveBeenCalled();
  });

  it('saves when only actions have data', async () => {
    const state = { notes: [], actions: [{ id: 'a1' }], risks: [] };
    await autoSave('vwfs', 'agile', state, 'user1');
    
    expect(mockSaveSnapshot).toHaveBeenCalled();
  });
});

describe('finalizeRetro', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateArchive.mockResolvedValue({ ok: true });
    mockSaveMetric.mockResolvedValue({ ok: true });
  });

  it('archives and saves metrics', async () => {
    const state = {
      notes: [
        { id: 'n1', text: 'good', userName: 'Eduardo', votes: ['u1', 'u2'] },
        { id: 'n2', text: 'bad', userName: 'Miguel', votes: [] },
      ],
      actions: [
        { id: 'a1', text: 'fix bug', status: 'backlog' },
        { id: 'a2', text: 'deploy', status: 'done' },
      ],
      risks: [{ id: 'r1' }],
      objective: 'Ship v3',
      tasks: [{ text: 't1', done: true }, { text: 't2', done: false }],
    };
    const phaseTimes = { 0: 120, 1: 300, 2: 180 };

    const result = await finalizeRetro('vwfs', 'agile', state, 'user1', phaseTimes);
    
    expect(result.ok).toBe(true);
    expect(mockCreateArchive).toHaveBeenCalledWith('vwfs', 'agile', state, 'user1');
    expect(mockSaveMetric).toHaveBeenCalledWith('vwfs', expect.objectContaining({
      notes: 2,
      participants: 2,
      participantNames: ['Eduardo', 'Miguel'],
      actions: 2,
      actionsDone: 1,
      votes: 2,
      objective: 'Ship v3',
      tasksDone: 1,
      tasksTotal: 2,
    }));
  });

  it('handles archive failure gracefully', async () => {
    mockCreateArchive.mockRejectedValue(new Error('DB error'));

    const state = { notes: [], actions: [], risks: [] };
    const result = await finalizeRetro('vwfs', 'agile', state, 'user1', {});
    
    expect(result.ok).toBe(false);
  });
});
