// ═══ FINANCE SERVICE — Orchestrates domain/finance + data layer ═══
// Use case: components ask the service for finance data; the service loads
// from data/* and runs pure calculations from domain/finance.
//
// Layer rules (Clean Architecture):
//   - This file is the ONLY place that combines data + domain for finance.
//   - Components NEVER call data/* or domain/finance directly for project P&L.
//   - This file does NOT import from components/ or hooks/.
//   - Calculations live in domain/finance — services only call them.

import { fetchTeamMembers } from '@/data/team'
import { fetchRooms } from '@/data/rooms'
import {
  fetchTimeEntries,
  hoursByMember,
  hoursByMonth,
  sumHours,
  type TimeEntry,
} from '@/data/time-entries'
import { fetchCalendariosIndexed } from '@/data/calendarios'
import {
  // Cost rates
  migrateCostRates,
  costRateFromSalary,
  memberCostHour,
  // Service contracts (revenue)
  monthlyRevenueFromServices,
  totalSaleFromServices,
  totalEstCostFromServices,
  avgMarginFromServices,
  // Calendar / hours
  effectiveTheoreticalHoursYear,
  // Helpers
  pct,
  type CostRate,
  type LegacyCostRate,
  type ServiceContract,
  type CalendarData,
  type AbsenceData,
} from '@/domain/finance'
import type {
  Member,
  Room,
  Calendario,
  MemberAssign,
  ServiceContractEntry,
  CostRateEntry,
  VacationEntry,
} from '@/types'

// ═════════════════════════════════════════════════════════════════════════════
// Public types — what the components consume
// ═════════════════════════════════════════════════════════════════════════════

/**
 * How the cost side of finance is computed.
 *   - 'actual'   → from real time_entries (clocked hours × cost rate).
 *                  Currently unused at the cliente view because nobody
 *                  clocks here yet, but kept for FinancePanel and future.
 *   - 'incurred' → coste real incurrido por las personas asignadas al
 *                  proyecto: salario × dedicación × calendario × tarifa.
 *                  Is what the project really costs based on who's on it
 *                  and how their time is distributed. UI label: "Real".
 *   - 'contract' → from rooms.services[].cost. What was offered to the
 *                  client (cost of the contract). UI label: "Por contrato".
 *                  Prorated month by month using service start/end dates.
 */
export type CostMode = 'actual' | 'incurred' | 'contract'

export interface MonthlyPnL {
  /** 0-indexed month (0 = January) */
  month: number
  revenue: number
  cost: number
  margin: number
  marginPct: number
}

export interface ProjectFinance {
  slug: string
  name: string
  year: number
  mode: CostMode
  /** Total invoiced revenue from contracted services */
  totalRevenue: number
  /** Total real cost (based on `mode`) */
  totalCost: number
  /** totalRevenue - totalCost */
  margin: number
  /** Margin as percentage of revenue (0..100) */
  marginPct: number
  /** Per-month breakdown — always 12 entries (Jan..Dec) */
  months: MonthlyPnL[]
  /** Members included in the cost calculation, with their contribution */
  members: ProjectMemberCost[]
}

export interface ProjectMemberCost {
  memberId: string
  memberName: string
  /** Cost/hour vigente al cierre del periodo (informativo) */
  currentCostHour: number
  /** Horas usadas para el cálculo (reales si mode=actual; teóricas si mode=theoretical) */
  hours: number
  /** Coste imputado al proyecto */
  cost: number
}

export interface MemberCostSummary {
  memberId: string
  memberName: string
  year: number
  /** Coste/hora vigente al final del año */
  currentCostHour: number
  /** Horas teóricas efectivas en el año (calendario - vacaciones - ausencias) */
  effectiveTheoreticalHours: number
  /** Total horas reales fichadas en el año (todos los proyectos) */
  totalHoursLogged: number
  /** Coste empresa real total: sum(time_entries.hours × cost/hora vigente en la fecha) */
  totalCost: number
  /** Coste por proyecto */
  byProject: Array<{ sala: string; hours: number; cost: number }>
}

