import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import {
  LayoutDashboard, ListChecks, AlertTriangle, Users,
  TrendingUp, ChevronLeft,
  FolderOpen, BarChart3,
  CornerUpLeft, History,
} from 'lucide-react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { EconomicoTab } from '@/components/project/EconomicoTab'
import { EquipoTab } from '@/components/project/EquipoTab'
import { ResumenTab } from '@/components/project/ResumenTab'
import { RetroTab, RETRO_PHASES } from '@/components/project/RetroTab'
import { RiesgosTab } from '@/components/project/RiesgosTab'
import { SeguimientoTab } from '@/components/project/SeguimientoTab'
import { TaskDetailModal } from '@/components/project/TaskDetailModal'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/data/supabase'
import { useRetroRealtime } from '@/hooks/useRetroRealtime'
import type { Room, Member } from '@/types'
import { RetroHistory } from '@/components/retro/RetroHistory'

// ── Types ──
interface Action { id: string; text: string; status: string; owner: string; date: string; priority: string; createdAt: string; [k: string]: unknown }
interface Risk { id: string; text: string; title: string; status: string; prob: string; impact: string; type: string; owner: string; escalation?: { level?: string }; createdAt: string }
interface Note { id: string; text: string; category: string; userName: string; userId: string; votes: string[]; createdAt: string }
interface TaskItem { text: string; done: boolean }

type Tab = 'resumen' | 'seguimiento' | 'riesgos' | 'equipo' | 'economico' | 'retro'

const TABS: { id: Tab; label: string; icon: typeof LayoutDashboard; requiresSuperuser?: boolean }[] = [
  { id: 'resumen', label: 'Resumen', icon: LayoutDashboard },
  { id: 'seguimiento', label: 'Seguimiento', icon: ListChecks },
  { id: 'riesgos', label: 'Riesgos', icon: AlertTriangle },
  { id: 'equipo', label: 'Equipo', icon: Users },
  { id: 'economico', label: 'Económico', icon: TrendingUp, requiresSuperuser: true },
  { id: 'retro', label: 'Retro', icon: BarChart3 },
]

