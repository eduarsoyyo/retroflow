// ═══ ROLES DATA ═══ Pure DB access for admin_roles + legacy roles tables.
//
// History — there are two role tables in the DB:
//   - admin_roles (current): { id, name }
//   - roles (legacy): { id, label, name? } — predates the v2 schema
//
// New rows always go into admin_roles. The legacy table is kept as a
// readonly fallback for installs that haven't been fully migrated yet.
// `fetchAdminRoles` tries admin_roles first and only falls back to
// `roles` if the admin table is empty.

import { supabase } from './supabase'
import { handleSupabaseError } from '@/lib/errors'

/**
 * Returns the catalogue of role labels available to assign to members.
 *
 * Strategy:
 *   1. Read `admin_roles` (current source of truth).
 *   2. If non-empty, return its `name` column.
 *   3. Otherwise fall back to legacy `roles.label` (or `roles.name`).
 *   4. If both fail, return [].
 *
 * Errors from the primary read throw via handleSupabaseError. Errors
 * from the legacy fallback are swallowed because legacy is best-effort.
 */
export async function fetchAdminRoles(): Promise<string[]> {
  // Primary: admin_roles
  const { data, error } = await supabase.from('admin_roles').select('*').order('name')
  if (error) handleSupabaseError(error)
  if (data && data.length > 0) {
    return data
      .map((r: Record<string, unknown>) => String(r.name || r.label || ''))
      .filter(Boolean)
  }

  // Legacy fallback: roles
  try {
    const { data: legacy } = await supabase.from('roles').select('*').order('label')
    if (legacy && legacy.length > 0) {
      return legacy
        .map((r: Record<string, unknown>) => String(r.label || r.name || ''))
        .filter(Boolean)
    }
  } catch {
    // Best-effort: legacy might not exist on newer installs.
  }

  return []
}
