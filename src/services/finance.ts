import type { Member, OrgChartEntry } from '@/types'
import { fetchTeamMembers } from '@/data/team'
import { fetchOrgChartBySala } from '@/data/orgChart'

/**
 * SCOPE de este service (sesion 9):
 *
 * Su unica responsabilidad es agregar el organigrama multi-periodo de una sala
 * y devolver, por miembro, su dedicacion efectiva y los periodos activos.
 *
 * NO calcula coste/hora ni P&L: esas funciones ya existen en domain/finance
 * y el caller las invoca con los datos que ya tiene cargados (costRates,
 * calendarios, services). El objetivo de esta sesion es que dejen de estar
 * dispersos los selects a `org_chart` y la logica de "que periodos cuentan
 * a fecha X".
 *
 * En sesiones siguientes ampliaremos el service para devolver el snapshot
 * financiero completo, una vez extraido P&L a domain con tests propios.
 */

export interface MemberDedicationSlice {
  member: Member
  /** Suma de dedications de los periodos activos a `asOf` (0..N). */
  effectiveDedication: number
  /** Entradas de org_chart activas a `asOf`. Vacio = ninguna. */
  activePeriods: OrgChartEntry[]
}

export interface LoadProjectTeamOptions {
  sala: string
  /** ISO `yyyy-mm-dd`. Default: hoy. */
  asOf?: string
}

/**
 * Caso de uso: "dame el equipo activo de esta sala a fecha X, con su
 * dedicacion efectiva agregada (multi-periodo)".
 *
 * El caller (FinancePanel, CrossProyecto, FTEs, etc.) recibe miembros listos
 * para alimentar a domain/finance#memberCostHour y a
 * domain/calendar#monthlyTheoreticalHours sin tener que tocar Supabase.
 */
export async function loadProjectTeam(opts: LoadProjectTeamOptions): Promise<MemberDedicationSlice[]> {
  const asOf = opts.asOf ?? today()
  const [members, orgEntries] = await Promise.all([fetchTeamMembers(), fetchOrgChartBySala(opts.sala)])
  const memberById = new Map(members.map((m) => [m.id, m]))
  const aggregated = aggregateOrgChartByMember(orgEntries, asOf)

  const out: MemberDedicationSlice[] = []
  for (const [memberId, info] of aggregated) {
    const member = memberById.get(memberId)
    if (!member) continue
    out.push({ member, effectiveDedication: info.effectiveDedication, activePeriods: info.activePeriods })
  }
  return out
}

// ----------------------------------------------------------------------------
// Helpers puros (testables sin Supabase)
// ----------------------------------------------------------------------------

interface AggregatedMemberInfo {
  effectiveDedication: number
  activePeriods: OrgChartEntry[]
}

/**
 * Agrega multiples filas de org_chart de un mismo miembro, sumando
 * dedications de los periodos ACTIVOS a fecha `asOf`. Periodos sin start_date
 * o end_date se consideran abiertos por ese lado.
 */
export function aggregateOrgChartByMember(
  entries: OrgChartEntry[],
  asOf: string,
): Map<string, AggregatedMemberInfo> {
  const out = new Map<string, AggregatedMemberInfo>()
  for (const e of entries) {
    if (!isPeriodActive(e, asOf)) continue
    const dedication = clampDedication(e.dedication ?? 1)
    const prev = out.get(e.member_id)
    if (prev) {
      prev.effectiveDedication += dedication
      prev.activePeriods.push(e)
    } else {
      out.set(e.member_id, { effectiveDedication: dedication, activePeriods: [e] })
    }
  }
  return out
}

export function isPeriodActive(entry: OrgChartEntry, asOf: string): boolean {
  const start = entry.start_date && entry.start_date.length > 0 ? entry.start_date : null
  const end = entry.end_date && entry.end_date.length > 0 ? entry.end_date : null
  if (start && asOf < start) return false
  if (end && asOf > end) return false
  return true
}

function clampDedication(d: number): number {
  if (!Number.isFinite(d) || d < 0) return 0
  return d
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}
