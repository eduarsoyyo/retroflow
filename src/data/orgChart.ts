import { supabase } from './supabase'
import { handleSupabaseError } from '@/lib/errors'
import type { OrgChartEntry } from '@/types'

/**
 * Carga TODAS las entradas de organigrama para una sala.
 * Una misma persona puede aparecer varias veces (multi-periodo).
 */
export async function fetchOrgChartBySala(sala: string): Promise<OrgChartEntry[]> {
  const { data, error } = await supabase
    .from('org_chart')
    .select('id, sala, member_id, manager_id, role, level, dedication, start_date, end_date')
    .eq('sala', sala)

  if (error) {
    handleSupabaseError(error)
    return []
  }
  return (data ?? []) as OrgChartEntry[]
}

/**
 * Carga entradas de organigrama para multiples salas en una query.
 * Devuelve un mapa sala -> entries.
 */
export async function fetchOrgChartBySalas(salas: string[]): Promise<Record<string, OrgChartEntry[]>> {
  if (salas.length === 0) return {}

  const { data, error } = await supabase
    .from('org_chart')
    .select('id, sala, member_id, manager_id, role, level, dedication, start_date, end_date')
    .in('sala', salas)

  if (error) {
    handleSupabaseError(error)
    return {}
  }

  const grouped: Record<string, OrgChartEntry[]> = {}
  for (const row of (data ?? []) as OrgChartEntry[]) {
    const list = grouped[row.sala] ?? (grouped[row.sala] = [])
    list.push(row)
  }
  return grouped
}
