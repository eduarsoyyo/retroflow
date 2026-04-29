// ═══ TESTS: domain/finance — Pure logic, no mocks needed ═══
import { describe, it, expect } from 'vitest'
import {
  migrateCostRates,
  getCurrentCostRate,
  costRateFromSalary,
  memberCostHour,
  getSalaryInfo,
  saleFromService,
  saleFromServiceContract,
  monthlyRevenueFromServices,
  totalSaleFromServices,
  avgMarginFromServices,
  getHolidaySet,
  holidayCountYear,
  getTargetHours,
  expectedHoursToDate,
  effectiveTheoreticalHours,
  workDaysToDate,
  businessDaysInRange,
  vacDaysApproved,
  ausDaysApproved,
  memberProjectCost,
  fmtN,
  fmtEur,
  pct,
  DEFAULT_SS_MULTIPLIER,
  type CalendarData,
  type ServiceContract,
  type AbsenceData,
  type LegacyCostRate,
} from '../finance'

// ── Test Calendar (Sevilla 2026) ──
const calSevilla: CalendarData = {
  id: 'sev-2026',
  name: 'Sevilla 2026',
  convenio_hours: 1764,
  daily_hours_lj: 8.75,
  daily_hours_v: 6,
  daily_hours_intensive: 7,
  intensive_start: '07-01',
  intensive_end: '08-31',
  holidays: [
    { date: '2026-01-01', name: 'Año nuevo' },
    { date: '2026-01-06', name: 'Reyes' },
    { date: '2026-02-28', name: 'Día de Andalucía' },
    { date: '2026-04-02', name: 'Jueves Santo' },
    { date: '2026-04-03', name: 'Viernes Santo' },
    { date: '2026-05-01', name: 'Día del Trabajo' },
    { date: '2026-08-15', name: 'Asunción' },
    { date: '2026-10-12', name: 'Hispanidad' },
    { date: '2026-11-02', name: 'Todos los Santos' },
    { date: '2026-12-07', name: 'Constitución' },
    { date: '2026-12-08', name: 'Inmaculada' },
    { date: '2026-12-25', name: 'Navidad' },
  ],
}

// ── Cost Rate Tests ──

describe('migrateCostRates', () => {
  it('keeps salary-based rates as-is', () => {
    const result = migrateCostRates([{ from: '2026-01', salary: 28000, multiplier: 1.33 }])
    expect(result).toEqual([{ from: '2026-01', to: undefined, salary: 28000, multiplier: 1.33 }])
  })

  it('converts legacy rate-based to salary-based', () => {
    const result = migrateCostRates([{ from: '2025-01', rate: 20 }])
    expect(result[0]!.salary).toBe(Math.round((20 * 1800) / 1.33))
    expect(result[0]!.multiplier).toBe(DEFAULT_SS_MULTIPLIER)
  })

  it('handles empty array', () => {
    expect(migrateCostRates([])).toEqual([])
  })

  it('preserves to field', () => {
    const result = migrateCostRates([{ from: '2025-01', to: '2025-12', salary: 30000, multiplier: 1.35 }])
    expect(result[0]!.to).toBe('2025-12')
  })
})

describe('getCurrentCostRate', () => {
  it('returns null for empty array', () => {
    expect(getCurrentCostRate([])).toBeNull()
  })

  it('returns the most recent rate when no exact match', () => {
    const rates = [
      { from: '2024-01', to: '2024-12', salary: 25000, multiplier: 1.33 },
      { from: '2025-01', salary: 28000, multiplier: 1.33 },
    ]
    const result = getCurrentCostRate(rates)
    expect(result!.salary).toBe(28000)
  })

  it('returns rate matching current period', () => {
    const now = new Date().toISOString().slice(0, 7)
    const rates = [
      { from: '2020-01', to: '2025-12', salary: 20000, multiplier: 1.33 },
      { from: now, salary: 35000, multiplier: 1.33 },
    ]
    const result = getCurrentCostRate(rates)
    expect(result!.salary).toBe(35000)
  })
})

describe('costRateFromSalary', () => {
  it('calculates cost/hour correctly', () => {
    // 28000 * 1.33 = 37240 / 1764 = 21.11
    const result = costRateFromSalary(28000, 1.33, 1764)
    expect(result).toBe(21.11)
  })

  it('returns 0 for zero salary', () => {
    expect(costRateFromSalary(0, 1.33, 1800)).toBe(0)
  })

  it('returns 0 for zero convenio hours', () => {
    expect(costRateFromSalary(28000, 1.33, 0)).toBe(0)
  })
})

