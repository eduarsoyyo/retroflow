// Stable risk numbering across the lifetime of a session.
//
// Used to display "Riesgo #N" labels consistently in the UI: each risk id
// is mapped to a 1-based counter the first time it's seen, and that mapping
// is kept until the page is reloaded or `resetRiskNumbers()` is called.
//
// Rule from project instructions: NEVER use indexOf+1 manually for risk
// numbering — it changes when items are added/removed/reordered. This
// counter is stable.
//
// Note: this module is intentionally self-contained — no imports from
// `@/types`. Risk numbering only needs an id, not the full Risk shape.

let _riskCounter = 0
const _riskMap = new Map<string, number>()

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
