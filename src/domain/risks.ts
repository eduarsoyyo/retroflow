import type { Risk } from '@/types'

let _riskCounter = 0
const _riskMap = new Map<string, number>()

/**
 * Stable risk numbering — NEVER use indexOf+1 manually.
 * Rule #8 from project instructions.
 */
export function riskNumber(riskId: string): number {
  if (_riskMap.has(riskId)) return _riskMap.get(riskId)!
  _riskCounter++
  _riskMap.set(riskId, _riskCounter)
  return _riskCounter
}

export function resetRiskNumbers(): void {
  _riskCounter = 0
  _riskMap.clear()
}

export function sortByPriority(risks: Risk[]): Risk[] {
  return [...risks].sort((a, b) => b.criticality - a.criticality)
}
