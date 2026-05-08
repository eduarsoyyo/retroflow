// ═══ CLOCK EVENTS DATA ═══ Pure DB access for the clock_events table.
//
// `clock_events` records start/stop/break events from ClockWidget. One
// row per event, ordered by timestamp. Read-only here; ClockWidget owns
// the insert flow (will be migrated in 4.3).

import { supabase } from './supabase'
import { handleSupabaseError } from '@/lib/errors'

/**
 * Slim shape returned by `fetchClockEventsByMember`. TimeTracker only
 * needs event/timestamp/date to compute daily worked time, so we don't
 * fetch the rest of the row.
 */
export interface ClockEventLite {
  event: string
  timestamp: string
  date: string
}

/**
 * Fetch clock_events for a member within a date range.
 * Ordered by timestamp ascending (chronological).
 *
 * Used by TimeTracker to reconstruct the day's clock-in/out timeline
 * for the visual jornada chart.
 */
export async function fetchClockEventsByMember(
  memberId: string,
  range: { from: string; to: string },
): Promise<ClockEventLite[]> {
  const { data, error } = await supabase
    .from('clock_events')
    .select('event, timestamp, date')
    .eq('member_id', memberId)
    .gte('date', range.from)
    .lte('date', range.to)
    .order('timestamp')
  if (error) handleSupabaseError(error)
  return (data ?? []) as ClockEventLite[]
}


/**
 * Insert a new clock_event row.
 *
 * Used by ClockWidget to log start/pause/resume/stop events as the
 * user clocks in/out throughout the day. The DB generates the
 * timestamp via DEFAULT now().
 */
export async function createClockEvent(
  event: { member_id: string; date: string; event: string },
): Promise<void> {
  const { error } = await supabase.from('clock_events').insert(event)
  if (error) handleSupabaseError(error)
}
