// ═══ ABSENCES DATA ═══ Pure DB access for the absence_requests table.
//
// Mirrors the approval workflow from TimeTracker (request → review →
// aprobada/rechazada/pendiente). This module only exposes the read
// functions used by panels that AGGREGATE absences across many members
// (ProjectsPanel, NotificationBell badges, dashboards). The full
// CRUD flow (request, approve, reject) lives in the consumer
// component for now — when 4.2c migrates TimeTracker, we'll move
// it here and grow this file.

import { supabase } from './supabase'
import { handleSupabaseError } from '@/lib/errors'

/**
 * Slim shape used by aggregate consumers. Matches the columns
 * historically requested by ProjectsPanel and friends so existing
 * downstream calculations (memberProjectCost taking AbsenceData[]
 * from domain/finance) keep working without a casting dance.
 */
export interface AbsenceLite {
  member_id: string
  type: string
  date_from: string
  date_to: string
  days: number
  status: string
}

/**
 * Load absence_requests across all members with the slim shape above.
 *
 * Despite the name `fetchApprovedAbsences`, this currently returns
 * ALL statuses (pendiente / aprobada / rechazada). Filtering by
 * status is left to consumers because some need pending+approved
 * (forecasting), others only approved (historical reporting).
 *
 * If a future caller actually needs a filtered fetch, prefer adding
 * `fetchAbsencesByStatus(status)` rather than mutating this one.
 */
export async function fetchApprovedAbsences(): Promise<AbsenceLite[]> {
  const { data, error } = await supabase
    .from('absence_requests')
    .select('member_id, type, date_from, date_to, days, status')
  if (error) handleSupabaseError(error)
  return (data ?? []) as AbsenceLite[]
}


/**
 * Full row shape for absence_requests.
 * Matches the DB columns; use this when consumers need fields beyond
 * the slim `AbsenceLite` (e.g., notes, reviewer, timestamps).
 */
export interface AbsenceRequest {
  id: string
  member_id: string
  type: string
  date_from: string
  date_to: string
  days: number
  status: string
  notes?: string | null
  created_at?: string | null
  reviewed_by?: string | null
  reviewed_at?: string | null
}

/**
 * Fetch all absence_requests for a single member (full row shape).
 *
 * Used by TimeTracker to render the user's own absence calendar
 * (showing every status: pendiente, aprobada, rechazada).
 */
export async function fetchAbsencesByMember(memberId: string): Promise<AbsenceRequest[]> {
  const { data, error } = await supabase
    .from('absence_requests')
    .select('*')
    .eq('member_id', memberId)
  if (error) handleSupabaseError(error)
  return (data ?? []) as AbsenceRequest[]
}

/**
 * Fetch absence_requests by status, optionally restricted to a list of members.
 *
 * Used by approval flows: a manager sees pending requests from their
 * direct reports; a superuser without reports sees all pending.
 *
 * If `memberIds` is provided but empty, returns []. If omitted, returns
 * all matches across the org.
 */
export async function fetchAbsencesByStatus(
  status: string,
  memberIds?: string[],
): Promise<AbsenceRequest[]> {
  if (memberIds && memberIds.length === 0) return []
  let query = supabase.from('absence_requests').select('*').eq('status', status)
  if (memberIds && memberIds.length > 0) {
    query = query.in('member_id', memberIds)
  }
  const { data, error } = await query
  if (error) handleSupabaseError(error)
  return (data ?? []) as AbsenceRequest[]
}

/**
 * Insert a new absence_request row.
 *
 * The DB generates `id`, `created_at`. The caller provides member_id,
 * type, date range, days, optional notes, and the initial status
 * (typically 'pendiente').
 */
export async function createAbsenceRequest(
  request: Omit<AbsenceRequest, 'id' | 'created_at' | 'reviewed_by' | 'reviewed_at'>,
): Promise<void> {
  const { error } = await supabase.from('absence_requests').insert(request)
  if (error) handleSupabaseError(error)
}

/**
 * Update an absence_request by id.
 *
 * Most common patch: { status, reviewed_by, reviewed_at } when a
 * manager approves/rejects.
 */
export async function updateAbsenceRequest(
  id: string,
  patch: Partial<Omit<AbsenceRequest, 'id' | 'created_at'>>,
): Promise<void> {
  const { error } = await supabase.from('absence_requests').update(patch).eq('id', id)
  if (error) handleSupabaseError(error)
}

/**
 * Delete an absence_request by id.
 *
 * Used by users canceling their own pending requests, or admins
 * cleaning up rejected entries.
 */
export async function deleteAbsenceRequest(id: string): Promise<void> {
  const { error } = await supabase.from('absence_requests').delete().eq('id', id)
  if (error) handleSupabaseError(error)
}