export interface PortfolioPnL {
  year: number
  mode: CostMode
  totalRevenue: number
  totalCost: number
  margin: number
  marginPct: number
  projects: Array<Pick<ProjectFinance, 'slug' | 'name' | 'totalRevenue' | 'totalCost' | 'margin' | 'marginPct'>>
}

/**
 * Aggregated P&L for all projects of a single cliente.
 *
 * Why it doesn't extend `PortfolioPnL`: the cliente view needs richer
 * per-project info (status, planned end date for "out-of-schedule"
 * indicators) and a monthly aggregate breakdown for charts. Instead of
 * polluting PortfolioPnL with optional fields used only here, ClientePnL
 * declares its own shape.
 *
 * If the cliente has no projects yet the totals are zero, `projects` is
 * an empty array, and `months` contains 12 zeroed entries.
 */
export interface ClientePnL {
  clienteId: string
  /** Number of projects included in the aggregation (excludes archived/cancelled). */
  projectCount: number
  year: number
  mode: CostMode
  totalRevenue: number
  totalCost: number
  margin: number
  marginPct: number
  /** Per-month aggregate (always 12 entries, Jan..Dec) summed across all projects. */
  months: MonthlyPnL[]
  /**
   * Per-month breakdown by project. For drill-down: `monthlyByProject[i]`
   * is an array of `{ slug, name, revenue, cost }` describing what each
   * project contributed to month `i` (0 = January). Empty contributions
   * (revenue + cost === 0) are omitted to keep the UI clean.
   */
  monthlyByProject: MonthlyByProject[]
  /** One row per project, sorted by descending revenue. */
  projects: ClientePnLProject[]
}

/**
 * Per-month-per-project contribution. One entry exists for every project
 * with non-zero figures in that month.
 */
export interface MonthlyByProject {
  /** 0-indexed month (0 = January) — same convention as MonthlyPnL. */
  month: number
  contributions: Array<{
    slug: string
    name: string
    revenue: number
    cost: number
    margin: number
  }>
}

/**
 * One project line inside a ClientePnL. Carries the financial figures
 * plus a couple of fields needed for health indicators (status,
 * planned_end). All fields are read-only; the page just renders them.
 */
export interface ClientePnLProject {
  slug: string
  name: string
  totalRevenue: number
  totalCost: number
  margin: number
  marginPct: number
  /** Project status (active / paused / closed / archived / ...). Optional because the column is nullable. */
  status?: string | null
  /** Planned end date for the project, ISO `yyyy-mm-dd`. Used to flag out-of-schedule projects. */
  plannedEnd?: string | null
}

// ═════════════════════════════════════════════════════════════════════════════
// Internal helpers — local to this service.
// If any of these grow or get reused, promote them to domain/finance.
// ═════════════════════════════════════════════════════════════════════════════

/**
* Convert the app-level Calendario type (with intensive_start/end) into the
 * pure CalendarData shape that domain/finance expects (intensive_start/end).
 * Returns null if the input is null/undefined.
 */
function toCalendarData(cal: Calendario | null | undefined): CalendarData | null {
  if (!cal) return null
  return {
    id: cal.id,
    name: cal.name,
    convenio_hours: cal.convenio_hours ?? 1800,
    daily_hours_lj: cal.daily_hours_lj,
    daily_hours_v: cal.daily_hours_v,
    daily_hours_intensive: cal.daily_hours_intensive,
   intensive_start: cal.intensive_start ?? '',
    intensive_end: cal.intensive_end ?? '',
    holidays: cal.holidays ?? [],
  }
}

/**
 * Convert VacationEntry[] (app-level) into AbsenceData[] (domain-level).
 * VacationEntry stores a single day with a date; AbsenceData expects a range.
 * For day-based entries, from === to and days = 1 (or 0.5 for half days).
 */
function toAbsenceData(vacations: VacationEntry[] | null | undefined, memberId: string): AbsenceData[] {
  if (!vacations || vacations.length === 0) return []
  return vacations.map((v) => ({
    member_id: v.member_id ?? memberId,
    type: v.type,
    date_from: v.date_from ?? v.date,
    date_to: v.date_to ?? v.date,
    days: v.days ?? (v.half ? 0.5 : 1),
    status: v.status ?? 'aprobada',
  }))
}

