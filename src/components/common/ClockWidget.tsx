import { useState, useEffect, useRef, useCallback } from 'react'
import { Play, Pause, Square, Timer, ArrowUpDown } from 'lucide-react'
import { supabase } from '@/data/supabase'
import { soundComplete } from '@/lib/sounds'

interface ClockWidgetProps { userId?: string }

function fmtTime(seconds: number): string {
  const abs = Math.abs(Math.round(seconds))
  const h = Math.floor(abs / 3600); const m = Math.floor((abs % 3600) / 60); const s = abs % 60
  return `${seconds < 0 ? '-' : ''}${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export function ClockWidget({ userId }: ClockWidgetProps) {
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [mode, setMode] = useState<'up' | 'down'>('down')
  const [targetSecs, setTargetSecs] = useState(0)
  const [filedSecs, setFiledSecs] = useState(0)
  const [showConfirm, setShowConfirm] = useState(false)
  const startRef = useRef<number | null>(null)
  const baseRef = useRef(0)
  const ivRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })()

  // Load target + already filed
  useEffect(() => {
    if (!userId) return
    supabase.from('team_members').select('calendario_id').eq('id', userId).single().then(({ data }) => {
      const calId = (data as Record<string, unknown>)?.calendario_id as string
      if (!calId) { setTargetSecs(8.5 * 3600); return }
      supabase.from('calendarios').select('daily_hours_lj, daily_hours_v, daily_hours_intensive, intensive_start, intensive_end').eq('id', calId).single().then(({ data: cal }) => {
        if (!cal) { setTargetSecs(8.5 * 3600); return }
        const c = cal as Record<string, unknown>; const dow = new Date().getDay(); const mmdd = new Date().toISOString().slice(5, 10)
        let h = Number(c.daily_hours_lj) || 8.5
        if (dow === 5) h = Number(c.daily_hours_v) || 6
        if (dow === 0 || dow === 6) h = 0
        if (c.intensive_start && c.intensive_end && mmdd >= (c.intensive_start as string) && mmdd <= (c.intensive_end as string)) h = Number(c.daily_hours_intensive) || 7
        setTargetSecs(Math.round(h * 3600))
      })
    })
    supabase.from('time_entries').select('hours').eq('member_id', userId).eq('date', today).then(({ data }) => {
      setFiledSecs(Math.round((data || []).reduce((s: number, e: { hours: number }) => s + e.hours, 0) * 3600))
    })
    // Restore
    const saved = localStorage.getItem('revelio-clock')
    if (saved) { try {
      const s = JSON.parse(saved)
      if (s.date === today) { baseRef.current = s.base || 0; setElapsed(s.base || 0); setMode(s.mode || 'down')
        if (s.running && s.startAt) { const now = Math.floor(Date.now() / 1000); baseRef.current = (s.base || 0) + (now - s.startAt); setElapsed(baseRef.current); startRef.current = now; setRunning(true) }
      }
    } catch { /* */ } }
  }, [userId, today])

  const persist = useCallback((isRunning: boolean, base: number, m: string) => {
    localStorage.setItem('revelio-clock', JSON.stringify({ date: today, running: isRunning, startAt: isRunning ? Math.floor(Date.now() / 1000) : null, base, mode: m }))
  }, [today])

  useEffect(() => {
    if (running) { startRef.current = Math.floor(Date.now() / 1000); ivRef.current = setInterval(() => { setElapsed(baseRef.current + (Math.floor(Date.now() / 1000) - (startRef.current || Math.floor(Date.now() / 1000)))) }, 1000) }
    else { if (ivRef.current) clearInterval(ivRef.current) }
    return () => { if (ivRef.current) clearInterval(ivRef.current) }
  }, [running])

  // Listen for external start (from prompt)
  useEffect(() => {
    const handler = () => { baseRef.current = 0; setElapsed(0); setMode('down'); startRef.current = Math.floor(Date.now() / 1000); setRunning(true); logEvent('start') }
    window.addEventListener('revelio-clock-start', handler)
    return () => window.removeEventListener('revelio-clock-start', handler)
  }, [userId])

  const logEvent = async (event: string) => { if (userId) { const { error } = await supabase.from('clock_events').insert({ member_id: userId, date: today, event }); if (error) console.error('[revelio] clock event error:', error.message) } }

  const handlePlay = () => { if (elapsed === 0) logEvent('start'); else logEvent('resume'); setRunning(true); persist(true, baseRef.current, mode) }
  const handlePause = () => { const now = Math.floor(Date.now() / 1000); baseRef.current += now - (startRef.current || now); setElapsed(baseRef.current); setRunning(false); logEvent('pause'); persist(false, baseRef.current, mode) }
  const handleStopRequest = () => setShowConfirm(true)

  const handleStopConfirm = async () => {
    let secs = elapsed; if (running) { secs = baseRef.current + (Math.floor(Date.now() / 1000) - (startRef.current || Math.floor(Date.now() / 1000))) }
    setRunning(false); const hours = Math.round((secs / 3600) * 100) / 100
    await logEvent('stop')
    if (hours > 0 && userId) {
      const { data: org } = await supabase.from('org_chart').select('sala, dedication, start_date, end_date').eq('member_id', userId)
      const allEntries = (org || []) as Array<{ sala: string; dedication: number; start_date?: string; end_date?: string }>
      const active = allEntries.filter(e => { const s = e.start_date || '2000-01-01'; const en = e.end_date || '2099-12-31'; return today >= s && today <= en && e.dedication > 0 })
      let distributed = 0
      for (const e of active) {
        const h = Math.round(e.dedication * hours * 100) / 100
        distributed += h
        await supabase.from('time_entries').upsert({ member_id: userId, sala: e.sala, date: today, hours: h, category: 'productivo', description: '', auto_distributed: true }, { onConflict: 'member_id,sala,date' })
      }
      const remainder = Math.round((hours - distributed) * 100) / 100
      if (remainder > 0.01) {
        await supabase.from('time_entries').insert({ member_id: userId, sala: '_sin_asignar', date: today, hours: remainder, category: 'no_asignado', auto_distributed: true })
      }
      if (active.length === 0) {
        await supabase.from('time_entries').insert({ member_id: userId, sala: '_sin_asignar', date: today, hours, category: 'no_asignado', auto_distributed: true })
      }
      soundComplete()
    }
    baseRef.current = 0; setElapsed(0); startRef.current = null; localStorage.removeItem('revelio-clock'); setShowConfirm(false); setFiledSecs(prev => prev + Math.round(hours * 3600))
  }

  const toggleMode = () => { const m = mode === 'up' ? 'down' : 'up'; setMode(m); persist(running, baseRef.current, m) }
  const remaining = targetSecs - filedSecs - elapsed; const displaySecs = mode === 'down' ? remaining : elapsed
  const isNeg = mode === 'down' && remaining < 0; const color = running ? (isNeg ? '#FF3B30' : '#34C759') : elapsed > 0 ? '#FF9500' : '#8E8E93'

  return (
    <>
      <div className="flex items-center gap-1 rounded-lg border border-revelio-border dark:border-revelio-dark-border px-2 py-1 bg-white dark:bg-revelio-dark-card">
        <button onClick={toggleMode} title={mode === 'down' ? 'Quedan' : 'Llevas'} className="flex items-center gap-1 hover:opacity-70">
          <Timer className="w-3 h-3" style={{ color }} />
          <span className="text-[11px] font-mono font-bold tabular-nums" style={{ color, minWidth: 62 }}>{fmtTime(displaySecs)}</span>
          <ArrowUpDown className="w-2 h-2 text-revelio-subtle dark:text-revelio-dark-subtle" />
        </button>
        <div className="flex gap-0.5 ml-0.5">
          {!running ? <button onClick={handlePlay} className="w-5 h-5 rounded flex items-center justify-center hover:bg-revelio-green/10"><Play className="w-3 h-3 text-revelio-green" fill="#34C759" /></button>
          : <button onClick={handlePause} className="w-5 h-5 rounded flex items-center justify-center hover:bg-revelio-orange/10"><Pause className="w-3 h-3 text-revelio-orange" fill="#FF9500" /></button>}
          <button onClick={handleStopRequest} disabled={elapsed === 0 && !running} className="w-5 h-5 rounded flex items-center justify-center hover:bg-revelio-red/10 disabled:opacity-20"><Square className="w-3 h-3 text-revelio-red" fill="#FF3B30" /></button>
        </div>
      </div>
      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 z-[200] flex items-center justify-center p-4" onClick={() => setShowConfirm(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-white dark:bg-revelio-dark-card rounded-2xl max-w-sm w-full p-5 shadow-xl">
            <h3 className="text-sm font-semibold dark:text-revelio-dark-text mb-2">Finalizar fichada del día</h3>
            <p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle mb-1">Las horas se repartirán entre tus proyectos según dedicación.</p>
            <div className="bg-revelio-bg dark:bg-revelio-dark-border rounded-lg px-3 py-2 mb-4">
              <p className="text-lg font-bold text-revelio-green">{fmtTime(elapsed)} <span className="text-xs font-normal text-revelio-subtle">({(elapsed / 3600).toFixed(2)}h)</span></p>
            </div>
            <div className="flex gap-2"><button onClick={() => setShowConfirm(false)} className="flex-1 py-2 rounded-lg border border-revelio-border dark:border-revelio-dark-border text-sm font-medium text-revelio-subtle">Cancelar</button><button onClick={handleStopConfirm} className="flex-1 py-2 rounded-lg bg-revelio-red text-white text-sm font-semibold">Finalizar</button></div>
          </div>
        </div>
      )}
    </>
  )
}

/** Check if clock is running (for logout warning) */
export function isClockRunning(): boolean {
  const saved = localStorage.getItem('revelio-clock')
  if (!saved) return false
  try { const s = JSON.parse(saved); return s.date === new Date().toISOString().slice(0, 10) && s.running } catch { return false }
}
