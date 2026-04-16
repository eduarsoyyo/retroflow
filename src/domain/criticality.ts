// ═══ CRITICALITY — Risk heatmap logic ═══
// Pure functions. Zero dependencies outside types.

import type { ProbabilityLevel, ImpactLevel, CriticalitySector } from '@app-types/index';

const PROB_VAL: Record<ProbabilityLevel, number> = { alta: 3, media: 2, baja: 1 };
const IMP_VAL: Record<ImpactLevel, number> = { alto: 3, medio: 2, bajo: 1 };

export const CRIT_COLORS: Record<CriticalitySector, string> = {
  critical: '#FF3B30',
  moderate: '#FF9500',
  low: '#34C759',
};

export const CRIT_LABELS: Record<CriticalitySector, string> = {
  critical: 'Crítico',
  moderate: 'Moderado',
  low: 'Bajo',
};

export function calculateCriticality(prob: ProbabilityLevel, impact: ImpactLevel): CriticalitySector {
  const score = (PROB_VAL[prob] ?? 2) * (IMP_VAL[impact] ?? 2);
  if (score >= 6) return 'critical';
  if (score >= 3) return 'moderate';
  return 'low';
}

export function critColor(prob: ProbabilityLevel, impact: ImpactLevel): string {
  return CRIT_COLORS[calculateCriticality(prob, impact)];
}

export function heatColor(impact: ImpactLevel, prob: ProbabilityLevel): string {
  return critColor(prob, impact);
}

export function voteMajority(votes: Record<string, number> | undefined, defaultVal: string): string {
  if (!votes || typeof votes !== 'object') return defaultVal;
  let best = defaultVal;
  let bestCount = 0;
  for (const [k, v] of Object.entries(votes)) {
    if (v > bestCount) { best = k; bestCount = v; }
  }
  return best;
}
