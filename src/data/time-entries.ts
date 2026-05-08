// ═══ TIME ENTRIES — Data access for fichajes ═══
// Lee horas reales fichadas desde la tabla time_entries de Supabase.
// Sigue el patrón del repo: throw on error vía handleSupabaseError.

import { handleSupabaseError } from '@/lib/errors'
import { supabase } from './supabase'

export interface TimeEntry {
  id: string
  member_id: string
  sala: string
  date: string
  hours: number
  category?: string | null
  description?: string | null
  auto_distributed?: boolean | null
  status?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface TimeEntriesFilter {
  /** Filter by project slug (rooms.slug). Optional. */
  sala?: string
  /** Filter by member id. Optional. */
  memberId?: string
  /** Filter by multiple member ids (uses .in). Optional. */
  memberIds?: string[]
  /** Inclusive lower bound for `date` (yyyy-mm-dd). Optional. */
  dateFrom?: string
  /** Inclusive upper bound for `date` (yyyy-mm-dd). Optional. */
  dateTo?: string
  /** Filter by year — shortcut for dateFrom/dateTo of that year. */
  year?: number
  /** Only count fichajes with these statuses. Defaults to all. */
  statuses?: string[]
}

/**
 * Load time entries with optional filters.
 * Returns entries ordered by date ascending.
 *
 * Examples:
 *   fetchTimeEntries({ sala: 'vwfs', year: 2026 })
 *   fetchTimeEntries({ memberId: 'abc', dateFrom: '2026-01-01', dateTo: '2026-03-31' })
 */
export async function fetchTimeEntries(filter: TimeEntriesFilter = {}): Promise<TimeEntry[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase.from('time_entries').select('*').order('date', { ascending: true })

  if (filter.sala) query = query.eq('sala', filter.sala)
  if (filter.memberId) query = query.eq('member_id', filter.memberId)
  if (filter.memberIds && filter.memberIds.length > 0) {
    query = query.in('member_id', filter.memberIds)
  }

  // Resolve year shortcut (only if no explicit dateFrom/dateTo).
  let dateFrom = filter.dateFrom
  let dateTo = filter.dateTo
  if (filter.year !== undefined && !dateFrom && !dateTo) {
    dateFrom = `${filter.year}-01-01`
    dateTo = `${filter.year}-12-31`
  }
  if (dateFrom) query = query.gte('date', dateFrom)
  if (dateTo) query = query.lte('date', dateTo)

  if (filter.statuses && filter.statuses.length > 0) {
    query = query.in('status', filter.statuses)
  }

  const { data, error } = await query
  if (error) handleSupabaseError(error)
  return (data ?? []) as TimeEntry[]
}

/**
 * Sum hours from a list of TimeEntry. Pure helper, no DB access.
 */
export function sumHours(entries: TimeEntry[]): number {
  return entries.reduce((s, e) => s + (e.hours || 0), 0)
}

/**
 * Group time entries by member id, returning total hours per member.
 */
export function hoursByMember(entries: TimeEntry[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const e of entries) {
    if (!e.member_id) continue
    out[e.member_id] = (out[e.member_id] || 0) + (e.hours || 0)
  }
  return out
}

/**
 * Group time entries by month (yyyy-mm), returning total hours per month.
 */
export function hoursByMonth(entries: TimeEntry[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const e of entries) {
    const ym = (e.date ?? '').slice(0, 7)
    if (!ym) continue
    out[ym] = (out[ym] || 0) + (e.hours || 0)
  }
  return out
}


/**
 * Insert a new time_entry row.
 *
 * Used by admin panels (UsersPanel bulk fichaje, ClockWidget, TimeTracker)
 * that record hours worked. The DB generates `id`, `created_at` and
 * `updated_at` automatically.
 *
 * Throws RevelioError on Supabase errors via handleSupabaseError.
 */
export async function createTimeEntry(
  entry: Omit<TimeEntry, 'id' | 'created_at' | 'updated_at'>,
): Promise<void> {
  const { error } = await supabase.from('time_entries').insert(entry)
  if (error) handleSupabaseError(error)
}


/**
 * Update fields on a time_entry by id.
 *
 * Typical patches: { status: 'approved' | 'rejected' }, mostly used
 * by approval flows in TimeTracker.
 */
export async function updateTimeEntry(
  id: string,
  patch: Partial<Omit<TimeEntry, 'id' | 'created_at' | 'updated_at'>>,
): Promise<void> {
  const { error } = await supabase.from('time_entries').update(patch).eq('id', id)
  if (error) handleSupabaseError(error)
}

/**
 * Delete time_entries matching a (memberId, date, sala) tuple.
 *
 * Used by retro fichaje flow where a user re-submits hours for a day
 * and we need to clean previous pending/rejected rows for the same
 * member-day-sala combination before inserting the new one.
 *
 * If sala is omitted, deletes ALL entries for that member-day across
 * salas — be careful, this is destructive. Caller decides.
 */
export async function deleteTimeEntries(filter: {
  memberId: string
  date: string
  sala?: string
}): Promise<void> {
  let query = supabase
    .from('time_entries')
    .delete()
    .eq('member_id', filter.memberId)
    .eq('date', filter.date)
  if (filter.sala) query = query.eq('sala', filter.sala)
  const { error } = await query
  if (error) handleSupabaseError(error)
}


/**
 * Upsert a time_entry row — insert if (member_id, sala, date) doesn't exist,
 * update otherwise. Atomic at the DB level.
 *
 * Used by ClockWidget when stopping the clock: it (re)distributes the day's
 * hours across active projects, and a previous entry for the same
 * member-sala-day must be overwritten with the new total.
 *
 * `onConflict` defaults to 'member_id,sala,date' which matches the unique
 * index used by the clock distribution flow. Pass a different key only if
 * you have a custom unique constraint on the table.
 */
export async function upsertTimeEntry(
  entry: Omit<TimeEntry, 'id' | 'created_at' | 'updated_at'>,
  onConflict: string = 'member_id,sala,date',
): Promise<void> {
  const { error } = await supabase
    .from('time_entries')
    .upsert(entry, { onConflict })
  if (error) handleSupabaseError(error)
}
