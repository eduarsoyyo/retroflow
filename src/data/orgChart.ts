// ═══ ORG CHART DATA ═══ Pure DB access for the org_chart table.
// One row = one assignment of a member to a project (sala).
// A member can have multiple rows in the same sala for multi-period dedication.

import { supabase } from './supabase'
import { handleSupabaseError } from '@/lib/errors'
import type { OrgChartEntry } from '@/types'

const COLS = 'id, sala, member_id, manager_id, dedication, start_date, end_date'

/**
 * Load all org_chart rows for a single sala.
 * Returns [] on Supabase error after delegating to handleSupabaseError
 * (which throws RevelioError, so callers will normally catch upstream).
 */
export async function fetchOrgChartBySala(sala: string): Promise<OrgChartEntry[]> {
  const { data, error } = await supabase.from('org_chart').select(COLS).eq('sala', sala)
  if (error) handleSupabaseError(error)
  return (data ?? []) as OrgChartEntry[]
}

/**
 * Load org_chart rows for several salas in a single round-trip.
 * Returns a map { sala -> entries } so callers can index by project.
 */
export async function fetchOrgChartBySalas(salas: string[]): Promise<Record<string, OrgChartEntry[]>> {
  if (salas.length === 0) return {}
  const { data, error } = await supabase.from('org_chart').select(COLS).in('sala', salas)
  if (error) handleSupabaseError(error)

  const grouped: Record<string, OrgChartEntry[]> = {}
  for (const row of (data ?? []) as OrgChartEntry[]) {
    const list = grouped[row.sala]
    if (list) {
      list.push(row)
    } else {
      grouped[row.sala] = [row]
    }
  }
  return grouped
}

/**
 * Load all org_chart rows across every sala.
 *
 * Used by admin panels that need a global view of project assignments
 * (e.g. ProjectsPanel cross-checks who is assigned where). For
 * sala-specific reads, prefer `fetchOrgChartBySala` to reduce payload.
 */
export async function fetchAllOrgChart(): Promise<OrgChartEntry[]> {
  const { data, error } = await supabase.from('org_chart').select(COLS)
  if (error) handleSupabaseError(error)
  return (data ?? []) as OrgChartEntry[]
}

/**
 * Insert a new org_chart row (member assignment to a sala) and return
 * the inserted row with its DB-generated id.
 *
 * `dedication` is stored as a 0..1 fraction (1 = full time); callers
 * with percent-based UIs must divide by 100 before calling.
 */
export async function createOrgChartEntry(
  entry: Omit<OrgChartEntry, 'id'>,
): Promise<OrgChartEntry> {
  const { data, error } = await supabase
    .from('org_chart')
    .insert(entry)
    .select(COLS)
    .single()
  if (error) handleSupabaseError(error)
  return data as OrgChartEntry
}

/**
 * Update fields on an existing org_chart row identified by `id`.
 * Returns the updated row so callers can reflect server-side state.
 *
 * Typical patches: dedication, start_date, end_date. Member and sala
 * shouldn't change — to move someone, delete the entry and create a
 * new one in the destination sala.
 */
export async function updateOrgChartEntry(
  id: string,
  patch: Partial<Omit<OrgChartEntry, 'id'>>,
): Promise<OrgChartEntry> {
  const { data, error } = await supabase
    .from('org_chart')
    .update(patch)
    .eq('id', id)
    .select(COLS)
    .single()
  if (error) handleSupabaseError(error)
  return data as OrgChartEntry
}


/**
 * Delete a single org_chart row identified by member + sala.
 *
 * Used when an admin removes a project assignment from a member without
 * touching others. There can be multiple rows per (member, sala) pair
 * for multi-period dedication; this deletes ALL of them in one call.
 */
export async function deleteOrgChartByMemberAndSala(
  memberId: string,
  sala: string,
): Promise<void> {
  const { error } = await supabase
    .from('org_chart')
    .delete()
    .eq('member_id', memberId)
    .eq('sala', sala)
  if (error) handleSupabaseError(error)
}

/**
 * Delete all org_chart rows for a given member.
 *
 * Used when deleting a team_member: cleans up every project assignment
 * the member had. Idempotent — safe to call even if there are no rows.
 */
export async function deleteOrgChartByMember(memberId: string): Promise<void> {
  const { error } = await supabase
    .from('org_chart')
    .delete()
    .eq('member_id', memberId)
  if (error) handleSupabaseError(error)
}


/**
 * Fetch all org_chart rows for a single member across every sala.
 *
 * Used by approval flows that need to know the member's current
 * project distribution to compute hour distribution (TimeTracker
 * approving a retro fichaje proportionally by dedication %).
 */
export async function fetchOrgChartByMember(memberId: string): Promise<OrgChartEntry[]> {
  const { data, error } = await supabase
    .from('org_chart')
    .select(COLS)
    .eq('member_id', memberId)
  if (error) handleSupabaseError(error)
  return (data ?? []) as OrgChartEntry[]
}
