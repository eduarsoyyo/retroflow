// ═══ DOMAIN: FINANCE — Pure business logic (0 external dependencies) ═══
// All functions receive data as parameters and return results.
// NEVER imports from data/, services/, components/, or Supabase.

export const DEFAULT_SS_MULTIPLIER = 1.33

// ── Types ──

export interface CostRate {
  from: string
  to?: string
  salary: number
  multiplier: number
}

export interface LegacyCostRate {
  from: string
  to?: string
  rate?: number
  salary?: number
  multiplier?: number
}

export interface ServiceContract {
  id: string
  name: string
  from: string
  to: string
  cost: number
  margin_pct: number
  risk_pct: number
}

export interface CalendarData {
  id: string
  name?: string
  convenio_hours: number
  daily_hours_lj: number
  daily_hours_v: number
  daily_hours_intensive: number
  intensive_start: string
  intensive_end: string
  holidays: Array<{ date: string; name?: string }>
}

export interface AbsenceData {
  member_id: string
  type: string
  date_from: string
  date_to: string
  days: number
  status: string
}

// ── Cost Rate Functions ──

/** Migrate legacy cost_rates (rate-based) to new format (salary-based) */
export function migrateCostRates(raw: LegacyCostRate[]): CostRate[] {
  return raw.map((r) => {
    if (r.salary !== undefined && r.salary > 0) {
      return { from: r.from, to: r.to, salary: r.salary, multiplier: r.multiplier || DEFAULT_SS_MULTIPLIER }
    }
    const salary = r.rate ? Math.round((r.rate * 1800) / DEFAULT_SS_MULTIPLIER) : 0
    return { from: r.from, to: r.to, salary, multiplier: DEFAULT_SS_MULTIPLIER }
  })
}

/** Get the current active cost rate from an array of periods */
export function getCurrentCostRate(rates: CostRate[]): CostRate | null {
  if (!rates || rates.length === 0) return null
  const now = new Date().toISOString().slice(0, 7)
  const sorted = [...rates].sort((a, b) => b.from.localeCompare(a.from))
  return sorted.find((r) => r.from <= now && (!r.to || r.to >= now)) || sorted[0] || null
}

/** Calculate cost per hour from salary, multiplier, and convenio hours */
export function costRateFromSalary(salary: number, multiplier: number, convenioHours: number): number {
  if (salary <= 0 || convenioHours <= 0) return 0
  return Math.round(((salary * multiplier) / convenioHours) * 100) / 100
}

/** Get cost/hour for a member given their cost_rates and calendar */
export function memberCostHour(costRates: LegacyCostRate[], convenioHours: number, legacyCostRate?: number): number {
  const migrated = migrateCostRates(costRates)
  const current = getCurrentCostRate(migrated)
  if (current && current.salary > 0) {
    return costRateFromSalary(current.salary, current.multiplier, convenioHours || 1800)
  }
  return legacyCostRate || 0
}

/** Get salary info (salary + multiplier) from cost_rates */
export function getSalaryInfo(costRates: LegacyCostRate[]): { salary: number; multiplier: number } {
  const migrated = migrateCostRates(costRates)
  const current = getCurrentCostRate(migrated)
  if (current) return { salary: current.salary, multiplier: current.multiplier }
  return { salary: 0, multiplier: DEFAULT_SS_MULTIPLIER }
}

// ── Service/Contract Functions ──

/** Calculate sale price from a service: cost / (1 - margin% - risk%) */
export function saleFromService(cost: number, marginPct: number, riskPct: number = 0): number {
  const denominator = 1 - marginPct / 100 - riskPct / 100
  return denominator > 0 ? Math.round(cost / denominator) : 0
}

/** Calculate sale price from a ServiceContract object */
export function saleFromServiceContract(s: ServiceContract): number {
  return saleFromService(s.cost, s.margin_pct, s.risk_pct)
}

