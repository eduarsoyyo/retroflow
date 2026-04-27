import { useState, useEffect, useMemo } from 'react'
import { Bell, Clock, AlertTriangle, Target, ArrowUpRight, X } from 'lucide-react'
import { supabase } from '@/data/supabase'

interface Alert { id: string; type: 'overdue' | 'blocked' | 'escalated' | 'milestone' | 'approved' | 'rejected'; title: string; project: string; date?: string }

export function NotificationBell({ userId }: { userId?: string }) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    const today = new Date().toISOString().slice(0, 10)

    supabase.from('team_members').select('rooms').eq('id', userId).single().then(({ data: me }) => {
      if (!me?.rooms) { setLoading(false); return }
      supabase.from('retros').select('sala, data').in('sala', me.rooms).eq('status', 'active').then(({ data: retros }) => {
        const all: Alert[] = []
        ;(retros || []).forEach((r: { sala: string; data: Record<string, unknown> }) => {
          const acts = ((r.data?.actions || []) as Array<Record<string, unknown>>)
          const risks = ((r.data?.risks || []) as Array<Record<string, unknown>>)

          // Overdue items
          acts.filter(a => a.date && (a.date as string) < today && a.status !== 'done' && a.status !== 'archived' && a.status !== 'discarded').forEach(a => {
            all.push({ id: `ov-${a.id}`, type: 'overdue', title: a.text as string, project: r.sala, date: a.date as string })
          })
          // Blocked
          acts.filter(a => a.status === 'blocked').forEach(a => {
            all.push({ id: `bl-${a.id}`, type: 'blocked', title: a.text as string, project: r.sala })
          })
          // Upcoming milestones (7 days)
          acts.filter(a => (a.type as string) === 'hito' && a.date && (a.date as string) >= today && daysBetween(today, a.date as string) <= 7 && a.status !== 'done').forEach(a => {
            all.push({ id: `ms-${a.id}`, type: 'milestone', title: a.text as string, project: r.sala, date: a.date as string })
          })
          // Escalated risks
          risks.filter(r2 => (r2.escalation as Record<string, unknown>)?.level && (r2.escalation as Record<string, unknown>)?.level !== 'equipo' && r2.status !== 'cerrado').forEach(r2 => {
            all.push({ id: `esc-${r2.id}`, type: 'escalated', title: (r2.title || r2.text) as string, project: r.sala })
          })
        })
        setAlerts(all); setLoading(false)
      })
    })

    // Load pending approvals for SM
    supabase.from('team_members').select('id, is_superuser').eq('id', userId).single().then(({ data: me }) => {
      if ((me as Record<string, unknown>)?.is_superuser) {
        supabase.from('absence_requests').select('id, member_id, type, date_from, date_to, days').eq('status', 'pendiente').then(({ data: pending }) => {
          if (pending && pending.length > 0) {
            setAlerts(prev => [...prev, ...pending.map((p: Record<string, unknown>) => ({
              id: `appr-${p.id}`, type: 'escalated' as const, title: `Ausencia pendiente de aprobar (${p.days}d)`, project: 'Aprobaciones', date: p.date_from as string
            }))])
          }
        })
        supabase.from('time_entries').select('id, member_id, date, hours').eq('status', 'pending_approval').then(({ data: pending }) => {
          if (pending && pending.length > 0) {
            setAlerts(prev => [...prev, ...pending.map((p: Record<string, unknown>) => ({
              id: `retro-${p.id}`, type: 'escalated' as const, title: `Fichaje retroactivo pendiente (${p.hours}h)`, project: 'Aprobaciones', date: p.date as string
            }))])
          }
        })
      }
    })

    // Load resolved notifications for me (my requests that were approved/rejected recently)
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)
    supabase.from('absence_requests').select('id, type, date_from, date_to, days, status, reviewed_at').eq('member_id', userId).in('status', ['aprobada', 'rechazada']).gte('reviewed_at', weekAgo.toISOString()).then(({ data }) => {
      if (data && data.length > 0) {
        setAlerts(prev => [...prev, ...data.map((a: Record<string, unknown>) => ({
          id: `res-${a.id}`, type: (a.status === 'aprobada' ? 'approved' : 'rejected') as 'approved' | 'rejected',
          title: `Tu ${a.type === 'vacaciones' ? 'vacaciones' : 'ausencia'} (${a.days}d) ha sido ${a.status}`,
          project: 'Ausencias', date: a.reviewed_at as string
        }))])
      }
    })
    supabase.from('time_entries').select('id, date, hours, status').eq('member_id', userId).in('status', ['approved', 'rejected']).then(({ data }) => {
      // Only show recently resolved retro filings (that were pending)
      if (data) {
        const retro = data.filter((e: Record<string, unknown>) => e.status === 'rejected')
        if (retro.length > 0) {
          setAlerts(prev => [...prev, ...retro.map((e: Record<string, unknown>) => ({
            id: `retro-res-${e.id}`, type: 'rejected' as const, title: `Fichaje retroactivo (${e.hours}h) rechazado`, project: 'Fichaje', date: e.date as string
          }))])
        }
      }
    })
  }, [userId])

  const visible = useMemo(() => alerts.filter(a => !dismissed.has(a.id)), [alerts, dismissed])
  const count = visible.length

  const ICONS: Record<string, typeof Clock> = { overdue: Clock, blocked: AlertTriangle, escalated: ArrowUpRight, milestone: Target, approved: Target, rejected: AlertTriangle }
  const COLORS: Record<string, string> = { overdue: '#FF3B30', blocked: '#FF3B30', escalated: '#FF9500', milestone: '#007AFF', approved: '#34C759', rejected: '#FF3B30' }
  const LABELS: Record<string, string> = { overdue: 'Vencido', blocked: 'Bloqueado', escalated: 'Pendiente', milestone: 'Hito próximo', approved: 'Aprobada', rejected: 'Rechazada' }

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="relative w-8 h-8 rounded-lg flex items-center justify-center hover:bg-revelio-bg dark:hover:bg-revelio-dark-border transition-colors">
        <Bell className={`w-4 h-4 ${count > 0 ? 'text-revelio-orange' : 'text-revelio-subtle dark:text-revelio-dark-subtle'}`} />
        {count > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-revelio-red text-white text-[8px] font-bold rounded-full flex items-center justify-center">{count > 9 ? '9+' : count}</span>}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-80 bg-white dark:bg-revelio-dark-card border border-revelio-border dark:border-revelio-dark-border rounded-xl shadow-xl z-50 overflow-hidden">
            <div className="px-3 py-2 border-b border-revelio-border/50 dark:border-revelio-dark-border/50 flex items-center justify-between">
              <span className="text-[10px] font-semibold dark:text-revelio-dark-text">Alertas ({count})</span>
              {count > 0 && <button onClick={() => setDismissed(new Set(alerts.map(a => a.id)))} className="text-[8px] text-revelio-blue hover:underline">Limpiar</button>}
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {loading && <div className="px-3 py-4 text-[10px] text-revelio-subtle text-center">Cargando...</div>}
              {!loading && visible.length === 0 && <div className="px-3 py-6 text-center"><Bell className="w-5 h-5 text-revelio-border dark:text-revelio-dark-border mx-auto mb-1" /><p className="text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle">Sin alertas</p></div>}
              {visible.map(a => {
                const Icon = ICONS[a.type] || Bell
                return (
                  <div key={a.id} className="px-3 py-2 border-b border-revelio-border/30 dark:border-revelio-dark-border/30 last:border-0 flex items-start gap-2 hover:bg-revelio-bg/30 dark:hover:bg-revelio-dark-border/20">
                    <Icon className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: COLORS[a.type] }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] dark:text-revelio-dark-text truncate">{a.title}</p>
                      <p className="text-[8px] text-revelio-subtle dark:text-revelio-dark-subtle">{LABELS[a.type]} · {a.project} {a.date ? `· ${new Date(a.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}` : ''}</p>
                    </div>
                    <button onClick={() => setDismissed(prev => new Set([...prev, a.id]))} className="text-revelio-subtle hover:text-revelio-red"><X className="w-2.5 h-2.5" /></button>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function daysBetween(a: string, b: string) { return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000) }