describe('memberCostHour', () => {
  it('calculates from salary model', () => {
    const rates: LegacyCostRate[] = [{ from: '2026-01', salary: 28000, multiplier: 1.33 }]
    const result = memberCostHour(rates, 1764)
    expect(result).toBe(21.11)
  })

  it('falls back to legacy rate', () => {
    const rates: LegacyCostRate[] = [{ from: '2026-01', rate: 25 }]
    const result = memberCostHour(rates, 1800, 25)
    // Migrated salary = round(25*1800/1.33) = 33835, then 33835*1.33/1800 ≈ 25.01
    expect(result).toBeGreaterThan(24)
  })

  it('returns legacy costRate if no cost_rates', () => {
    expect(memberCostHour([], 1800, 22)).toBe(22)
  })
})

describe('getSalaryInfo', () => {
  it('returns salary and multiplier from current period', () => {
    const rates: LegacyCostRate[] = [{ from: '2026-01', salary: 32000, multiplier: 1.35 }]
    expect(getSalaryInfo(rates)).toEqual({ salary: 32000, multiplier: 1.35 })
  })

  it('returns defaults for empty array', () => {
    expect(getSalaryInfo([])).toEqual({ salary: 0, multiplier: DEFAULT_SS_MULTIPLIER })
  })
})

// ── Service/Contract Tests ──

describe('saleFromService', () => {
  it('calculates sale with margin only', () => {
    // cost=80000, margin=20% → sale = 80000 / (1-0.20) = 100000
    expect(saleFromService(80000, 20)).toBe(100000)
  })

  it('calculates sale with margin and risk', () => {
    // cost=80000, margin=20%, risk=5% → sale = 80000 / (1-0.20-0.05) = 106667
    expect(saleFromService(80000, 20, 5)).toBe(106667)
  })

  it('returns 0 when margin+risk >= 100%', () => {
    expect(saleFromService(100000, 60, 50)).toBe(0)
  })

  it('returns 0 for zero cost', () => {
    expect(saleFromService(0, 20)).toBe(0)
  })
})

describe('saleFromServiceContract', () => {
  it('works with ServiceContract object', () => {
    const svc: ServiceContract = { id: '1', name: 'Dev', from: '2026-01-01', to: '2026-12-31', cost: 100000, margin_pct: 25, risk_pct: 5 }
    // 100000 / (1-0.25-0.05) = 142857
    expect(saleFromServiceContract(svc)).toBe(142857)
  })
})

describe('monthlyRevenueFromServices', () => {
  const services: ServiceContract[] = [
    { id: '1', name: 'Fase 1', from: '2026-01-01', to: '2026-06-30', cost: 60000, margin_pct: 20, risk_pct: 0 },
  ]

  it('prorates revenue by service period', () => {
    // Sale = 60000 / 0.8 = 75000, over 6 months = 12500/month
    const jan = monthlyRevenueFromServices(services, 2026, 0)
    expect(jan).toBe(12500)
  })

  it('returns 0 for months outside service period', () => {
    const jul = monthlyRevenueFromServices(services, 2026, 6)
    expect(jul).toBe(0)
  })

  it('returns 0 for empty services', () => {
    expect(monthlyRevenueFromServices([], 2026, 0)).toBe(0)
  })
})

describe('totalSaleFromServices', () => {
  it('sums all services', () => {
    const svcs: ServiceContract[] = [
      { id: '1', name: 'A', from: '', to: '', cost: 50000, margin_pct: 20, risk_pct: 0 },
      { id: '2', name: 'B', from: '', to: '', cost: 30000, margin_pct: 25, risk_pct: 5 },
    ]
    const total = totalSaleFromServices(svcs)
    expect(total).toBe(saleFromService(50000, 20) + saleFromService(30000, 25, 5))
  })
})

describe('avgMarginFromServices', () => {
  it('calculates weighted average margin', () => {
    const svcs: ServiceContract[] = [
      { id: '1', name: 'A', from: '', to: '', cost: 80000, margin_pct: 20, risk_pct: 0 },
    ]
    // Sale = 100000, cost = 80000, margin = 20%
    expect(avgMarginFromServices(svcs)).toBe(20)
  })

  it('returns 0 for empty services', () => {
    expect(avgMarginFromServices([])).toBe(0)
  })
})

// ── Calendar/Hours Tests ──

