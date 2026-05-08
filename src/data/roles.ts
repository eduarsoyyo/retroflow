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


/**
 * Slim shape for admin role rows when callers need the full row
 * (e.g. RolesPanel for CRUD), not just the names list returned by
 * `fetchAdminRoles`.
 */
export interface AdminRoleRow {
  id?: string
  name: string
}

/**
 * Fetch all admin_roles rows ordered by name. Returns the raw rows
 * (not just names) for management panels that need to render, edit
 * and delete each role individually.
 *
 * For dropdowns/selects that just need the list of names, prefer
 * `fetchAdminRoles` (returns string[] with legacy fallback).
 */
export async function fetchAdminRolesFull(): Promise<AdminRoleRow[]> {
  const { data, error } = await supabase.from('admin_roles').select('*').order('name')
  if (error) handleSupabaseError(error)
  return (data ?? []) as AdminRoleRow[]
}

/**
 * Insert a new admin_role row by name. Caller is responsible for
 * uniqueness validation client-side; the DB unique constraint on
 * `name` will throw if the row already exists.
 */
export async function createAdminRole(name: string): Promise<void> {
  const { error } = await supabase.from('admin_roles').insert({ name })
  if (error) handleSupabaseError(error)
}

/**
 * Rename an admin_role identified by old name. Note: this only
 * updates the admin_roles row. The cascade to team_members.role_label
 * (which stores the label as a denormalised string) must be done
 * separately via `updateMembersByRoleLabel(oldName, newName)`.
 */
export async function renameAdminRole(oldName: string, newName: string): Promise<void> {
  const { error } = await supabase
    .from('admin_roles')
    .update({ name: newName })
    .eq('name', oldName)
  if (error) handleSupabaseError(error)
}

/**
 * Delete an admin_role by name. Note: this does NOT cascade to
 * team_members.role_label. Callers must follow up with
 * `updateMembersByRoleLabel(name, '')` to clear the label from
 * affected members.
 */
export async function deleteAdminRole(name: string): Promise<void> {
  const { error } = await supabase.from('admin_roles').delete().eq('name', name)
  if (error) handleSupabaseError(error)
}
