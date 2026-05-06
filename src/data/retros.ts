import { handleSupabaseError } from '@/lib/errors'
import type { Retro } from '@/types'
import { supabase } from './supabase'

export async function fetchRetro(sala: string): Promise<Retro | null> {
  const { data, error } = await supabase
    .from('retros')
    .select('*')
    .eq('sala', sala)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) handleSupabaseError(error)
  return data
}

/**
 * Slim shape returned by `fetchActiveRetros`. Only `sala` + `data`
 * because that's what dashboards/admin panels need to compute counters
 * (open actions, risks, etc.) without paying for the full retro row.
 */
export interface ActiveRetroLite {
  sala: string
  data: Record<string, unknown>
}

/**
 * Load active retros across ALL salas — only `sala` + `data` columns.
 * Used by admin panels (e.g. ProjectsPanel) to compute per-project
 * counters (open actions, mitigated risks, ...) in a single query.
 */
export async function fetchActiveRetros(): Promise<ActiveRetroLite[]> {
  const { data, error } = await supabase
    .from('retros')
    .select('sala, data')
    .eq('status', 'active')
  if (error) handleSupabaseError(error)
  return (data ?? []) as ActiveRetroLite[]
}

/**
 * Create the initial empty retro for a freshly-created sala.
 * Mirrors the shape used historically (actions, risks, notes,
 * positives) so existing readers don't need a migration.
 *
 * Called whenever a new room is created (manual or bulk import).
 */
export async function createInitialRetro(sala: string): Promise<void> {
  const { error } = await supabase
    .from('retros')
    .insert({ sala, data: { actions: [], risks: [], notes: [], positives: [] }, status: 'active' })
  if (error) handleSupabaseError(error)
}

export async function saveRetro(retro: Retro): Promise<void> {
  // Rule #9: auto-save loads DB first, prefers richer data
  const { data: current } = await supabase
    .from('retros')
    .select('data, updated_at')
    .eq('id', retro.id)
    .single()

  const serverData = current?.data as Retro['data'] | undefined
  const merged = mergeRetroData(serverData, retro.data)

  const { error } = await supabase
    .from('retros')
    .update({ data: merged, updated_at: new Date().toISOString() })
    .eq('id', retro.id)
  if (error) handleSupabaseError(error)
}

/**
 * Merge strategy: prefer the version with more content.
 * Simple heuristic — will be refined in later phases.
 */
function mergeRetroData(
  server: Retro['data'] | undefined,
  local: Retro['data'],
): Retro['data'] {
  if (!server) return local
  const serverSize = JSON.stringify(server).length
  const localSize = JSON.stringify(local).length
  return localSize >= serverSize ? local : server
}