describe('getHolidaySet', () => {
  it('creates set of holiday dates', () => {
    const set = getHolidaySet(calSevilla, 2026)
    expect(set.has('2026-01-01')).toBe(true)
    expect(set.has('2026-12-25')).toBe(true)
    expect(set.has('2026-03-15')).toBe(false)
  })

  it('handles mm-dd format holidays', () => {
    const cal: CalendarData = {
      ...calSevilla,
      holidays: [{ date: '01-01', name: 'Año nuevo' }],
    }
    const set = getHolidaySet(cal, 2026)
    expect(set.has('2026-01-01')).toBe(true)
  })
})

describe('holidayCountYear', () => {
  it('counts only business-day holidays', () => {
    const count = holidayCountYear(calSevilla, 2026)
    // Some holidays fall on weekends, so count < total holidays
    expect(count).toBeGreaterThan(0)
    expect(count).toBeLessThanOrEqual(calSevilla.holidays.length)
  })
})

describe('getTargetHours', () => {
  it('returns 0 for weekends', () => {
    expect(getTargetHours(calSevilla, '2026-04-05')).toBe(0) // Sunday
    expect(getTargetHours(calSevilla, '2026-04-04')).toBe(0) // Saturday
  })

  it('returns 0 for holidays', () => {
    expect(getTargetHours(calSevilla, '2026-01-01')).toBe(0) // Año nuevo
  })

  it('returns daily_hours_lj for Mon-Thu', () => {
    expect(getTargetHours(calSevilla, '2026-04-06')).toBe(8.75) // Monday
  })

  it('returns daily_hours_v for Friday', () => {
    expect(getTargetHours(calSevilla, '2026-04-10')).toBe(6) // Friday
  })

  it('returns intensive hours during intensive period', () => {
    expect(getTargetHours(calSevilla, '2026-07-06')).toBe(7) // July Monday
  })

  it('returns 8 with no calendar', () => {
    expect(getTargetHours(null, '2026-04-06')).toBe(8)
  })
})

describe('expectedHoursToDate', () => {
  it('calculates hours for January 2026', () => {
    const hours = expectedHoursToDate(calSevilla, 2026, '2026-01-31')
    // Jan 2026: 22 business days approx, minus 2 holidays (1 Jan, 6 Jan)
    // ~20 days × mix of 8.75h LJ and 6h V
    expect(hours).toBeGreaterThan(100)
    expect(hours).toBeLessThan(200)
  })

  it('returns 0 for null calendar', () => {
    // Null calendar handled by effectiveTheoreticalHours wrapper
    expect(effectiveTheoreticalHours(null, 2026, '2026-01-31', [], 'x')).toBe(0)
  })
})

describe('effectiveTheoreticalHours', () => {
  const absences: AbsenceData[] = [
    { member_id: 'u1', type: 'vacaciones', date_from: '2026-01-15', date_to: '2026-01-20', days: 4, status: 'aprobada' },
  ]

  it('subtracts vacation days from total hours', () => {
    const withVac = effectiveTheoreticalHours(calSevilla, 2026, '2026-01-31', absences, 'u1')
    const withoutVac = effectiveTheoreticalHours(calSevilla, 2026, '2026-01-31', [], 'u1')
    // 4 vacation days × 8.75h avg = 35h less
    expect(withoutVac - withVac).toBe(4 * calSevilla.daily_hours_lj)
  })

  it('ignores absences of other members', () => {
    const h1 = effectiveTheoreticalHours(calSevilla, 2026, '2026-01-31', absences, 'u2')
    const h2 = effectiveTheoreticalHours(calSevilla, 2026, '2026-01-31', [], 'u2')
    expect(h1).toBe(h2)
  })

  it('ignores non-approved absences', () => {
    const pending: AbsenceData[] = [
      { member_id: 'u1', type: 'vacaciones', date_from: '2026-01-15', date_to: '2026-01-20', days: 4, status: 'pendiente' },
    ]
    const h1 = effectiveTheoreticalHours(calSevilla, 2026, '2026-01-31', pending, 'u1')
    const h2 = effectiveTheoreticalHours(calSevilla, 2026, '2026-01-31', [], 'u1')
    expect(h1).toBe(h2)
  })
})

describe('workDaysToDate', () => {
  it('counts business days excluding holidays', () => {
    const days = workDaysToDate(calSevilla, 2026, '2026-01-31')
    // Jan 2026: ~22 business days - 2 holidays = ~20
    expect(days).toBeGreaterThan(18)
    expect(days).toBeLessThan(23)
  })
})

