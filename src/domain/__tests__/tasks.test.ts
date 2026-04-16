import { describe, it, expect } from 'vitest';
import { filterTasks, sortTasks, taskMetrics, groupByStatus } from '../tasks';
import type { Task } from '@app-types/index';

const makeTasks = (): Task[] => [
  { id: '1', text: 'Setup CI', owner: 'Eduardo', date: '2026-04-10', status: 'done', priority: 'high', voteScore: 0 },
  { id: '2', text: 'Fix login bug', owner: 'Miguel', date: '2026-04-08', status: 'backlog', priority: 'critical', voteScore: 0 },
  { id: '3', text: 'Write docs', owner: 'Eduardo', date: '2026-05-01', status: 'doing', priority: 'low', voteScore: 0 },
  { id: '4', text: 'Deploy staging', owner: 'Cecilia', date: '', status: 'blocked', priority: 'medium', voteScore: 0 },
  { id: '5', text: 'Archive old data', owner: '', status: 'cancelled', priority: 'low', voteScore: 0 },
];

describe('filterTasks', () => {
  it('returns all when no filters', () => {
    expect(filterTasks(makeTasks(), {})).toHaveLength(5);
  });

  it('filters by owner name', () => {
    const result = filterTasks(makeTasks(), { owner: 'Eduardo' });
    expect(result).toHaveLength(2);
    expect(result.every(t => t.owner === 'Eduardo')).toBe(true);
  });

  it('filters by "mine"', () => {
    const result = filterTasks(makeTasks(), { owner: 'mine', userName: 'Eduardo', userId: 'u1' });
    expect(result).toHaveLength(2);
  });

  it('filters by search', () => {
    const result = filterTasks(makeTasks(), { search: 'bug' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('combines owner + search', () => {
    const result = filterTasks(makeTasks(), { owner: 'Eduardo', search: 'docs' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('3');
  });
});

describe('sortTasks', () => {
  it('sorts by priority descending', () => {
    const sorted = sortTasks(makeTasks(), 'priority');
    expect((sorted[0] as any).priority).toBe('critical');
    expect((sorted[1] as any).priority).toBe('high');
  });

  it('sorts by date ascending', () => {
    const sorted = sortTasks(makeTasks(), 'date');
    expect(sorted[0].date).toBe('2026-04-08');
  });
});

describe('taskMetrics', () => {
  it('calculates correctly', () => {
    const m = taskMetrics(makeTasks());
    expect(m.total).toBe(4); // excludes cancelled
    expect(m.done).toBe(1);
    expect(m.open).toBe(3); // backlog + doing + blocked (cancelled excluded from total)
    expect(m.blocked).toBe(1);
    expect(m.completionPct).toBe(25); // 1/4
  });

  it('handles empty array', () => {
    const m = taskMetrics([]);
    expect(m.total).toBe(0);
    expect(m.completionPct).toBe(0);
  });
});

describe('groupByStatus', () => {
  it('groups into kanban columns', () => {
    const groups = groupByStatus(makeTasks());
    expect(groups['done']).toHaveLength(1);
    expect(groups['pending']).toHaveLength(1); // backlog → pending
    expect(groups['blocked']).toHaveLength(1);
    expect(groups['cancelled']).toHaveLength(1);
  });

  it('normalizes "doing" to "inprogress"', () => {
    const groups = groupByStatus(makeTasks());
    expect(groups['inprogress']).toHaveLength(1);
  });
});
