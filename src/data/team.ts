import { handleSupabaseError } from '@/lib/errors'
import type { Member } from '@/types'
import { supabase } from './supabase'

export async function fetchTeamMembers(sala?: string): Promise<Member[]> {
  let query = supabase.from('team_members').select('*').order('name')
  if (sala) {
    // `rooms` is a jsonb column (array of slug strings), NOT a Postgres
    // array. Supabase serialises `.contains('rooms', [sala])` as
    // `cs.{value}` (Postgres array literal), which Postgres rejects with
    // 22P02 against jsonb. The correct payload is a JSON string so it
    // becomes `cs.["value"]` and Postgres can parse it as jsonb.
    query = query.contains('rooms', JSON.stringify([sala]))
  }
  const { data, error } = await query
  if (error) handleSupabaseError(error)
  return data ?? []
}

export async function updateMember(id: string, updates: Partial<Member>): Promise<void> {
  const { error } = await supabase.from('team_members').update(updates).eq('id', id)
  if (error) handleSupabaseError(error)
}
