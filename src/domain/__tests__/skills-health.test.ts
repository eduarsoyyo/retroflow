import { describe, it, expect } from 'vitest';
import { memberFit, fitColor, skillGap, findAllGaps, suggestActionType } from '../skills';
import { calculateHealth } from '../health';

describe('memberFit', () => {
  const profileSkills = [
    { id: '1', profile_id: 'p1', skill_id: 's1', required_level: 4 as const },
    { id: '2', profile_id: 'p1', skill_id: 's2', required_level: 3 as const },
    { id: '3', profile_id: 'p1', skill_id: 's3', required_level: 2 as const },
  ];

  it('returns 100% when all skills match or exceed', () => {
    const memberSkills = [
      { id: 'a', member_id: 'm1', skill_id: 's1', current_level: 4 as const, notes: '' },
      { id: 'b', member_id: 'm1', skill_id: 's2', current_level: 4 as const, notes: '' },
      { id: 'c', member_id: 'm1', skill_id: 's3', current_level: 3 as const, notes: '' },
    ];
    expect(memberFit('m1', profileSkills, memberSkills)).toBe(100);
  });

  it('calculates partial fit correctly', () => {
    const memberSkills = [
      { id: 'a', member_id: 'm1', skill_id: 's1', current_level: 4 as const, notes: '' },
      { id: 'b', member_id: 'm1', skill_id: 's2', current_level: 2 as const, notes: '' },
      { id: 'c', member_id: 'm1', skill_id: 's3', current_level: 3 as const, notes: '' },
    ];
    // min(4,4) + min(2,3) + min(3,2) = 4+2+2 = 8 / 9 = 89%
    expect(memberFit('m1', profileSkills, memberSkills)).toBe(89);
  });

  it('returns 0% when member has no skills', () => {
    expect(memberFit('m1', profileSkills, [])).toBe(0);
  });

  it('returns null when no profile skills', () => {
    expect(memberFit('m1', [], [])).toBeNull();
  });
});

describe('fitColor', () => {
  it('green for >= 90', () => expect(fitColor(92)).toBe('#34C759'));
  it('orange for >= 70', () => expect(fitColor(75)).toBe('#FF9500'));
  it('red for < 70', () => expect(fitColor(50)).toBe('#FF3B30'));
});

describe('skillGap', () => {
  it('ok when actual >= required', () => {
    expect(skillGap(3, 4)).toEqual({ gap: -1, severity: 'ok' });
  });
  it('minor for gap of 1', () => {
    expect(skillGap(3, 2)).toEqual({ gap: 1, severity: 'minor' });
  });
  it('critical for gap >= 2', () => {
    expect(skillGap(4, 1)).toEqual({ gap: 3, severity: 'critical' });
  });
});

describe('suggestActionType', () => {
  it('mentoring for gap 1', () => expect(suggestActionType(1)).toBe('mentoring'));
  it('formacion for gap 2', () => expect(suggestActionType(2)).toBe('formacion'));
  it('certificacion for gap 3+', () => expect(suggestActionType(3)).toBe('certificacion'));
});

describe('calculateHealth', () => {
  it('returns 100 when everything is perfect', () => {
    const h = calculateHealth({
      totalTasks: 10, tasksDone: 10, tasksOnTrack: 0,
      risksOpen: 0, risksMitigated: 5, risksEscalated: 0, risksTotal: 5,
      avgFitPercent: 100, coveragePercent: 100,
    });
    expect(h.score).toBe(100);
    expect(h.color).toBe('#34C759');
  });

  it('returns green for score >= 80', () => {
    const h = calculateHealth({
      totalTasks: 10, tasksDone: 8, tasksOnTrack: 1,
      risksOpen: 2, risksMitigated: 8, risksEscalated: 0, risksTotal: 10,
      avgFitPercent: 85, coveragePercent: 90,
    });
    expect(h.score).toBeGreaterThanOrEqual(80);
    expect(h.color).toBe('#34C759');
  });

  it('returns red for score < 60', () => {
    const h = calculateHealth({
      totalTasks: 10, tasksDone: 2, tasksOnTrack: 1,
      risksOpen: 8, risksMitigated: 1, risksEscalated: 5, risksTotal: 9,
      avgFitPercent: 30, coveragePercent: 20,
    });
    expect(h.score).toBeLessThan(60);
    expect(h.color).toBe('#FF3B30');
  });

  it('handles zero data gracefully', () => {
    const h = calculateHealth({});
    expect(h.score).toBe(70); // No tasks/risks = perfect, but 0% fit + 0% coverage
  });

  it('exposes components breakdown', () => {
    const h = calculateHealth({ totalTasks: 10, tasksDone: 5, tasksOnTrack: 3 });
    expect(h.components.tareasAlDia).toBe(80);
  });
});
