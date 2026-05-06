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
