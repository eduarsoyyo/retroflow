// ═══ TEAM SERVICE ═══ Aggregates org_chart multi-period assignments.
// Use case: components ask "who is on this project as of date X, and at what
// effective dedication?". Multi-period rows for the same member are summed.
//
// Layer rules (Clean Architecture):
//   - This file is the ONLY place that combines team_members + org_chart.
//   - Components NEVER call data/orgChart directly for project membership.
//   - This file does NOT import from components/ or hooks/.
//   - Pure helpers (isPeriodActive, aggregateOrgChartByMember) are exported
//     so tests can cover them in isolation, and so other services can reuse.

import { fetchTeamMembers } from '@/data/team'
import { fetchOrgChartBySala } from '@/data/orgChart'
import type { Member, OrgChartEntry } from '@/types'

// ════════════════════════════════════════════════════════════════════════════
// Public types — what the components consume
// ════════════════════════════════════════════════════════════════════════════

export interface MemberDedicationSlice {
  member: Member
  /** Sum of dedications of all active periods at `asOf` (0..N). */
  effectiveDedication: number
  /** The org_chart rows that were active at `asOf`. */
  activePeriods: OrgChartEntry[]
}

export interface LoadProjectTeamOptions {
  sala: string
  /** ISO `yyyy-mm-dd`. Defaults to today. */
  asOf?: string
}

// ════════════════════════════════════════════════════════════════════════════
// Use case
// ════════════════════════════════════════════════════════════════════════════

/**
 * Load the active team of a project at a given date with aggregated dedication.
 *
 * Multi-period rules:
 *   - A member may appear several times in `org_chart` for the same sala.
 *   - Periods overlapping `asOf` are summed (e.g. 0.5 + 0.3 → 0.8).
 *   - Periods outside `asOf` are excluded.
 *   - Empty start_date / end_date means "open" on that side.
 *
 * Members in org_chart but not in team_members (orphans) are excluded.
 */
export async function loadProjectTeam(opts: LoadProjectTeamOptions): Promise<MemberDedicationSlice[]> {
  const asOf = opts.asOf ?? today()
  const [members, orgEntries] = await Promise.all([fetchTeamMembers(), fetchOrgChartBySala(opts.sala)])
  const memberById = new Map(members.map((m) => [m.id, m]))
  const aggregated = aggregateOrgChartByMember(orgEntries, asOf)

  const out: MemberDedicationSlice[] = []
  for (const [memberId, info] of aggregated) {
    const member = memberById.get(memberId)
    if (!member) continue
    out.push({ member, effectiveDedication: info.effectiveDedication, activePeriods: info.activePeriods })
  }
  return out
}

// ════════════════════════════════════════════════════════════════════════════
// Pure helpers — exported for direct testing and reuse in other services
// ════════════════════════════════════════════════════════════════════════════

interface AggregatedMemberInfo {
  effectiveDedication: number
  activePeriods: OrgChartEntry[]
}

/**
 * Group org_chart entries by member_id, summing the dedication of all
 * periods active at `asOf`. Returns a map { memberId -> info }.
 */
export function aggregateOrgChartByMember(
  entries: OrgChartEntry[],
  asOf: string,
): Map<string, AggregatedMemberInfo> {
  const out = new Map<string, AggregatedMemberInfo>()
  for (const e of entries) {
    if (!isPeriodActive(e, asOf)) continue
    const dedication = clampDedication(e.dedication ?? 1)
    const prev = out.get(e.member_id)
    if (prev) {
      prev.effectiveDedication += dedication
      prev.activePeriods.push(e)
    } else {
      out.set(e.member_id, { effectiveDedication: dedication, activePeriods: [e] })
    }
  }
  return out
}

/**
 * Test whether an org_chart entry is active on a given date.
 * Empty start_date / end_date are treated as open-ended on that side.
 * Both ends are inclusive.
 */
export function isPeriodActive(entry: OrgChartEntry, asOf: string): boolean {
     const start = entry.start_date && entry.start_date.length > 0 ? entry.start_date : null
     const end = entry.end_date && entry.end_date.length > 0 ? entry.end_date : null
     if (start && asOf < start) return false
     if (end && asOf > end) return false
     return true
   }

function clampDedication(d: number): number {
  if (!Number.isFinite(d) || d < 0) return 0
  return d
  }
/**
 * Resolve the dedication of a member on a specific date.
 *
 * Rules:
 *   - Considers only entries belonging to `memberId`.
 *   - Sums dedications of all entries active at `date` (multi-period robust).
 *   - Periods with empty start_date or end_date are treated as open on that side.
 *   - If no entry is active at `date`, returns 0.
 *   - Negative or NaN dedications are clamped to 0.
 */
export function dedicationAt(entries: OrgChartEntry[], memberId: string, date: string): number {
  let sum = 0
  for (const e of entries) {
    if (e.member_id !== memberId) continue
    if (!isPeriodActive(e, date)) continue
    sum += clampDedication(e.dedication ?? 1)
  }
  return sum
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}
