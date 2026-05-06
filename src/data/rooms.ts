import { handleSupabaseError } from '@/lib/errors'
import type { Room } from '@/types'
import { supabase } from './supabase'

export async function fetchRooms(): Promise<Room[]> {
  const { data, error } = await supabase.from('rooms').select('*').order('name')
  if (error) handleSupabaseError(error)
  return data ?? []
}

/**
 * Load all rooms (projects) linked to a given cliente by cliente_id.
 * Sorted alphabetically by name. Used by the cliente detail page to
 * show the projects associated with the cliente.
 */
export async function fetchRoomsByCliente(clienteId: string): Promise<Room[]> {
  const { data, error } = await supabase.from('rooms').select('*').eq('cliente_id', clienteId).order('name')
  if (error) handleSupabaseError(error)
  return data ?? []
}

/**
 * Insert a new room and return the inserted row.
 *
 * The DB-side defaults (timestamps, slug normalisation if any) mean
 * the returned row is the source of truth — callers should use the
 * returned `Room` rather than the input payload.
 *
 * Throws RevelioError on Supabase errors (FK violation, unique slug,
 * etc) via handleSupabaseError.
 */
export async function createRoom(
  room: Omit<Room, 'metadata'> & { metadata?: Record<string, unknown> },
): Promise<Room> {
  const { data, error } = await supabase.from('rooms').insert(room).select().single()
  if (error) handleSupabaseError(error)
  return data as Room
}

/**
 * Update fields on a room identified by slug. Returns the updated row
 * so callers can reflect server-side mutations (timestamps, normalised
 * fields) in their local state.
 *
 * `patch` is a partial — only the fields present are updated. Slug
 * itself is NOT updatable here (would need a separate flow that also
 * cascades to org_chart, retros, etc).
 */
export async function updateRoom(
  slug: string,
  patch: Partial<Omit<Room, 'slug'>>,
): Promise<Room> {
  const { data, error } = await supabase.from('rooms').update(patch).eq('slug', slug).select().single()
  if (error) handleSupabaseError(error)
  return data as Room
}

export async function deleteRoom(slug: string): Promise<void> {
  const { error } = await supabase.from('rooms').delete().eq('slug', slug)
  if (error) handleSupabaseError(error)
}