describe('businessDaysInRange', () => {
  it('returns business days in a week', () => {
    const days = businessDaysInRange('2026-04-06', '2026-04-10', calSevilla, 2026)
    // Mon to Fri, no holidays = 5 days
    expect(days).toHaveLength(5)
    expect(days[0]).toBe('2026-04-06')
    expect(days[4]).toBe('2026-04-10')
  })

  it('excludes holidays', () => {
    const days = businessDaysInRange('2026-04-01', '2026-04-06', calSevilla, 2026)
    // Apr 1 Wed, Apr 2 Thu (Jueves Santo holiday), Apr 3 Fri (Viernes Santo holiday), Apr 4 Sat, Apr 5 Sun, Apr 6 Mon
    expect(days).not.toContain('2026-04-02')
    expect(days).not.toContain('2026-04-03')
  })
})

// ── Absence Tests ──

describe('vacDaysApproved', () => {
  const absences: AbsenceData[] = [
    { member_id: 'u1', type: 'vacaciones', date_from: '2026-08-01', date_to: '2026-08-15', days: 11, status: 'aprobada' },
    { member_id: 'u1', type: 'vacaciones', date_from: '2026-12-23', date_to: '2026-12-31', days: 5, status: 'aprobada' },
    { member_id: 'u1', type: 'vacaciones', date_from: '2026-03-01', date_to: '2026-03-05', days: 5, status: 'pendiente' },
    { member_id: 'u2', type: 'vacaciones', date_from: '2026-07-01', date_to: '2026-07-15', days: 11, status: 'aprobada' },
  ]

  it('counts only approved vacation days for the member', () => {
    expect(vacDaysApproved(absences, 'u1', 2026)).toBe(16) // 11 + 5
  })

  it('ignores pending absences', () => {
    expect(vacDaysApproved(absences, 'u1', 2026)).toBe(16) // not 21
  })

  it('filters by member', () => {
    expect(vacDaysApproved(absences, 'u2', 2026)).toBe(11)
  })
})

describe('ausDaysApproved', () => {
  const absences: AbsenceData[] = [
    { member_id: 'u1', type: 'baja', date_from: '2026-02-01', date_to: '2026-02-05', days: 5, status: 'aprobada' },
    { member_id: 'u1', type: 'vacaciones', date_from: '2026-08-01', date_to: '2026-08-10', days: 8, status: 'aprobada' },
  ]

  it('counts only non-vacation approved absences', () => {
    expect(ausDaysApproved(absences, 'u1', 2026)).toBe(5)
  })
})

// ── Member Project Cost ──

describe('memberProjectCost', () => {
  it('calculates cost = effective_hours × dedication × cost_hour', () => {
    const cost = memberProjectCost(21.11, 1.0, calSevilla, [], 'u1', 2026, '2026-03-31')
    // ~Q1 hours × 21.11
    expect(cost).toBeGreaterThan(5000)
    expect(cost).toBeLessThan(20000)
  })

  it('scales by dedication', () => {
    const full = memberProjectCost(20, 1.0, calSevilla, [], 'u1', 2026, '2026-03-31')
    const half = memberProjectCost(20, 0.5, calSevilla, [], 'u1', 2026, '2026-03-31')
    expect(half).toBe(Math.round(full / 2))
  })

  it('returns 0 for null calendar', () => {
    expect(memberProjectCost(20, 1.0, null, [], 'u1', 2026, '2026-03-31')).toBe(0)
  })

  it('returns 0 for zero cost rate', () => {
    expect(memberProjectCost(0, 1.0, calSevilla, [], 'u1', 2026, '2026-03-31')).toBe(0)
  })
})

// ── Formatting Tests ──

describe('fmtN', () => {
  it('formats with Spanish locale (dot thousands, comma decimal)', () => {
    expect(fmtN(1234.5)).toBe('1.234,5')
  })

  it('formats small numbers', () => {
    expect(fmtN(0)).toBe('0,0')
  })
})

describe('fmtEur', () => {
  it('formats as euros', () => {
    const result = fmtEur(12345)
    expect(result).toContain('12')
    expect(result).toContain('345')
    expect(result).toContain('€')
  })
})

describe('pct', () => {
  it('calculates percentage', () => {
    expect(pct(25, 100)).toBe(25)
  })

  it('returns 0 for zero denominator', () => {
    expect(pct(25, 0)).toBe(0)
  })
})
