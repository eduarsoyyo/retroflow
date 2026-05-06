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

/**
 * Update fields on a team_member without returning the row.
 * Kept as Promise<void> because 18+ consumers depend on this signature.
 * For the rare case where the updated row is needed (admin panels that
 * patch local state), use `updateMemberFull` below.
 */
export async function updateMember(id: string, updates: Partial<Member>): Promise<void> {
  const { error } = await supabase.from('team_members').update(updates).eq('id', id)
  if (error) handleSupabaseError(error)
}

/**
 * Insert a new team_member row and return the inserted row.
 *
 * The returned `Member` reflects DB-side defaults (created_at,
 * normalised fields). Callers should use the returned row to update
 * local state instead of relying on the input payload.
 *
 * Throws RevelioError on Supabase errors (duplicate id, FK violation,
 * etc) via handleSupabaseError.
 */
export async function createMember(
  member: Partial<Member> & { id: string; name: string },
): Promise<Member> {
  const { data, error } = await supabase
    .from('team_members')
    .insert(member)
    .select()
    .single()
  if (error) handleSupabaseError(error)
  return data as Member
}

/**
 * Update a team_member and return the updated row.
 *
 * Use this variant (instead of `updateMember`) when the caller needs
 * the new row to refresh local state — typically admin edit modals
 * that patch the in-memory list after save. Returns the full Member
 * so callers can spread it directly into state.
 *
 * For fire-and-forget updates, prefer `updateMember` (no row roundtrip).
 */
export async function updateMemberFull(
  id: string,
  updates: Partial<Member>,
): Promise<Member> {
  const { data, error } = await supabase
    .from('team_members')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) handleSupabaseError(error)
  return data as Member
}

/**
 * Delete a team_member by id.
 *
 * Note: this does NOT cascade delete linked rows in `org_chart`,
 * `time_entries`, etc. Callers responsible for project assignments
 * (admin panels) must clean those up explicitly via
 * `deleteOrgChartByMember`, etc.
 */
export async function deleteMember(id: string): Promise<void> {
  const { error } = await supabase.from('team_members').delete().eq('id', id)
  if (error) handleSupabaseError(error)
}


/**
 * Fetch a single team_member by id, returning the full row.
 * Returns null if no row matches (uses maybeSingle, not single).
 *
 * Used by panels that need profile fields outside the bulk fetch
 * (e.g., TimeTracker reading own vacation_carryover, calendario_id).
 */
export async function fetchMemberById(id: string): Promise<Member | null> {
  const { data, error } = await supabase.from('team_members').select('*').eq('id', id).maybeSingle()
  if (error) handleSupabaseError(error)
  return (data as Member | null) ?? null
}

/**
 * Fetch the slim list of members managed by a given responsable.
 * Returns only `id` (caller usually only needs the IDs to query
 * downstream tables filtered by member_id IN (...)).
 *
 * Used by TimeTracker / approval flows where the manager loads pending
 * items only for direct reports.
 */
export async function fetchManagedMembers(responsableId: string): Promise<Array<{ id: string }>> {
  const { data, error } = await supabase
    .from('team_members')
    .select('id')
    .eq('responsable_id', responsableId)
  if (error) handleSupabaseError(error)
  return (data ?? []) as Array<{ id: string }>
}
