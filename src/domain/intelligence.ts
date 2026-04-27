/** Revelio Intelligence Engine — automatic alerts and insights */

export interface Alert {
  id: string
  type: 'overdue' | 'blocked' | 'overload' | 'single_point' | 'milestone_risk' | 'capacity_gap' | 'cost_overrun' | 'scope_creep' | 'deadline_risk'
  severity: 'critical' | 'warning' | 'info'
  title: string
  detail: string
  project?: string
  relatedIds?: string[]
}

interface Item { id: string; text: string; status: string; date?: string; owner?: string; type?: string; startDate?: string; createdAt?: string; baselineEnd?: string }
interface Risk { id: string; title: string; status: string; prob?: string; impact?: string; escalation?: { level?: string } }
interface OrgEntry { member_id: string; sala: string; dedication: number }
interface TeamMember { id: string; name: string; vacations?: Array<{ from: string; to?: string }> }

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 }

export function analyzeProject(projectSlug: string, items: Item[], risks: Risk[], today: string): Alert[] {
  const alerts: Alert[] = []
  const active = items.filter(i => i.status !== 'done' && i.status !== 'archived' && i.status !== 'discarded')

  // ── Overdue items ──
  const overdue = active.filter(i => i.date && i.date < today)
  if (overdue.length >= 3) {
    alerts.push({ id: `${projectSlug}-ov-cluster`, type: 'overdue', severity: 'critical', title: `${overdue.length} items vencidos`, detail: `Hay ${overdue.length} items sin completar con fecha pasada. Los más antiguos: ${overdue.sort((a, b) => (a.date || '').localeCompare(b.date || '')).slice(0, 3).map(i => i.text).join(', ')}`, project: projectSlug, relatedIds: overdue.map(i => i.id) })
  } else if (overdue.length > 0) {
    overdue.forEach(i => alerts.push({ id: `${projectSlug}-ov-${i.id}`, type: 'overdue', severity: 'warning', title: `"${i.text}" vencido`, detail: `Vencimiento: ${i.date}. Responsable: ${i.owner || 'sin asignar'}`, project: projectSlug, relatedIds: [i.id] }))
  }

  // ── Blocked items ──
  const blocked = active.filter(i => i.status === 'blocked')
  if (blocked.length > 0) {
    alerts.push({ id: `${projectSlug}-blocked`, type: 'blocked', severity: blocked.length >= 3 ? 'critical' : 'warning', title: `${blocked.length} item${blocked.length > 1 ? 's' : ''} bloqueado${blocked.length > 1 ? 's' : ''}`, detail: blocked.map(i => `${i.text} (${i.owner || 'sin asignar'})`).join(', '), project: projectSlug, relatedIds: blocked.map(i => i.id) })
  }

  // ── Single point of failure (one person owns >40% of active items) ──
  const ownerCounts: Record<string, number> = {}
  active.filter(i => i.owner).forEach(i => { ownerCounts[i.owner!] = (ownerCounts[i.owner!] || 0) + 1 })
  Object.entries(ownerCounts).forEach(([owner, count]) => {
    if (count > active.length * 0.4 && count >= 3) {
      alerts.push({ id: `${projectSlug}-spof-${owner}`, type: 'single_point', severity: 'warning', title: `Dependencia de ${owner.split(' ')[0]}`, detail: `${owner} tiene ${count} de ${active.length} items activos (${Math.round(count / active.length * 100)}%). Si se ausenta, el proyecto se para.`, project: projectSlug })
    }
  })

  // ── Milestones at risk (milestone in <7 days with dependencies not done) ──
  const milestones = items.filter(i => (i.type || '') === 'hito' && i.date && i.status !== 'done')
  milestones.forEach(m => {
    const daysLeft = Math.round((new Date(m.date!).getTime() - new Date(today).getTime()) / 86400000)
    if (daysLeft <= 7 && daysLeft >= 0) {
      alerts.push({ id: `${projectSlug}-ms-${m.id}`, type: 'milestone_risk', severity: daysLeft <= 2 ? 'critical' : 'warning', title: `Hito "${m.text}" en ${daysLeft}d`, detail: `Vence el ${m.date}. ${m.owner ? `Responsable: ${m.owner}` : 'Sin responsable asignado.'}`, project: projectSlug, relatedIds: [m.id] })
    }
  })

  // ── Baseline deviation (scope creep) ──
  const deviated = active.filter(i => i.baselineEnd && i.date && i.date > i.baselineEnd)
  if (deviated.length >= 3) {
    const avgDev = Math.round(deviated.reduce((s, i) => s + Math.round((new Date(i.date!).getTime() - new Date(i.baselineEnd!).getTime()) / 86400000), 0) / deviated.length)
    alerts.push({ id: `${projectSlug}-scope`, type: 'scope_creep', severity: avgDev > 7 ? 'critical' : 'warning', title: `${deviated.length} items desviados de baseline`, detail: `Desviación media: +${avgDev} días. El plan original no se está cumpliendo.`, project: projectSlug })
  }

  // ── Escalated risks ──
  const escalated = risks.filter(r => r.escalation?.level && r.escalation.level !== 'equipo' && r.status !== 'cerrado')
  escalated.forEach(r => {
    alerts.push({ id: `${projectSlug}-esc-${r.id}`, type: 'deadline_risk', severity: 'critical', title: `Riesgo escalado: ${r.title}`, detail: `Escalado a ${r.escalation!.level}. Prob: ${r.prob || '?'}, Impacto: ${r.impact || '?'}`, project: projectSlug })
  })

  // ── Critical risks not being treated ──
  const critRisks = risks.filter(r => r.prob === 'alta' && r.impact === 'alto' && r.status !== 'cerrado' && r.status !== 'mitigado')
  critRisks.forEach(r => {
    alerts.push({ id: `${projectSlug}-crit-${r.id}`, type: 'deadline_risk', severity: 'warning', title: `Riesgo crítico abierto: ${r.title}`, detail: `Probabilidad alta × Impacto alto. Estado: ${r.status}`, project: projectSlug })
  })

  return alerts.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
}

