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

export async function createRoom(room: Omit<Room, 'metadata'> & { metadata?: Record<string, unknown> }): Promise<void> {
  const { error } = await supabase.from('rooms').insert(room)
  if (error) handleSupabaseError(error)
}

export async function deleteRoom(slug: string): Promise<void> {
  const { error } = await supabase.from('rooms').delete().eq('slug', slug)
  if (error) handleSupabaseError(error)
}
