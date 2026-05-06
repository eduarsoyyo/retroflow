// ═══ CALENDARIOS — Data access for working calendars ═══
// La tabla `calendarios` almacena los convenios laborales con festivos,
// horas/jornada y periodo intensivo. Cada team_member tiene un calendario_id.

import { handleSupabaseError } from '@/lib/errors'
import { supabase } from './supabase'
import type { Calendario } from '@/types'

/**
 * Load all calendars from Supabase.
 * Order: by name ascending.
 */
export async function fetchCalendarios(): Promise<Calendario[]> {
  const { data, error } = await supabase.from('calendarios').select('*').order('name')
  if (error) handleSupabaseError(error)
  return (data ?? []) as Calendario[]
}

/**
 * Build a map { calendarId -> Calendario } for fast lookup
 * when iterating over many members.
 */
export function indexCalendarios(cals: Calendario[]): Record<string, Calendario> {
  const out: Record<string, Calendario> = {}
  for (const c of cals) {
    if (c.id) out[c.id] = c
  }
  return out
}

/**
 * Load and index in one go — convenience for service layer.
 */
export async function fetchCalendariosIndexed(): Promise<Record<string, Calendario>> {
  const all = await fetchCalendarios()
  return indexCalendarios(all)
}


/**
 * Fetch a single calendario by id.
 * Returns null if no row matches.
 *
 * Used by TimeTracker which loads only the calendar attached to the
 * current user's profile, not all calendars.
 */
export async function fetchCalendarioById(id: string): Promise<Calendario | null> {
  const { data, error } = await supabase.from('calendarios').select('*').eq('id', id).maybeSingle()
  if (error) handleSupabaseError(error)
  return (data as Calendario | null) ?? null
}