// ── Capacity Analysis ──
export interface CapacityAlert {
  memberId: string
  memberName: string
  type: 'overload' | 'underload' | 'absence_conflict' | 'no_coverage'
  severity: 'critical' | 'warning' | 'info'
  detail: string
  projects: string[]
}

export function analyzeCapacity(
  team: TeamMember[],
  org: OrgEntry[],
  items: Item[],
  today: string
): CapacityAlert[] {
  const alerts: CapacityAlert[] = []

  team.forEach(m => {
    const myOrg = org.filter(o => o.member_id === m.id)
    const totalDed = myOrg.reduce((s, o) => s + (o.dedication || 0), 0)
    const projects = myOrg.map(o => o.sala)

    // Overload: total dedication > 100%
    if (totalDed > 1.05) {
      alerts.push({ memberId: m.id, memberName: m.name, type: 'overload', severity: totalDed > 1.2 ? 'critical' : 'warning', detail: `Dedicación total: ${Math.round(totalDed * 100)}% (${projects.join(', ')}). Sobreasignado.`, projects })
    }

    // Underload: <50% and has active items
    const activeItems = items.filter(i => i.owner === m.name && i.status !== 'done' && i.status !== 'archived')
    if (totalDed < 0.5 && totalDed > 0 && activeItems.length === 0) {
      alerts.push({ memberId: m.id, memberName: m.name, type: 'underload', severity: 'info', detail: `Dedicación ${Math.round(totalDed * 100)}% sin items activos. Capacidad disponible.`, projects })
    }

    // Absence conflict: vacation overlaps with overdue items
    const myOverdue = items.filter(i => i.owner === m.name && i.date && i.date < today && i.status !== 'done' && i.status !== 'archived')
    const upcomingVac = (m.vacations || []).filter(v => {
      const from = v.from; const to = v.to || v.from
      return to >= today && Math.round((new Date(from).getTime() - new Date(today).getTime()) / 86400000) <= 14
    })
    if (myOverdue.length > 0 && upcomingVac.length > 0) {
      alerts.push({ memberId: m.id, memberName: m.name, type: 'absence_conflict', severity: 'critical', detail: `${m.name} tiene ${myOverdue.length} items vencidos y vacaciones próximas. Sin cobertura.`, projects })
    }

    // Intercontrato: 0% dedication for >5 days
    if (totalDed === 0 && projects.length === 0) {
      alerts.push({ memberId: m.id, memberName: m.name, type: 'no_coverage', severity: 'warning', detail: `${m.name} no tiene proyectos asignados (intercontrato). Requiere acción.`, projects: [] })
    }
  })

  return alerts.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
}

// ── Cross-project KPIs ──
export interface ProjectKPI {
  slug: string
  name: string
  health: number
  pctDone: number
  overdue: number
  blocked: number
  risks: number
  escalated: number
  alerts: number
}

export function computeProjectKPIs(slug: string, name: string, items: Item[], risks: Risk[], today: string): ProjectKPI {
  const active = items.filter(i => i.status !== 'discarded' && i.status !== 'cancelled')
  const done = active.filter(i => i.status === 'done' || i.status === 'archived').length
  const overdue = active.filter(i => i.date && i.date < today && i.status !== 'done' && i.status !== 'archived').length
  const blocked = active.filter(i => i.status === 'blocked').length
  const openRisks = risks.filter(r => r.status !== 'cerrado' && r.status !== 'mitigated').length
  const escalated = risks.filter(r => r.escalation?.level && r.escalation.level !== 'equipo' && r.status !== 'cerrado').length
  const pctDone = active.length > 0 ? Math.round(done / active.length * 100) : 0

  let health = 100
  health -= overdue * 3
  health -= blocked * 5
  health -= escalated * 8
  health = Math.max(0, Math.min(100, health))

  const alertCount = analyzeProject(slug, items, risks, today).length

  return { slug, name, health, pctDone, overdue, blocked, risks: openRisks, escalated, alerts: alertCount }
}