export function ProjectPage() {
  const { slug, tab: tabFromUrl } = useParams<{ slug: string; tab?: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [room, setRoom] = useState<Room | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [actions, setActions] = useState<Action[]>([])
  const [risks, setRisks] = useState<Risk[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [objective, setObjective] = useState('')
  const [loading, setLoading] = useState(true)
  // Tab is derived from URL. Invalid or restricted tabs fall back to 'resumen'.
  const visibleTabs = useMemo(() => TABS.filter(t => !t.requiresSuperuser || user?.is_superuser), [user?.is_superuser])
  const validIds = useMemo(() => visibleTabs.map(t => t.id) as string[], [visibleTabs])
  const tab: Tab = (tabFromUrl && validIds.includes(tabFromUrl) ? tabFromUrl : 'resumen') as Tab
  const setTab = (newTab: Tab) => navigate(`/project/${slug}/${newTab}`)
  // Redirect /project/:slug/<unknown> to /project/:slug/resumen
  useEffect(() => {
    if (tabFromUrl && !validIds.includes(tabFromUrl)) navigate(`/project/${slug}/resumen`, { replace: true })
  }, [tabFromUrl, slug, validIds, navigate])
  // inRetro is now derived from URL: tab === 'retro'. Kept as alias to
  // minimise diff churn elsewhere in this large file.
  const inRetro = tab === 'retro'
  const setInRetro = (v: boolean) => setTab(v ? 'retro' : 'resumen')
  const [retroPhase, setRetroPhase] = useState(0)
  const [retroId, setRetroId] = useState<string | null>(null)

  const [detailAction, setDetailAction] = useState<Action | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  // Top-level ref + cursors are declared further below alongside state initialisation.

  // Timer
  const [timer, setTimer] = useState(300) // 5 min default
  const [timerRunning, setTimerRunning] = useState(false)
  const timerStartedAt = useRef<number | null>(null)

  // Realtime
  const { online, cursors, broadcastState, broadcastPhase, broadcastTimer: bcTimer, broadcastCursor } = useRetroRealtime({
    userId: user?.id || '',
    userName: user?.name || '',
    userAvatar: user?.avatar || '👤',
    userColor: user?.color || '#007AFF',
    sala: slug || '',
    // Channel stays open on any project tab, not just /retro.
    // Why: changes to actions / risks / tasks made in Seguimiento or Riesgos
    // need to propagate to other users viewing the same project, even if no
    // one is on the Retro tab. Phase / timer events still arrive on every
    // tab; the corresponding setRetroPhase / setTimer calls are harmless
    // when the user isn't viewing retro because that state is only consumed
    // there. Pending: rename hook to useProjectRealtime when we tackle the
    // sala→proyecto rename pass.
    enabled: !!user && !!slug,
    onStateReceived: (key, data) => {
      if (key === 'notes') setNotes(data as Note[])
      else if (key === 'actions') setActions(data as Action[])
      else if (key === 'risks') setRisks(data as Risk[])
      else if (key === 'tasks') setTasks(data as TaskItem[])
      else if (key === 'obj') setObjective(((data as Record<string, string>)?.text) || '')
    },
    onPhaseReceived: (p) => setRetroPhase(p),
    onTimerReceived: (secs, running, startedAt) => {
      if (running && startedAt) {
        const elapsed = Math.floor((Date.now() - startedAt) / 1000)
        setTimer(Math.max(0, secs - elapsed))
        setTimerRunning(true)
        timerStartedAt.current = startedAt
      } else {
        setTimer(secs)
        setTimerRunning(false)
      }
    },
  })

  // Timer countdown
  useEffect(() => {
    if (!timerRunning) return
    const iv = setInterval(() => {
      setTimer(prev => { if (prev <= 1) { setTimerRunning(false); return 0 } return prev - 1 })
    }, 1000)
    return () => clearInterval(iv)
  }, [timerRunning])

  // Timer helpers
  const startTimer = (secs?: number) => {
    const s = secs || timer || 300
    setTimer(s); setTimerRunning(true)
    timerStartedAt.current = Date.now()
    bcTimer(s, true, Date.now())
  }
  const pauseTimer = () => { setTimerRunning(false); bcTimer(timer, false, null) }
  const resetTimer = (secs = 300) => { setTimer(secs); setTimerRunning(false); bcTimer(secs, false, null) }
  const fmtTimer = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  void startTimer; void pauseTimer; void resetTimer; void fmtTimer // used in retro broadcast

  // Auto-save
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stateRef = useRef({ notes, actions, risks, tasks, obj: { text: objective }, currentPhase: retroPhase })
  const containerRef = useRef<HTMLDivElement | null>(null)
  // Track local mouse position and broadcast normalised coords (0..1).
  // Throttling lives inside the hook (50ms) so we just emit raw events here.
  // Only active in retro mode; outside retro we don't broadcast cursors.
  useEffect(() => {
    if (!inRetro) return
    const onMove = (e: MouseEvent) => {
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const xPct = (e.clientX - rect.left) / rect.width
      const yPct = (e.clientY - rect.top) / rect.height
      if (xPct < 0 || xPct > 1 || yPct < 0 || yPct > 1) return
      broadcastCursor(xPct, yPct)
    }
    document.addEventListener('mousemove', onMove)
    return () => document.removeEventListener('mousemove', onMove)
  }, [inRetro, broadcastCursor])
  useEffect(() => { stateRef.current = { notes, actions, risks, tasks, obj: { text: objective }, currentPhase: retroPhase } }, [notes, actions, risks, tasks, objective, retroPhase])

  const triggerSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      if (!retroId) return
      const s = stateRef.current
      if (s.notes.length === 0 && s.actions.length === 0 && s.risks.length === 0) return
      await supabase.from('retros').update({ data: s, updated_at: new Date().toISOString() }).eq('id', retroId)
    }, 3000)
  }, [retroId])

  useEffect(() => { if (retroId) triggerSave() }, [notes, actions, risks, tasks, objective, triggerSave, retroId])

  // Load
  useEffect(() => {
    if (!slug) return
    async function load() {
      const [roomR, membersR, retrosR] = await Promise.all([
        supabase.from('rooms').select('*').eq('slug', slug).single(),
        supabase.from('team_members').select('*').order('name'),
        supabase.from('retros').select('*').eq('sala', slug).eq('status', 'active').order('created_at', { ascending: false }).limit(1),
      ])
      if (roomR.data) setRoom(roomR.data)
      if (membersR.data) setMembers(membersR.data)
      if (retrosR.data?.[0]) {
        setRetroId(retrosR.data[0].id)
        const d = retrosR.data[0].data as Record<string, unknown>
        if (d) {
          setNotes((d.notes || []) as Note[])
          setActions((d.actions || []) as Action[])
          setRisks((d.risks || []) as Risk[])
          setTasks((d.tasks || []) as TaskItem[])
          setObjective(((d.obj as Record<string, string>)?.text) || '')
          // Restore active retro phase from DB (persisted on each phase change).
          // Latecomers and refreshes get the current phase, not phase 0.
          setRetroPhase((d.currentPhase as number) || 0)
        }
      }
      setLoading(false)
    }
    load()
  }, [slug])

  const teamMembers = useMemo(() => members.filter(m => (m.rooms || []).includes(slug || '')), [members, slug])
  const acts = useMemo(() => actions.filter(a => a.status !== 'discarded' && a.status !== 'cancelled'), [actions])
  const workItems = useMemo(() => acts.filter(a => (a.type || 'tarea') !== 'epica'), [acts])

  const changeRetroPhase = (p: number) => {
    setRetroPhase(p)
    broadcastPhase(p)
    // Persist phase to DB so latecomers and refresh recover the active phase.
    // Done inline (not via the debounced triggerSave) so the phase is saved
    // immediately. Other state (notes, actions, risks) keeps using the
    // debounced autosave through stateRef.current.
    if (retroId) {
      supabase
        .from('retros')
        .update({
          data: { ...stateRef.current, currentPhase: p },
          updated_at: new Date().toISOString(),
        })
        .eq('id', retroId)
        .then(() => { /* fire-and-forget; broadcast already updated peers */ })
    }
  }

  if (loading) return <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center"><div className="animate-pulse text-sm text-revelio-subtle dark:text-revelio-dark-subtle">Cargando proyecto...</div></div>
  if (!room) return <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center flex-col gap-3"><FolderOpen className="w-10 h-10 text-revelio-border" /><p className="text-sm text-revelio-subtle dark:text-revelio-dark-subtle">Proyecto no encontrado</p><Link to="/" className="text-xs text-revelio-blue hover:underline">Volver</Link></div>

  const rp = RETRO_PHASES[retroPhase]!

  return (
    <div ref={containerRef} className="relative flex h-[calc(100vh-3rem)]">
      {/* ═══ REMOTE CURSORS (only in retro) ═══ */}
      {inRetro && cursors.length > 0 && containerRef.current && (() => {
        const rect = containerRef.current.getBoundingClientRect()
        return (
          <div className="absolute inset-0 pointer-events-none z-50">
            {cursors.map(c => {
              const x = c.xPct * rect.width
              const y = c.yPct * rect.height
              return (
                <div key={c.userId} className="absolute transition-transform duration-75" style={{ transform: `translate(${x}px, ${y}px)` }}>
                  {/* Arrow */}
                  <svg width="16" height="16" viewBox="0 0 16 16" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}>
                    <path d="M2 2 L2 13 L5 10 L8 14 L10 13 L7 9 L11 9 Z" fill={c.color} stroke="white" strokeWidth="1" />
                  </svg>
                  {/* Avatar + name pill */}
                  <div className="flex items-center gap-1 mt-0.5 ml-2 px-1.5 py-0.5 rounded-md text-[10px] font-medium text-white whitespace-nowrap" style={{ background: c.color }}>
                    <span className="text-[11px]">{c.avatar}</span>
                    <span>{c.name}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })()}
      {/* ═══ PROJECT SIDEBAR ═══ */}
      <aside className="w-[180px] flex-shrink-0 border-r border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card flex flex-col">
        {/* Nav items */}
        <nav className="flex-1 px-2 py-2 space-y-0.5">
          {!inRetro ? (
            <>
              {visibleTabs.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11px] font-medium transition-colors text-left ${tab === t.id ? 'bg-revelio-blue/10 text-revelio-blue' : 'text-revelio-subtle dark:text-revelio-dark-subtle hover:bg-revelio-bg dark:hover:bg-revelio-dark-border'}`}>
                  <t.icon className="w-3.5 h-3.5" /> {t.label}
                </button>
              ))}
            </>
          ) : (
            <>
              <button onClick={() => setInRetro(false)} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11px] font-medium text-revelio-blue hover:bg-revelio-blue/5 transition-colors text-left">
                <CornerUpLeft className="w-3.5 h-3.5" /> Salir de retro
              </button>
              <div className="h-px bg-revelio-border/50 dark:bg-revelio-dark-border/50 my-1.5" />
              {RETRO_PHASES.map((p, i) => (
                <button key={i} onClick={() => changeRetroPhase(i)}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11px] font-medium transition-colors text-left ${retroPhase === i ? 'bg-revelio-violet/10 text-revelio-violet' : i < retroPhase ? 'text-revelio-green' : 'text-revelio-subtle dark:text-revelio-dark-subtle'} hover:bg-revelio-bg dark:hover:bg-revelio-dark-border`}>
                  <p.icon className="w-3.5 h-3.5" /> <span>{p.num} {p.label}</span>
                </button>
              ))}
              {/* Online users */}
              <div className="mt-3 px-1">
                <p className="text-[8px] text-revelio-subtle uppercase mb-1">Online</p>
                <div className="flex flex-wrap gap-1">
                  {online.map(u => (
                    <div key={u.id} className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] border-2 border-white" style={{ background: u.color }} title={u.name}>{u.avatar}</div>
                  ))}
                </div>
              </div>
            </>
          )}
        </nav>
      </aside>

      {/* ═══ CONTENT ═══ */}
      <div className="flex-1 overflow-y-auto p-5">

      {/* Phase guide bar (only in retro) */}
      {inRetro && !showHistory && (
        <div className="shrink-0 bg-revelio-blue/5 border-b border-revelio-blue/10 px-5 py-1.5 flex items-center gap-2">
          <span className="text-[10px] font-bold text-revelio-blue">{rp.num}</span>
          <span className="text-xs font-semibold text-revelio-text dark:text-revelio-dark-text">{rp.label}</span>
          <span className="text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle">— {rp.desc}</span>
          <button onClick={() => setShowHistory(true)} className="ml-auto text-[10px] text-revelio-violet hover:underline flex items-center gap-0.5">
            <History className="w-3 h-3" /> Historial
          </button>
        </div>
      )}
      {inRetro && showHistory && (
        <div className="shrink-0 bg-revelio-violet/5 border-b border-revelio-violet/10 px-5 py-1.5 flex items-center gap-2">
          <button onClick={() => setShowHistory(false)} className="text-[10px] text-revelio-blue hover:underline flex items-center gap-0.5">
            <ChevronLeft className="w-3 h-3" /> Volver a la retro
          </button>
          <span className="text-xs font-semibold text-revelio-violet">Historial</span>
        </div>
      )}

      {/* ═══ CONTENT ═══ */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="w-full max-w-[1600px] mx-auto px-4">

        {/* ═══ PROJECT TABS ═══ */}
        {!inRetro && <>

          {/* RESUMEN */}
          {tab === 'resumen' && (
            <ResumenTab
              actions={actions}
              risks={risks}
              team={teamMembers}
              onTabChange={t => setTab(t as Tab)}
            />
          )}

          {/* SEGUIMIENTO */}
          {tab === 'seguimiento' && (
            <SeguimientoTab
              actions={actions}
              risks={risks}
              team={teamMembers}
              onActionsChange={next => { setActions(next); broadcastState('actions', next) }}
              onOpenDetail={a => setDetailAction(a)}
            />
          )}

          {/* RIESGOS */}
          {tab === 'riesgos' && (
            <RiesgosTab
              risks={risks}
              workItems={workItems}
              currentUser={user?.name || ''}
              onUpdate={next => { setRisks(next); broadcastState('risks', next) }}
            />
          )}

          {/* EQUIPO */}
          {tab === 'equipo' && (
            <EquipoTab slug={slug || ''} team={teamMembers} actions={acts} />
          )}

          {/* FINANZAS */}
          {tab === 'economico' && (
            <EconomicoTab slug={slug || ''} team={teamMembers} room={room} />
          )}
        </>}

        {/* ═══ RETRO HISTORY ═══ */}
        {inRetro && showHistory && <RetroHistory sala={slug || ''} />}

        {/* ═══ RETRO PHASES ═══ */}
        {inRetro && !showHistory && (
          <RetroTab
            phase={retroPhase}
            notes={notes}
            tasks={tasks}
            objective={objective}
            actions={actions}
            risks={risks}
            team={teamMembers}
            currentUser={user ? { id: user.id, name: user.name } : null}
            onNotesChange={next => { setNotes(next); broadcastState('notes', next) }}
            onTasksChange={next => { setTasks(next); broadcastState('tasks', next) }}
            onObjectiveChange={next => { setObjective(next); broadcastState('obj', { text: next }) }}
            onActionsChange={next => { setActions(next); broadcastState('actions', next) }}
            onRisksChange={next => { setRisks(next); broadcastState('risks', next) }}
            onPhaseChange={p => changeRetroPhase(p)}
          />
        )}

        </div>
      </div>

      {/* Task detail modal */}
      {detailAction && (
        <TaskDetailModal
          task={detailAction}
          teamMembers={teamMembers}
          epics={acts.filter(a => (a.type || '') === 'epica').map(a => ({ id: a.id, text: a.text }))}
          allItems={workItems.map(a => ({ id: a.id, text: a.text }))}
          currentUser={user?.name || ''}
          onSave={updated => {
            const exists = actions.some(a => a.id === updated.id)
            const next = exists ? actions.map(a => a.id === updated.id ? updated : a) : [...actions, updated]
            setActions(next)
            broadcastState('actions', next)
            setDetailAction(null)
          }}
          onClose={() => setDetailAction(null)}
          onDelete={id => {
            // Also unlink children if deleting an epic
            const next = actions.filter(a => a.id !== id).map(a => String(a.epicLink || '') === id ? { ...a, epicLink: undefined } : a)
            setActions(next)
            broadcastState('actions', next)
            setDetailAction(null)
          }}
        />
      )}
      </div>
    </div>
  )
}
