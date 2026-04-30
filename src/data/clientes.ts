// ═══ CLIENTES ═══ Pure DB access for the clientes table.
// A cliente represents an organization that ALTEN sells services to.
// One cliente can be linked to many rooms (projects) via rooms.cliente_id.
import { handleSupabaseError } from '@/lib/errors'
import type { Cliente } from '@/types'
import { supabase } from './supabase'

const COLS = 'id, slug, name, logo_url, contact_name, contact_email, notes, status, created_at'

/**
 * Load all clientes ordered by name.
 */
export async function fetchClientes(): Promise<Cliente[]> {
  const { data, error } = await supabase.from('clientes').select(COLS).order('name')
  if (error) handleSupabaseError(error)
  return (data ?? []) as Cliente[]
}

/**
 * Load a cliente by its slug. Returns null if not found.
 */
export async function fetchClienteBySlug(slug: string): Promise<Cliente | null> {
  const { data, error } = await supabase.from('clientes').select(COLS).eq('slug', slug).maybeSingle()
  if (error) handleSupabaseError(error)
  return (data as Cliente | null) ?? null
}

/**
 * Load a cliente by its uuid. Returns null if not found.
 */
export async function fetchClienteById(id: string): Promise<Cliente | null> {
  const { data, error } = await supabase.from('clientes').select(COLS).eq('id', id).maybeSingle()
  if (error) handleSupabaseError(error)
  return (data as Cliente | null) ?? null
}

/**
 * Create a new cliente. The DB generates id and created_at.
 * `slug` and `name` are required; everything else is optional.
 */
export async function createCliente(cliente: Omit<Cliente, 'id' | 'created_at'>): Promise<Cliente> {
  const { data, error } = await supabase.from('clientes').insert(cliente).select(COLS).single()
  if (error) handleSupabaseError(error)
  return data as Cliente
}

/**
 * Update an existing cliente by id.
 */
export async function updateCliente(id: string, updates: Partial<Omit<Cliente, 'id' | 'created_at'>>): Promise<void> {
  const { error } = await supabase.from('clientes').update(updates).eq('id', id)
  if (error) handleSupabaseError(error)
}

/**
 * Delete a cliente by id.
 * NOTE: this only deletes the cliente row. Linked rooms will keep their
 * dangling cliente_id pointing to a deleted record. Cascade behaviour
 * should be handled by FK constraint at DB level.
 */
export async function deleteCliente(id: string): Promise<void> {
  const { error } = await supabase.from('clientes').delete().eq('id', id)
  if (error) handleSupabaseError(error)
}