/** Calculate monthly revenue from services for a specific month, prorated by service period */
export function monthlyRevenueFromServices(services: ServiceContract[], yr: number, month: number): number {
  if (!services || services.length === 0) return 0
  let rev = 0
  for (const sv of services) {
    const sale = saleFromServiceContract(sv)
    if (sale <= 0) continue
    const svFrom = sv.from ? new Date(sv.from) : new Date(yr, 0, 1)
    const svTo = sv.to ? new Date(sv.to) : new Date(yr, 11, 31)
    const totalMonths = Math.max(
      1,
      (svTo.getFullYear() - svFrom.getFullYear()) * 12 + svTo.getMonth() - svFrom.getMonth() + 1,
    )
    const moStart = new Date(yr, month, 1)
    const moEnd = new Date(yr, month + 1, 0)
    if (moEnd >= svFrom && moStart <= svTo) {
      rev += Math.round(sale / totalMonths)
    }
  }
  return rev
}

/** Total sale from all services */
export function totalSaleFromServices(services: ServiceContract[]): number {
  return services.reduce((sum, sv) => sum + saleFromServiceContract(sv), 0)
}

/** Total estimated cost from all services */
export function totalEstCostFromServices(services: ServiceContract[]): number {
  return services.reduce((sum, sv) => sum + sv.cost, 0)
}

/** Average margin % weighted by sale */
export function avgMarginFromServices(services: ServiceContract[]): number {
  const totalSale = totalSaleFromServices(services)
  const totalCost = totalEstCostFromServices(services)
  return totalSale > 0 ? Math.round(((totalSale - totalCost) / totalSale) * 100) : 0
}

// ── Project Cost Calculation ──

/** Calculate real cost of a member in a project for a period */
export function memberProjectCost(
  costHour: number,
  dedication: number,
  cal: CalendarData | null,
  absences: AbsenceData[],
  memberId: string,
  yr: number,
  toDateStr: string,
): number {
  if (!cal || costHour <= 0) return 0
  const effHours = effectiveTheoreticalHours(cal, yr, toDateStr, absences, memberId)
  return Math.round(effHours * dedication * costHour)
}

// ── Calendar/Hours Functions (also pure) ──

/** Get set of holiday date strings for a year */
export function getHolidaySet(cal: CalendarData, yr: number): Set<string> {
  const s = new Set<string>()
  for (const h of cal.holidays || []) {
    const ds = h.date.length === 10 ? h.date : `${yr}-${h.date}`
    s.add(ds)
  }
  return s
}

/** Count holidays that fall on business days in a year */
export function holidayCountYear(cal: CalendarData, yr: number): number {
  return (cal.holidays || []).filter((h) => {
    const ds = h.date.length === 10 ? h.date : `${yr}-${h.date}`
    const d = new Date(ds)
    return d.getFullYear() === yr && d.getDay() !== 0 && d.getDay() !== 6
  }).length
}

/** Get target hours for a specific date based on calendar */
export function getTargetHours(cal: CalendarData | null, dateStr: string): number {
  const dw = new Date(dateStr).getDay()
  if (dw === 0 || dw === 6) return 0
  if (!cal) return 8
  const isHoliday = (cal.holidays || []).some(
    (h) => h.date === dateStr || (h.date.length === 5 && dateStr.slice(5) === h.date),
  )
  if (isHoliday) return 0
  const mm = dateStr.slice(5)
  const intS = cal.intensive_start || '08-01'
  const intE = cal.intensive_end || '08-31'
  if (intS && intE && mm >= intS && mm <= intE) return cal.daily_hours_intensive || 7
  if (dw === 5) return cal.daily_hours_v || 8
  return cal.daily_hours_lj || 8
}