/**
 * Find the CostRate active on a specific date (yyyy-mm-dd).
 * A rate is active when `from <= date` and (`to` is unset OR `to >= date`).
 * If multiple match, the one with the latest `from` wins.
 * Returns null if member has no rates or none cover the date.
 */
function costRateAt(rates: CostRate[], date: string): CostRate | null {
  if (!rates || rates.length === 0) return null
  const ym = date.slice(0, 7)
  const sorted = [...rates].sort((a, b) => b.from.localeCompare(a.from))
  return sorted.find((r) => r.from <= ym && (!r.to || r.to >= ym)) ?? null
}

/**
 * Resolve cost/hour for a given member at a given date.
 * Falls back to legacy `cost_rate` column if no rates array, then 0.
 */
function memberCostHourAt(member: Member, calendar: CalendarData | null, date: string): number {
  const raw: LegacyCostRate[] = (member.cost_rates ?? []) as LegacyCostRate[]
  const rates = migrateCostRates(raw)
  const convH = calendar?.convenio_hours || 1800
  const active = costRateAt(rates, date)
  if (active && active.salary > 0) {
    return costRateFromSalary(active.salary, active.multiplier, convH)
  }
  return member.cost_rate ?? 0
}

/**
 * Build month-level cost from real time entries, applying the cost/hour
 * that was active on each entry's date. This is the "actual" mode.
 */
function actualCostByMonth(
  entries: TimeEntry[],
  member: Member,
  calendar: CalendarData | null,
): { byMonth: number[]; total: number; totalHours: number } {
  const byMonth = new Array<number>(12).fill(0)
  let total = 0
  let totalHours = 0
  for (const e of entries) {
    if (!e.date || !e.hours) continue
    const m = Number.parseInt(e.date.slice(5, 7), 10) - 1
    if (m < 0 || m > 11) continue
    const ch = memberCostHourAt(member, calendar, e.date)
    const c = e.hours * ch
    byMonth[m]! += c
    total += c
    totalHours += e.hours
  }
  return { byMonth, total, totalHours }
}

/**
 * Compute theoretical full-year cost for a member on a project.
 * Used when mode='incurred' or as a forecast anchor.
 *   cost = effective_hours × dedication × current_cost_hour
 * Returns 0 if member has no calendar or no rate.
 */
function theoreticalCost(
  member: Member,
  calendar: CalendarData | null,
  dedication: number,
  year: number,
): { hours: number; cost: number; costHour: number } {
  if (!calendar) return { hours: 0, cost: 0, costHour: 0 }
  const absences: AbsenceData[] = toAbsenceData(member.vacations, member.id)
  const effHours = effectiveTheoreticalHoursYear(calendar, year, absences, member.id)
  const hours = effHours * dedication
  const convH = calendar.convenio_hours || 1800
  const ch = memberCostHour((member.cost_rates ?? []) as LegacyCostRate[], convH, member.cost_rate ?? 0)
  return { hours, cost: hours * ch, costHour: ch }
}

/**
 * Resolve the dedication of a member on a project for a given year.
 * Reads rooms.member_assigns (jsonb) and intersects periods with the year.
 * If multiple periods overlap, sums their dedications (matches v1 behavior).
 */
