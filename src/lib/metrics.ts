import { supabase } from '@/data/supabase'

export interface MetricSnapshot {
  date: string
  health: number
  pct_done: number
  overdue: number
  risks: number
  team_size: number
}

/** Load metric history for a project */
export async function loadMetricHistory(sala: string, days = 30): Promise<MetricSnapshot[]> {
  const since = new Date()
  since.setDate(since.getDate() - days)
  const { data } = await supabase
    .from('metrics_history')
    .select('date, health, pct_done, overdue, risks, team_size')
    .eq('sala', sala)
    .gte('date', since.toISOString().slice(0, 10))
    .order('date')
  return (data || []) as MetricSnapshot[]
}

/** Snapshot current metrics for all projects (call daily via cron or on dashboard load) */
export async function snapshotMetrics() {
  const today = new Date().toISOString().slice(0, 10)

  const [roomsR, retrosR, membersR] = await Promise.all([
    supabase.from('rooms').select('slug, name'),
    supabase.from('retros').select('sala, data').eq('status', 'active'),
    supabase.from('team_members').select('id, rooms'),
  ])

  const rooms = (roomsR.data || []) as Array<{ slug: string }>
  const retros = (retrosR.data || []) as Array<{ sala: string; data: Record<string, unknown> }>
  const members = (membersR.data || []) as Array<{ id: string; rooms: string[] }>

  for (const room of rooms) {
    const retro = retros.find(r => r.sala === room.slug)
    const data = retro?.data || {}
    const actions = ((data.actions || []) as Array<Record<string, unknown>>).filter(a => a.status !== 'discarded')
    const done = actions.filter(a => a.status === 'done' || a.status === 'archived').length
    const overdue = actions.filter(a => a.date && (a.date as string) < today && a.status !== 'done' && a.status !== 'archived').length
    const risks = ((data.risks || []) as Array<Record<string, unknown>>).filter(r => r.status !== 'cerrado' && r.status !== 'mitigated').length
    const pctDone = actions.length > 0 ? Math.round(done / actions.length * 100) : 0
    const health = Math.max(0, Math.min(100, 100 - overdue * 3 - risks * 2))
    const teamSize = members.filter(m => (m.rooms || []).includes(room.slug)).length

    await supabase.from('metrics_history').upsert(
      { sala: room.slug, date: today, health, pct_done: pctDone, overdue, risks, team_size: teamSize },
      { onConflict: 'sala,date' }
    )
  }
}
