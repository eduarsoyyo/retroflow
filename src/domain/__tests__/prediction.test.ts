import { describe, it, expect } from 'vitest';
import { predictDelivery, extractVelocities, type SprintVelocity } from '../prediction';

describe('predictDelivery', () => {
  const velocities: SprintVelocity[] = [
    { sprint: 'Sprint 1', planned: 20, completed: 18, date: '2026-01-15' },
    { sprint: 'Sprint 2', planned: 22, completed: 20, date: '2026-01-29' },
    { sprint: 'Sprint 3', planned: 20, completed: 22, date: '2026-02-12' },
    { sprint: 'Sprint 4', planned: 25, completed: 19, date: '2026-02-26' },
  ];

  it('returns null with less than 2 velocities', () => {
    expect(predictDelivery([], 50)).toBeNull();
    expect(predictDelivery([velocities[0]], 50)).toBeNull();
  });

  it('calculates average velocity', () => {
    const result = predictDelivery(velocities, 40);
    expect(result).not.toBeNull();
    expect(result!.avgVelocity).toBeCloseTo(19.75, 0);
  });

  it('calculates sprints needed', () => {
    const result = predictDelivery(velocities, 40);
    expect(result!.sprintsNeeded).toBe(3); // 40/19.75 ≈ 2.03, ceil = 3
  });

  it('provides confidence intervals', () => {
    const result = predictDelivery(velocities, 40);
    expect(result!.confidence.optimistic).toBeLessThanOrEqual(result!.confidence.expected);
    expect(result!.confidence.expected).toBeLessThanOrEqual(result!.confidence.pessimistic);
  });

  it('provides estimated dates', () => {
    const result = predictDelivery(velocities, 40, 14);
    expect(result!.estimatedDate.optimistic).toBeTruthy();
    expect(result!.estimatedDate.expected).toBeTruthy();
    expect(result!.estimatedDate.pessimistic).toBeTruthy();
    expect(result!.estimatedDate.optimistic <= result!.estimatedDate.expected).toBe(true);
    expect(result!.estimatedDate.expected <= result!.estimatedDate.pessimistic).toBe(true);
  });

  it('detects improving trend', () => {
    const improving: SprintVelocity[] = [
      { sprint: 'S1', planned: 20, completed: 10, date: '2026-01-01' },
      { sprint: 'S2', planned: 20, completed: 12, date: '2026-01-15' },
      { sprint: 'S3', planned: 20, completed: 14, date: '2026-01-29' },
      { sprint: 'S4', planned: 20, completed: 20, date: '2026-02-12' },
      { sprint: 'S5', planned: 20, completed: 22, date: '2026-02-26' },
      { sprint: 'S6', planned: 20, completed: 24, date: '2026-03-12' },
    ];
    const result = predictDelivery(improving, 40);
    expect(result!.trend).toBe('improving');
  });

  it('detects declining trend', () => {
    const declining: SprintVelocity[] = [
      { sprint: 'S1', planned: 20, completed: 24, date: '2026-01-01' },
      { sprint: 'S2', planned: 20, completed: 22, date: '2026-01-15' },
      { sprint: 'S3', planned: 20, completed: 20, date: '2026-01-29' },
      { sprint: 'S4', planned: 20, completed: 12, date: '2026-02-12' },
      { sprint: 'S5', planned: 20, completed: 10, date: '2026-02-26' },
      { sprint: 'S6', planned: 20, completed: 8, date: '2026-03-12' },
    ];
    const result = predictDelivery(declining, 40);
    expect(result!.trend).toBe('declining');
  });

  it('provides probability 5-99', () => {
    const result = predictDelivery(velocities, 40);
    expect(result!.probability).toBeGreaterThanOrEqual(5);
    expect(result!.probability).toBeLessThanOrEqual(99);
  });
});

describe('extractVelocities', () => {
  it('groups actions by sprint', () => {
    const actions = [
      { sprint: 'Sprint 1', hours: 5, status: 'done', createdAt: '2026-01-10' },
      { sprint: 'Sprint 1', hours: 3, status: 'done', createdAt: '2026-01-12' },
      { sprint: 'Sprint 1', hours: 8, status: 'backlog', createdAt: '2026-01-14' },
      { sprint: 'Sprint 2', hours: 10, status: 'done', createdAt: '2026-01-25' },
    ];
    const result = extractVelocities(actions);
    expect(result).toHaveLength(2);
    expect(result[0].sprint).toBe('Sprint 1');
    expect(result[0].planned).toBe(16);
    expect(result[0].completed).toBe(8);
    expect(result[1].completed).toBe(10);
  });

  it('ignores tasks without sprint', () => {
    const actions = [
      { hours: 5, status: 'done' },
      { sprint: 'Sprint 1', hours: 3, status: 'done' },
    ];
    const result = extractVelocities(actions);
    expect(result).toHaveLength(1);
  });

  it('defaults hours to 1', () => {
    const actions = [
      { sprint: 'Sprint 1', status: 'done' },
      { sprint: 'Sprint 1', status: 'backlog' },
    ];
    const result = extractVelocities(actions);
    expect(result[0].planned).toBe(2);
    expect(result[0].completed).toBe(1);
  });
});