/** Calculate total expected hours from Jan 1 to a given date (calendar-based, no absences) */
export function expectedHoursToDate(cal: CalendarData, yr: number, toStr: string): number {
  const hSet = getHolidaySet(cal, yr)
  const intS = cal.intensive_start || '08-01'
  const intE = cal.intensive_end || '08-31'
  let h = 0
  const d = new Date(yr, 0, 1)
  const end = new Date(toStr)
  while (d <= end) {
    const dw = d.getDay()
    const ds = d.toISOString().slice(0, 10)
    const mm = ds.slice(5)
    if (dw !== 0 && dw !== 6 && !hSet.has(ds)) {
      if (mm >= intS && mm <= intE) h += cal.daily_hours_intensive || 7
      else if (dw === 5) h += cal.daily_hours_v || 8
      else h += cal.daily_hours_lj || 8
    }
    d.setDate(d.getDate() + 1)
  }
  return h
}

/** Effective theoretical hours = calendar hours MINUS vacation and absence days */
export function effectiveTheoreticalHours(
  cal: CalendarData | null,
  yr: number,
  toStr: string,
  absences: AbsenceData[],
  memberId: string,
): number {
  if (!cal) return 0
  const raw = expectedHoursToDate(cal, yr, toStr)
  const avgH = cal.daily_hours_lj || 8
  const vacD = vacDaysApproved(absences, memberId, yr)
  const ausD = ausDaysApproved(absences, memberId, yr)
  return Math.max(0, raw - (vacD + ausD) * avgH)
}

/** Effective theoretical hours for the full year */
export function effectiveTheoreticalHoursYear(
  cal: CalendarData | null,
  yr: number,
  absences: AbsenceData[],
  memberId: string,
): number {
  return effectiveTheoreticalHours(cal, yr, `${yr}-12-31`, absences, memberId)
}

/** Count business days from Jan 1 to a date */
export function workDaysToDate(cal: CalendarData | null, yr: number, toStr: string): number {
  if (!cal) return 0
  const hSet = getHolidaySet(cal, yr)
  let days = 0
  const d = new Date(yr, 0, 1)
  const end = new Date(toStr)
  while (d <= end) {
    if (d.getDay() !== 0 && d.getDay() !== 6 && !hSet.has(d.toISOString().slice(0, 10))) days++
    d.setDate(d.getDate() + 1)
  }
  return days
}

/** Get all business day date strings in a range */
export function businessDaysInRange(from: string, to: string, cal: CalendarData | null, yr: number): string[] {
  const hSet = cal ? getHolidaySet(cal, yr) : new Set<string>()
  const days: string[] = []
  const d = new Date(from)
  const end = new Date(to)
  while (d <= end) {
    const ds = d.toISOString().slice(0, 10)
    if (d.getDay() !== 0 && d.getDay() !== 6 && !hSet.has(ds)) days.push(ds)
    d.setDate(d.getDate() + 1)
  }
  return days
}

// ── Absence Functions ──

/** Count approved vacation days for a member in a year */
export function vacDaysApproved(absences: AbsenceData[], memberId: string, yr: number): number {
  return absences
    .filter(
      (a) =>
        a.member_id === memberId &&
        a.status === 'aprobada' &&
        a.type === 'vacaciones' &&
        a.date_from.startsWith(String(yr)),
    )
    .reduce((s, a) => s + a.days, 0)
}

/** Count approved non-vacation absence days for a member in a year */
export function ausDaysApproved(absences: AbsenceData[], memberId: string, yr: number): number {
  return absences
    .filter(
      (a) =>
        a.member_id === memberId &&
        a.status === 'aprobada' &&
        a.type !== 'vacaciones' &&
        a.date_from.startsWith(String(yr)),
    )
    .reduce((s, a) => s + a.days, 0)
}

// ── Helpers ──

/**
 * Percentage helper. Returns rounded `(a / b) × 100`. Safe for `b === 0`.
 *
 * Note: this is a pure ratio helper, NOT a formatter. For display in UI
 * use `formatPercent` from `lib/format.ts`.
 */
export function pct(a: number, b: number): number {
  return b === 0 ? 0 : Math.round((a / b) * 100)
}
