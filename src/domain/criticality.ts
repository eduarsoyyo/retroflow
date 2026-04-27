/**
 * Risk criticality calculator.
 * criticality = probability × impact (both 1-5 scale)
 * ≥6 = critical, ≥3 = moderate, <3 = low
 */
export function calculateCriticality(probability: number, impact: number): number {
  return probability * impact
}

export function criticalityLevel(score: number): 'critical' | 'moderate' | 'low' {
  if (score >= 6) return 'critical'
  if (score >= 3) return 'moderate'
  return 'low'
}

export function criticalityColor(level: 'critical' | 'moderate' | 'low'): string {
  return {
    critical: '#FF3B30',
    moderate: '#FF9500',
    low: '#34C759',
  }[level]
}