function dedicationFor(memberId: string, assigns: MemberAssign[] | undefined, year: number): number {
  if (!assigns || assigns.length === 0) return 0
  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`
  let total = 0
  for (const a of assigns) {
    if (a.member_id !== memberId) continue
    const from = a.from ?? '0000-01-01'
    const to = a.to ?? '9999-12-31'
    if (to < yearStart || from > yearEnd) continue
    total += a.dedication ?? 1
  }
  return total
}

/** Normalize ServiceContractEntry[] from Room to ServiceContract[] used by domain. */
function toServiceContracts(svcs: ServiceContractEntry[] | null | undefined): ServiceContract[] {
  return (svcs ?? []) as ServiceContract[]
}

/**
 * Cost of the contracted services in a given month — same prorating
 * logic as `monthlyRevenueFromServices` but using `service.cost` directly
 * (no margin / risk markup applied).
 *
 * For each service active in month `m`, distributes its `cost` evenly
 * across the months it covers. Services outside the year contribute 0.
 *
 * Returns euros; caller must round if needed.
 */
function monthlyContractCost(services: ServiceContract[], year: number, monthIdx: number): number {
  let total = 0
  const monthStart = new Date(year, monthIdx, 1)
  const monthEnd = new Date(year, monthIdx + 1, 0)

  for (const s of services) {
    const from = new Date(s.from)
    const to = new Date(s.to)
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) continue
    if (to < monthStart || from > monthEnd) continue

    // Total months covered by the service (inclusive). Avoids divide-by-0.
    const fromYM = from.getFullYear() * 12 + from.getMonth()
    const toYM = to.getFullYear() * 12 + to.getMonth()
    const totalMonths = Math.max(1, toYM - fromYM + 1)
    total += (s.cost ?? 0) / totalMonths
  }
  return total
}

/** Read the calendar of a member from the indexed map, mapped to domain shape. */
function memberCalendar(m: Member, calendarsById: Record<string, Calendario>): CalendarData | null {
  if (!m.calendario_id) return null
  const cal = calendarsById[m.calendario_id]
  return cal ? toCalendarData(cal) : null
}

// ═════════════════════════════════════════════════════════════════════════════
// Public API — use cases
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Load complete P&L for a single project for a given year.
 *
 * @param slug - Room slug (e.g. 'vwfs', 'endesa')
 * @param year - Calendar year
 * @param mode - 'actual' uses real time_entries (default); 'incurred' uses calendar × dedication; 'contract' uses services[].cost
 *
 * Throws if the room doesn't exist.
 */
export async function loadProjectFinance(
  slug: string,
  year: number,
  mode: CostMode = 'actual',
): Promise<ProjectFinance> {
  // 1. Load all data needed in parallel
  const [rooms, members, calendariosById] = await Promise.all([
    fetchRooms(),
    fetchTeamMembers(slug),
    fetchCalendariosIndexed(),
  ])

  const room: Room | undefined = rooms.find((r) => r.slug === slug)
  if (!room) throw new Error(`Project not found: ${slug}`)

  const services = toServiceContracts(room.services)
  const assigns: MemberAssign[] = room.member_assigns ?? []

  // 2. Revenue (always from services — same in actual & theoretical mode)
  const monthlyRevenue: number[] = []
  for (let m = 0; m < 12; m++) {
    monthlyRevenue.push(monthlyRevenueFromServices(services, year, m))
  }
  const totalRevenue = monthlyRevenue.reduce((s, x) => s + x, 0)

  // 3. Cost — branch on mode
  const monthlyCost = new Array<number>(12).fill(0)
  const memberCosts: ProjectMemberCost[] = []
  let totalCost = 0

  if (mode === 'actual') {
    const entries = await fetchTimeEntries({ sala: slug, year })
    const entriesByMember: Record<string, TimeEntry[]> = {}
    for (const e of entries) {
      ;(entriesByMember[e.member_id] ??= []).push(e)
    }

    for (const m of members) {
      const cal = memberCalendar(m, calendariosById)
      const memEntries = entriesByMember[m.id] ?? []
      if (memEntries.length === 0) continue
      const { byMonth, total, totalHours } = actualCostByMonth(memEntries, m, cal)
      for (let i = 0; i < 12; i++) monthlyCost[i]! += byMonth[i]!
      totalCost += total
      memberCosts.push({
        memberId: m.id,
        memberName: m.name,
        currentCostHour: memberCostHourAt(m, cal, `${year}-12-31`),
        hours: totalHours,
        cost: total,
      })
    }
  } else if (mode === 'incurred') {
    // incurred: real cost of staff = calendar × dedication × current cost hour
    for (const m of members) {
      const cal = memberCalendar(m, calendariosById)
      const ded = dedicationFor(m.id, assigns, year)
      if (ded <= 0) continue
      const { hours, cost, costHour } = theoreticalCost(m, cal, ded, year)
      if (cost <= 0) continue
      const perMonth = cost / 12
      for (let i = 0; i < 12; i++) monthlyCost[i]! += perMonth
      totalCost += cost
      memberCosts.push({
        memberId: m.id,
        memberName: m.name,
        currentCostHour: costHour,
        hours,
        cost,
      })
    }
  } else {
    // contract: cost from rooms.services[].cost, prorated like the
    // revenue. No member breakdown — this view is the offer the client
    // signed for, not who's executing it.
    for (let m = 0; m < 12; m++) {
      monthlyCost[m]! += monthlyContractCost(services, year, m)
    }
    totalCost = monthlyCost.reduce((s, x) => s + x, 0)
  }

  const margin = totalRevenue - totalCost
  const marginPct = pct(margin, totalRevenue)

  const months: MonthlyPnL[] = []
  for (let i = 0; i < 12; i++) {
    const rev = monthlyRevenue[i]!
    const cost = Math.round(monthlyCost[i]!)
    const mar = rev - cost
    months.push({
      month: i,
      revenue: rev,
      cost,
      margin: mar,
      marginPct: pct(mar, rev),
    })
  }

  return {
    slug: room.slug,
    name: room.name,
    year,
    mode,
    totalRevenue,
    totalCost: Math.round(totalCost),
    margin: Math.round(margin),
    marginPct,
    months,
    members: memberCosts.sort((a, b) => b.cost - a.cost),
  }
}

/**
 * Forecast for a project — full-year projection using theoretical hours.
 * Equivalent to loadProjectFinance(slug, year, 'incurred') but with
 * extra fields useful for forecasting dashboards.
 */
export async function loadProjectForecast(slug: string, year: number): Promise<ProjectFinance & {
  contractedRevenue: number
  contractedCost: number
  contractedMarginPct: number
}> {
  const base = await loadProjectFinance(slug, year, 'incurred')

  const rooms = await fetchRooms()
  const room = rooms.find((r) => r.slug === slug)
  const services = toServiceContracts(room?.services)

  return {
    ...base,
    contractedRevenue: totalSaleFromServices(services),
    contractedCost: totalEstCostFromServices(services),
    contractedMarginPct: avgMarginFromServices(services),
  }
}

/**
 * Cost summary for a single member across all their projects in a year.
 * Uses real time_entries for cost (actual mode).
 */
export async function loadMemberCostSummary(memberId: string, year: number): Promise<MemberCostSummary> {
  const [members, calendariosById, entries] = await Promise.all([
    fetchTeamMembers(),
    fetchCalendariosIndexed(),
    fetchTimeEntries({ memberId, year }),
  ])

  const member = members.find((m) => m.id === memberId)
  if (!member) throw new Error(`Member not found: ${memberId}`)

  const cal = memberCalendar(member, calendariosById)
  const absences: AbsenceData[] = toAbsenceData(member.vacations, member.id)
  const effHours = cal ? effectiveTheoreticalHoursYear(cal, year, absences, member.id) : 0

  const totalsBySala: Record<string, { hours: number; cost: number }> = {}
  let totalCost = 0
  for (const e of entries) {
    if (!e.date || !e.hours) continue
    const ch = memberCostHourAt(member, cal, e.date)
    const c = e.hours * ch
    const sala = e.sala || 'unknown'
    const cur = (totalsBySala[sala] ??= { hours: 0, cost: 0 })
    cur.hours += e.hours
    cur.cost += c
    totalCost += c
  }

  const byProject = Object.entries(totalsBySala)
    .map(([sala, v]) => ({ sala, hours: v.hours, cost: Math.round(v.cost) }))
    .sort((a, b) => b.cost - a.cost)

  return {
    memberId: member.id,
    memberName: member.name,
    year,
    currentCostHour: memberCostHourAt(member, cal, `${year}-12-31`),
    effectiveTheoreticalHours: effHours,
    totalHoursLogged: sumHours(entries),
    totalCost: Math.round(totalCost),
    byProject,
  }
}

/**
 * Portfolio-wide P&L: aggregates every active project for the given year.
 * Useful for the org-level dashboard.
 */
export async function loadAllProjectsPnL(year: number, mode: CostMode = 'actual'): Promise<PortfolioPnL> {
  const rooms = await fetchRooms()
  const projects: PortfolioPnL['projects'] = []
  let totalRevenue = 0
  let totalCost = 0

  for (const r of rooms) {
    if (r.status === 'archived' || r.status === 'cancelled') continue
    try {
      const p = await loadProjectFinance(r.slug, year, mode)
      projects.push({
        slug: p.slug,
        name: p.name,
        totalRevenue: p.totalRevenue,
        totalCost: p.totalCost,
        margin: p.margin,
        marginPct: p.marginPct,
      })
      totalRevenue += p.totalRevenue
      totalCost += p.totalCost
    } catch {
      continue
    }
  }

  const margin = totalRevenue - totalCost
  return {
    year,
    mode,
    totalRevenue,
    totalCost,
    margin,
    marginPct: pct(margin, totalRevenue),
    projects: projects.sort((a, b) => b.totalRevenue - a.totalRevenue),
  }
}

/**
 * Aggregated P&L for all projects belonging to a single cliente.
 *
 * Like `loadAllProjectsPnL` but filtered by `rooms.cliente_id = clienteId`.
 * Excludes archived and cancelled projects. If a project's calculation
 * fails, it is skipped silently (same behaviour as loadAllProjectsPnL).
 *
 * Used by the cliente detail page (`/admin/clientes/:slug`) to show
 * aggregated finance across all the cliente's projects.
 */
export async function loadClientePnL(
  clienteId: string,
  year: number,
  mode: CostMode = 'actual',
): Promise<ClientePnL> {
  const rooms = await fetchRooms()
  const clienteRooms = rooms.filter(r => r.cliente_id === clienteId)
  const projects: ClientePnLProject[] = []
  let totalRevenue = 0
  let totalCost = 0

  // Monthly aggregate: 12 zero buckets (Jan..Dec) summed across projects.
  const monthlyRev = new Array<number>(12).fill(0)
  const monthlyCost = new Array<number>(12).fill(0)
  // Per-month-per-project contributions for drill-down. Initialise 12
  // empty arrays; we'll push one entry per project that had non-zero
  // figures in that month.
  const monthlyContribs: MonthlyByProject['contributions'][] = Array.from({ length: 12 }, () => [])

  for (const r of clienteRooms) {
    if (r.status === 'archived' || r.status === 'cancelled') continue
    try {
      const p = await loadProjectFinance(r.slug, year, mode)
      projects.push({
        slug: p.slug,
        name: p.name,
        totalRevenue: p.totalRevenue,
        totalCost: p.totalCost,
        margin: p.margin,
        marginPct: p.marginPct,
        status: r.status ?? null,
        // `planned_end` is the contractual end date; falls back to
        // `actual_end` for legacy rooms that only filled the latter.
        plannedEnd: r.planned_end ?? r.end_date ?? null,
      })
      totalRevenue += p.totalRevenue
      totalCost += p.totalCost
      // Aggregate monthly buckets + per-project contributions
      for (let i = 0; i < 12; i++) {
        const rev = p.months[i]?.revenue ?? 0
        const cost = p.months[i]?.cost ?? 0
        monthlyRev[i]! += rev
        monthlyCost[i]! += cost
        // Skip noise: empty contributions don't appear in drill-down.
        if (rev !== 0 || cost !== 0) {
          monthlyContribs[i]!.push({
            slug: p.slug,
            name: p.name,
            revenue: rev,
            cost,
            margin: rev - cost,
          })
        }
      }
    } catch {
      continue
    }
  }

  // Build months[] from aggregated buckets
  const months: MonthlyPnL[] = []
  const monthlyByProject: MonthlyByProject[] = []
  for (let i = 0; i < 12; i++) {
    const rev = monthlyRev[i]!
    const cost = monthlyCost[i]!
    months.push({
      month: i,
      revenue: rev,
      cost,
      margin: rev - cost,
      marginPct: pct(rev - cost, rev),
    })
    // Sort contributions by revenue desc so the drill-down panel shows
    // top contributors first.
    monthlyByProject.push({
      month: i,
      contributions: monthlyContribs[i]!.sort((a, b) => b.revenue - a.revenue),
    })
  }

  const margin = totalRevenue - totalCost
  return {
    clienteId,
    projectCount: projects.length,
    year,
    mode,
    totalRevenue,
    totalCost,
    margin,
    marginPct: pct(margin, totalRevenue),
    months,
    monthlyByProject,
    projects: projects.sort((a, b) => b.totalRevenue - a.totalRevenue),
  }
}

/**
 * Dual P&L for a cliente: BOTH "by contract" and "incurred" views in
 * one shot.
 *
 *   - contract: cost based on `rooms.services[].cost` — what was offered
 *               to the client. Margin = revenue - contract cost.
 *               UI label: "Por contrato".
 *   - incurred: cost based on `member_assigns × calendar × hourly rate` —
 *               real cost of the staff actually on the project. Margin
 *               vs the same revenue lets the SM see whether they're
 *               above or below the offered cost.
 *               UI label: "Real".
 *
 * Both use the same revenue (always from services); the only difference
 * is the cost side.
 *
 * Two parallel calls to `loadClientePnL` keep things simple. If this
 * becomes a hot path we can refactor to load rooms once and dispatch.
 */
export interface ClientePnLDual {
  clienteId: string
  year: number
  contract: ClientePnL
  incurred: ClientePnL
}

export async function loadClientePnLDual(clienteId: string, year: number): Promise<ClientePnLDual> {
  const [contract, incurred] = await Promise.all([
    loadClientePnL(clienteId, year, 'contract'),
    loadClientePnL(clienteId, year, 'incurred'),
  ])
  return { clienteId, year, contract, incurred }
}

/**
 * Hours-only summary for a member: theoretical vs logged, by month.
 * No costs — just hours. Useful for balance/jornada widgets.
 */
export async function loadMemberHours(memberId: string, year: number): Promise<{
  memberId: string
  memberName: string
  year: number
  theoreticalHours: number
  loggedHours: number
  balance: number
  byMonth: Record<string, number>
}> {
  const [members, calendariosById, entries] = await Promise.all([
    fetchTeamMembers(),
    fetchCalendariosIndexed(),
    fetchTimeEntries({ memberId, year }),
  ])

  const member = members.find((m) => m.id === memberId)
  if (!member) throw new Error(`Member not found: ${memberId}`)

  const cal = memberCalendar(member, calendariosById)
  const absences: AbsenceData[] = toAbsenceData(member.vacations, member.id)
  const theoreticalHours = cal ? effectiveTheoreticalHoursYear(cal, year, absences, member.id) : 0
  const loggedHours = sumHours(entries)

  return {
    memberId: member.id,
    memberName: member.name,
    year,
    theoreticalHours,
    loggedHours,
    balance: loggedHours - theoreticalHours,
    byMonth: hoursByMonth(entries),
  }
}

/**
 * Members assigned to a project, with their dedication and logged hours for the year.
 */
export async function loadProjectMembers(slug: string, year: number): Promise<Array<{
  memberId: string
  memberName: string
  dedication: number
  hoursLogged: number
  costHour: number
}>> {
  const [rooms, members, entries, calendariosById] = await Promise.all([
    fetchRooms(),
    fetchTeamMembers(slug),
    fetchTimeEntries({ sala: slug, year }),
    fetchCalendariosIndexed(),
  ])

  const room = rooms.find((r) => r.slug === slug)
  if (!room) throw new Error(`Project not found: ${slug}`)
  const assigns: MemberAssign[] = room.member_assigns ?? []
  const hoursMap = hoursByMember(entries)

  return members
    .map((m) => {
      const cal = memberCalendar(m, calendariosById)
      return {
        memberId: m.id,
        memberName: m.name,
        dedication: dedicationFor(m.id, assigns, year),
        hoursLogged: hoursMap[m.id] ?? 0,
        costHour: memberCostHourAt(m, cal, `${year}-12-31`),
      }
    })
    .sort((a, b) => b.dedication - a.dedication)
}

/**
 * Re-export CostRateEntry so existing modules can find it via the service if they prefer.
 * (Kept here so importers that already use @/services/finance don't need a second import.)
 */
export type { CostRateEntry }
