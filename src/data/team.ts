import { supabase } from './supabase'
import type { Member } from '@/types'
import { handleSupabaseError } from '@/lib/errors'

export async function fetchTeamMembers(sala?: string): Promise<Member[]> {
  let query = supabase.from('team_members').select('*').order('name')
  if (sala) {
    query = query.contains('rooms', [sala])
  }
  const { data, error } = await query
  if (error) handleSupabaseError(error)
  return data ?? []
}

export async function updateMember(id: string, updates: Partial<Member>): Promise<void> {
  const { error } = await supabase.from('team_members').update(updates).eq('id', id)
  if (error) handleSupabaseError(error)
}
