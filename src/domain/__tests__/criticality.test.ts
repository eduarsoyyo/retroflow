import { describe, it, expect } from 'vitest';
import { calculateCriticality, critColor, voteMajority } from '../criticality';

describe('calculateCriticality', () => {
  it('returns critical for alta × alto (score 9)', () => {
    expect(calculateCriticality('alta', 'alto')).toBe('critical');
  });

  it('returns critical for alta × medio (score 6)', () => {
    expect(calculateCriticality('alta', 'medio')).toBe('critical');
  });

  it('returns moderate for media × medio (score 4)', () => {
    expect(calculateCriticality('media', 'medio')).toBe('moderate');
  });

  it('returns moderate for alta × bajo (score 3)', () => {
    expect(calculateCriticality('alta', 'bajo')).toBe('moderate');
  });

  it('returns low for baja × bajo (score 1)', () => {
    expect(calculateCriticality('baja', 'bajo')).toBe('low');
  });

  it('returns low for baja × medio (score 2)', () => {
    expect(calculateCriticality('baja', 'medio')).toBe('low');
  });
});

describe('critColor', () => {
  it('returns red for critical', () => {
    expect(critColor('alta', 'alto')).toBe('#FF3B30');
  });

  it('returns orange for moderate', () => {
    expect(critColor('media', 'medio')).toBe('#FF9500');
  });

  it('returns green for low', () => {
    expect(critColor('baja', 'bajo')).toBe('#34C759');
  });
});

describe('voteMajority', () => {
  it('returns the option with most votes', () => {
    expect(voteMajority({ alta: 3, media: 1, baja: 0 }, 'media')).toBe('alta');
  });

  it('returns default when votes is undefined', () => {
    expect(voteMajority(undefined, 'media')).toBe('media');
  });

  it('returns default when votes is empty', () => {
    expect(voteMajority({} as Record<string, number>, 'media')).toBe('media');
  });

  it('handles tie by returning first highest', () => {
    const result = voteMajority({ alta: 2, media: 2, baja: 0 }, 'baja');
    expect(['alta', 'media']).toContain(result);
  });
});
