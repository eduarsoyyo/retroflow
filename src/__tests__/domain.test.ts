import { describe, it, expect } from 'vitest'

// ── Domain functions (pure, no imports from Supabase) ──

function criticality(prob: string, impact: string): number {
  const p = prob === 'alta' ? 3 : prob === 'media' ? 2 : 1
  const i = impact === 'alto' ? 3 : impact === 'medio' ? 2 : 1
  return p * i
}

function critLabel(c: number): string {
  return c >= 6 ? 'Crítico' : c >= 3 ? 'Medio' : 'Bajo'
}

function autoHorizon(date: string, today: string): string {
  if (!date) return 'sin_fecha'
  if (date < today) return 'vencido'
  if (date === today) return 'hoy'
  const endOfWeek = (() => { const d = new Date(today); d.setDate(d.getDate() + (7 - d.getDay())); return d.toISOString().slice(0, 10) })()
  const endOfMonth = (() => { const d = new Date(today); return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10) })()
  if (date <= endOfWeek) return 'semana'
  if (date <= endOfMonth) return 'mes'
  return 'despues'
}

function healthScore(overdue: number, blocked: number, escalated: number, criticalRisks: number, deviated: number, pctDone: number): number {
  let score = 100
  score -= overdue * 3
  score -= blocked * 5
  score -= escalated * 8
  score -= criticalRisks * 4
  score -= deviated * 2
  score += Math.floor(pctDone / 10)
  return Math.max(0, Math.min(100, score))
}

function riskNumber(risks: Array<{ id: string }>, riskId: string): number {
  return risks.findIndex(r => r.id === riskId) + 1
}

// ── Tests ──

describe('criticality', () => {
  it('alta × alto = 9 (Crítico)', () => {
    expect(criticality('alta', 'alto')).toBe(9)
    expect(critLabel(9)).toBe('Crítico')
  })
  it('media × medio = 4 (Medio)', () => {
    expect(criticality('media', 'medio')).toBe(4)
    expect(critLabel(4)).toBe('Medio')
  })
  it('baja × bajo = 1 (Bajo)', () => {
    expect(criticality('baja', 'bajo')).toBe(1)
    expect(critLabel(1)).toBe('Bajo')
  })
  it('alta × bajo = 3 (Medio)', () => {
    expect(criticality('alta', 'bajo')).toBe(3)
    expect(critLabel(3)).toBe('Medio')
  })
  it('baja × alto = 3 (Medio)', () => {
    expect(criticality('baja', 'alto')).toBe(3)
  })
})

describe('autoHorizon', () => {
  const today = '2026-04-24'
  it('returns vencido for past dates', () => {
    expect(autoHorizon('2026-04-20', today)).toBe('vencido')
  })
  it('returns hoy for today', () => {
    expect(autoHorizon('2026-04-24', today)).toBe('hoy')
  })
  it('returns semana for within 7 days', () => {
    expect(autoHorizon('2026-04-26', today)).toBe('semana')
  })
  it('returns mes for later in month', () => {
    // Apr 28 is past this week (Apr 24 is Thu, week ends Sun Apr 26) but within Apr
    expect(autoHorizon('2026-04-28', '2026-04-24')).toBe('mes')
  })
  it('returns despues for far future', () => {
    expect(autoHorizon('2026-08-15', today)).toBe('despues')
  })
  it('returns sin_fecha for empty', () => {
    expect(autoHorizon('', today)).toBe('sin_fecha')
  })
})

describe('healthScore', () => {
  it('returns 100 for perfect project', () => {
    expect(healthScore(0, 0, 0, 0, 0, 100)).toBe(100) // capped
  })
  it('penalizes overdue items', () => {
    expect(healthScore(3, 0, 0, 0, 0, 50)).toBe(96) // 100-9+5=96
  })
  it('penalizes blocked items heavily', () => {
    expect(healthScore(0, 2, 0, 0, 0, 50)).toBe(95) // 100-10+5=95
  })
  it('penalizes escalations most', () => {
    expect(healthScore(0, 0, 2, 0, 0, 50)).toBe(89) // 100-16+5=89
  })
  it('floors at 0', () => {
    expect(healthScore(20, 10, 5, 5, 10, 0)).toBe(0)
  })
})

describe('riskNumber', () => {
  const risks = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
  it('returns 1-based index', () => {
    expect(riskNumber(risks, 'a')).toBe(1)
    expect(riskNumber(risks, 'b')).toBe(2)
    expect(riskNumber(risks, 'c')).toBe(3)
  })
  it('returns 0 for not found', () => {
    expect(riskNumber(risks, 'z')).toBe(0)
  })
})
