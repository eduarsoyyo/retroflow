import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import {
  LayoutDashboard, ListChecks, AlertTriangle, Users,
  CheckSquare, Clock, TrendingUp, ChevronLeft,
  FolderOpen, Shield, BarChart3, ClipboardCheck, MessageSquare, MessageCircle,
  ThumbsUp, Plus, Send, Trash2, CornerUpLeft, PartyPopper, History,
} from 'lucide-react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { EconomicoTab } from '@/components/project/EconomicoTab'
import { EquipoTab } from '@/components/project/EquipoTab'
import { ResumenTab } from '@/components/project/ResumenTab'
import { RiesgosTab } from '@/components/project/RiesgosTab'
import { SeguimientoTab } from '@/components/project/SeguimientoTab'
import { TaskDetailModal } from '@/components/project/TaskDetailModal'
import { Celebration } from '@/components/retro/Celebration'
import { RiskHeatmap } from '@/components/retro/RiskHeatmap'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/data/supabase'
import { useRetroRealtime } from '@/hooks/useRetroRealtime'
import type { Room, Member } from '@/types'
import { RetroHistory } from '@/components/retro/RetroHistory'
import { soundCreate, soundComplete, soundSuccess, soundDelete } from '@/lib/sounds'

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

const RETRO_PHASES = [
  { id: 'review', label: 'Revisión', num: '01', icon: ClipboardCheck, desc: 'Revisa objetivo y tareas.' },
  { id: 'individual', label: 'Individual', num: '02', icon: MessageSquare, desc: 'Escribe notas individuales.' },
  { id: 'discuss', label: 'Discusión', num: '03', icon: MessageCircle, desc: 'Vota y debate las notas.' },
  { id: 'risks', label: 'Riesgos', num: '04', icon: AlertTriangle, desc: 'Identifica riesgos y problemas.' },
  { id: 'actions', label: 'Items', num: '05', icon: ListChecks, desc: 'Crea tareas concretas.' },
  { id: 'summary', label: 'Resumen', num: '06', icon: BarChart3, desc: 'Revisa y finaliza.' },
]

const NOTE_CATS = [
  { id: 'bien', label: 'Bien', color: '#34C759' },
  { id: 'mejorar', label: 'Mejorar', color: '#FF9500' },
  { id: 'idea', label: 'Idea', color: '#007AFF' },
  { id: 'problema', label: 'Problema', color: '#FF3B30' },
]

const RISK_TYPES = [
  { id: 'riesgo', label: 'Riesgo', color: '#FF9500' },
  { id: 'problema', label: 'Problema', color: '#FF3B30' },
  { id: 'oportunidad', label: 'Oportunidad', color: '#34C759' },
]

const CAT_COLORS: Record<string, string> = { bien: '#34C759', mejorar: '#FF9500', idea: '#007AFF', problema: '#FF3B30' }
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

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

  // Retro form states
  const [noteText, setNoteText] = useState('')
  const [noteCat, setNoteCat] = useState('bien')
  const [actionText, setActionText] = useState('')
  const [actionOwner, setActionOwner] = useState('')
  const [actionDate, setActionDate] = useState('')
  const [riskText, setRiskText] = useState('')
  const [riskType, setRiskType] = useState('riesgo')
  const [riskProb, setRiskProb] = useState('media')
  const [riskImpact, setRiskImpact] = useState('medio')
  const [showCelebration, setShowCelebration] = useState(false)
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
    enabled: inRetro && !!user,
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
  const today = new Date().toISOString().slice(0, 10)
  const acts = useMemo(() => actions.filter(a => a.status !== 'discarded' && a.status !== 'cancelled'), [actions])
  const workItems = useMemo(() => acts.filter(a => (a.type || 'tarea') !== 'epica'), [acts])
  const actDone = workItems.filter(a => a.status === 'done' || a.status === 'archived').length
  const rOpen = risks.filter(r => r.status !== 'mitigated')

  const notesByCategory = useMemo(() => {
    const g: Record<string, Note[]> = {}
    notes.forEach(n => { const c = n.category || 'bien'; if (!g[c]) g[c] = []; g[c].push(n) })
    return g
  }, [notes])

  // Retro handlers (with broadcast)
  const addNote = () => { if (!noteText.trim() || !user) return; const next = [...notes, { id: uid(), text: noteText.trim(), category: noteCat, userName: user.name, userId: user.id, votes: [], createdAt: new Date().toISOString() }]; setNotes(next); broadcastState('notes', next); setNoteText('') }
  const toggleVote = (nid: string) => { if (!user) return; const next = notes.map(n => n.id === nid ? { ...n, votes: n.votes.includes(user.id) ? n.votes.filter(v => v !== user.id) : [...n.votes, user.id] } : n); setNotes(next); broadcastState('notes', next) }
  const deleteNote = (nid: string) => { const next = notes.filter(n => n.id !== nid); setNotes(next); broadcastState('notes', next) }
  const addAction = () => { if (!actionText.trim()) return; const next = [...actions, { id: uid(), text: actionText.trim(), status: 'todo', owner: actionOwner, date: actionDate, priority: 'medium', createdAt: new Date().toISOString() }]; setActions(next); broadcastState('actions', next); setActionText(''); setActionOwner(''); setActionDate(''); soundCreate() }
  const toggleActionStatus = (id: string) => { const next = actions.map(a => a.id === id ? { ...a, status: a.status === 'done' ? 'todo' : 'done' } : a); setActions(next); broadcastState('actions', next); soundSuccess() }
  const deleteAction = (id: string) => { const next = actions.filter(a => a.id !== id); setActions(next); broadcastState('actions', next); soundDelete() }
  const addRisk = () => { if (!riskText.trim()) return; const next = [...risks, { id: uid(), text: riskText.trim(), title: riskText.trim(), status: 'open', prob: riskProb, impact: riskImpact, type: riskType, owner: '', createdAt: new Date().toISOString() }]; setRisks(next); broadcastState('risks', next); setRiskText('') }
  const toggleRiskMitigated = (id: string) => { const next = risks.map(r => r.id === id ? { ...r, status: r.status === 'mitigated' ? 'open' : 'mitigated' } : r); setRisks(next); broadcastState('risks', next) }
  const deleteRisk = (id: string) => { const next = risks.filter(r => r.id !== id); setRisks(next); broadcastState('risks', next) }
  const toggleTask = (i: number) => { const next = tasks.map((t, idx) => idx === i ? { ...t, done: !t.done } : t); setTasks(next); broadcastState('tasks', next) }
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
        {inRetro && !showHistory && <>

          {/* P1: Review */}
          {retroPhase === 0 && (
            <div>
              <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-4 mb-3">
                <h3 className="text-xs font-semibold text-revelio-text dark:text-revelio-dark-text mb-1.5 flex items-center gap-1"><ClipboardCheck className="w-3.5 h-3.5 text-revelio-blue" /> Objetivo</h3>
                <input value={objective} onChange={e => setObjective(e.target.value)} placeholder="Objetivo del periodo..." className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-sm outline-none focus:border-revelio-blue dark:bg-revelio-dark-bg dark:text-revelio-dark-text" />
              </div>
              {tasks.length > 0 && (
                <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-4">
                  <h3 className="text-xs font-semibold text-revelio-text dark:text-revelio-dark-text mb-2">Tareas ({tasks.filter(t => t.done).length}/{tasks.length})</h3>
                  {tasks.map((t, i) => (<button key={i} onClick={() => toggleTask(i)} className="flex items-center gap-2 py-1 w-full text-left"><CheckSquare className={`w-3.5 h-3.5 ${t.done ? 'text-revelio-green' : 'text-revelio-border'}`} /><span className={`text-xs ${t.done ? 'line-through text-revelio-subtle dark:text-revelio-dark-subtle' : 'text-revelio-text dark:text-revelio-dark-text'}`}>{t.text}</span></button>))}
                </div>
              )}
            </div>
          )}

          {/* P2: Individual */}
          {retroPhase === 1 && (
            <div>
              <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-3.5 mb-4">
                <div className="flex gap-1.5 mb-2">{NOTE_CATS.map(c => (<button key={c.id} onClick={() => setNoteCat(c.id)} className={`px-2.5 py-1 rounded-lg text-[10px] font-medium ${noteCat === c.id ? 'text-white' : 'bg-revelio-bg dark:bg-revelio-dark-border text-revelio-subtle dark:text-revelio-dark-subtle'}`} style={noteCat === c.id ? { background: c.color } : undefined}>{c.label}</button>))}</div>
                <div className="flex gap-2"><input value={noteText} onChange={e => setNoteText(e.target.value)} onKeyDown={e => e.key === 'Enter' && addNote()} placeholder="Escribe una nota..." className="flex-1 rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-1.5 text-xs outline-none focus:border-revelio-blue dark:bg-revelio-dark-bg dark:text-revelio-dark-text" /><button onClick={addNote} disabled={!noteText.trim()} className="px-3 py-1.5 rounded-lg bg-revelio-blue text-white text-xs font-medium disabled:opacity-30 flex items-center gap-1"><Send className="w-3 h-3" /> Añadir</button></div>
              </div>
              {Object.entries(notesByCategory).map(([cat, cn]) => (
                <div key={cat} className="mb-4">
                  <h4 className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1" style={{ color: CAT_COLORS[cat] || '#86868B' }}><div className="w-2 h-2 rounded-full" style={{ background: CAT_COLORS[cat] }} /> {cat} ({cn.length})</h4>
                  {cn.map(n => (<div key={n.id} className="rounded-lg border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card px-3 py-2 flex items-center gap-2 group mb-1"><div className="w-1 h-5 rounded-full" style={{ background: CAT_COLORS[n.category] }} /><span className="text-xs flex-1">{n.text}</span><span className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle">{n.userName?.split(' ')[0]}</span>{user && n.userId === user.id && <button onClick={() => deleteNote(n.id)} className="opacity-0 group-hover:opacity-100 text-revelio-subtle dark:text-revelio-dark-subtle hover:text-revelio-red"><Trash2 className="w-3 h-3" /></button>}</div>))}
                </div>
              ))}
              {notes.length === 0 && <Empty message="Escribe notas con el formulario de arriba." />}
            </div>
          )}

          {/* P3: Discussion */}
          {retroPhase === 2 && (
            <div>
              <p className="text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle mb-3">Pulsa para votar</p>
              {[...notes].sort((a, b) => (b.votes?.length || 0) - (a.votes?.length || 0)).map(n => { const voted = user ? n.votes?.includes(user.id) : false; return (
                <div key={n.id} className="rounded-lg border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card px-3 py-2 mb-1 flex items-center gap-2">
                  <div className="w-1 h-5 rounded-full" style={{ background: CAT_COLORS[n.category] || '#86868B' }} />
                  <span className="text-xs flex-1">{n.text}</span>
                  <span className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle">{n.userName?.split(' ')[0]}</span>
                  <button onClick={() => toggleVote(n.id)} className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${voted ? 'bg-revelio-blue/15 text-revelio-blue' : 'bg-revelio-bg dark:bg-revelio-dark-border text-revelio-subtle dark:text-revelio-dark-subtle'}`}><ThumbsUp className="w-2.5 h-2.5" /> {n.votes?.length || 0}</button>
                </div>
              ) })}
              {notes.length === 0 && <Empty message="Sin notas. Vuelve a fase 2." />}
            </div>
          )}

          {/* P4: Risks */}
          {retroPhase === 3 && (
            <div>
              <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-3.5 mb-4">
                <div className="flex gap-1.5 mb-2">{RISK_TYPES.map(t => (<button key={t.id} onClick={() => setRiskType(t.id)} className={`px-2.5 py-1 rounded-lg text-[10px] font-medium ${riskType === t.id ? 'text-white' : 'bg-revelio-bg dark:bg-revelio-dark-border text-revelio-subtle dark:text-revelio-dark-subtle'}`} style={riskType === t.id ? { background: t.color } : undefined}>{t.label}</button>))}</div>
                <div className="flex gap-2 mb-2"><input value={riskText} onChange={e => setRiskText(e.target.value)} onKeyDown={e => e.key === 'Enter' && addRisk()} placeholder="Describe el riesgo..." className="flex-1 rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-1.5 text-xs outline-none focus:border-revelio-blue dark:bg-revelio-dark-bg dark:text-revelio-dark-text" /><button onClick={addRisk} disabled={!riskText.trim()} className="px-3 py-1.5 rounded-lg bg-revelio-orange text-white text-xs font-medium disabled:opacity-30 flex items-center gap-1"><Plus className="w-3 h-3" /> Añadir</button></div>
                <div className="flex gap-3">
                  <div className="flex items-center gap-1.5 text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle"><span>Prob:</span>{['baja', 'media', 'alta'].map(p => (<button key={p} onClick={() => setRiskProb(p)} className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${riskProb === p ? 'bg-revelio-text text-white' : 'bg-revelio-bg dark:bg-revelio-dark-border'}`}>{p}</button>))}</div>
                  <div className="flex items-center gap-1.5 text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle"><span>Impacto:</span>{['bajo', 'medio', 'alto'].map(i => (<button key={i} onClick={() => setRiskImpact(i)} className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${riskImpact === i ? 'bg-revelio-text text-white' : 'bg-revelio-bg dark:bg-revelio-dark-border'}`}>{i}</button>))}</div>
                </div>
              </div>
              {risks.length > 0 && <div className="mb-3"><RiskHeatmap risks={risks} /></div>}
              {risks.map(r => { const isOp = r.status !== 'mitigated'; return (
                <div key={r.id} className={`rounded-lg border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card px-3 py-2.5 group mb-1.5 ${isOp ? 'border-revelio-border' : 'border-revelio-border opacity-60'}`}>
                  <div className="flex items-start gap-2"><Shield className={`w-3.5 h-3.5 mt-0.5 ${isOp ? 'text-revelio-orange' : 'text-revelio-green'}`} /><div className="flex-1"><p className={`text-xs font-medium ${isOp ? '' : 'line-through text-revelio-subtle dark:text-revelio-dark-subtle'}`}>{r.title || r.text}</p><div className="flex gap-2 mt-0.5 text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle"><span className="capitalize">{r.type}</span><span>P:{r.prob}</span><span>I:{r.impact}</span></div></div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100"><button onClick={() => toggleRiskMitigated(r.id)} className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${isOp ? 'bg-revelio-green/10 text-revelio-green' : 'bg-revelio-orange/10 text-revelio-orange'}`}>{isOp ? 'Mitigar' : 'Reabrir'}</button><button onClick={() => deleteRisk(r.id)} className="text-revelio-subtle dark:text-revelio-dark-subtle hover:text-revelio-red"><Trash2 className="w-3 h-3" /></button></div>
                  </div>
                </div>
              ) })}
              {risks.length === 0 && <Empty message="Sin riesgos. Usa el formulario." />}
            </div>
          )}

          {/* P5: Actions */}
          {retroPhase === 4 && (
            <div>
              <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-3.5 mb-4">
                <div className="flex gap-2 mb-2"><input value={actionText} onChange={e => setActionText(e.target.value)} onKeyDown={e => e.key === 'Enter' && addAction()} placeholder="Describe la acción..." className="flex-1 rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-1.5 text-xs outline-none focus:border-revelio-blue dark:bg-revelio-dark-bg dark:text-revelio-dark-text" /><button onClick={addAction} disabled={!actionText.trim()} className="px-3 py-1.5 rounded-lg bg-revelio-blue text-white text-xs font-medium disabled:opacity-30 flex items-center gap-1"><Plus className="w-3 h-3" /> Crear</button></div>
                <div className="flex gap-2"><select value={actionOwner} onChange={e => setActionOwner(e.target.value)} className="rounded-lg border border-revelio-border dark:border-revelio-dark-border px-2 py-1 text-[10px] outline-none bg-white dark:bg-revelio-dark-bg dark:text-revelio-dark-text"><option value="">Responsable...</option>{teamMembers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}</select><input type="date" value={actionDate} onChange={e => setActionDate(e.target.value)} className="rounded-lg border border-revelio-border dark:border-revelio-dark-border px-2 py-1 text-[10px] outline-none" /></div>
              </div>
              {acts.map(a => { const isOv = a.status !== 'done' && a.date && a.date < today; const isDone = a.status === 'done' || a.status === 'archived'; return (
                <div key={a.id} className={`rounded-lg border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card px-3 py-2 flex items-center gap-2 group mb-1 ${isOv ? 'border-revelio-red/30' : 'border-revelio-border'}`}>
                  <button onClick={() => toggleActionStatus(a.id)} className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${isDone ? 'bg-revelio-green border-revelio-green' : 'border-revelio-border dark:border-revelio-dark-border hover:border-revelio-blue'}`}>{isDone && <CheckSquare className="w-2.5 h-2.5 text-white" />}</button>
                  <span className={`text-xs flex-1 ${isDone ? 'line-through text-revelio-subtle dark:text-revelio-dark-subtle' : ''}`}>{a.text}</span>
                  {a.owner && <span className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle">{a.owner.split(' ')[0]}</span>}
                  {a.date && <span className={`text-[9px] flex items-center gap-0.5 ${isOv ? 'text-revelio-red font-semibold' : 'text-revelio-subtle dark:text-revelio-dark-subtle'}`}><Clock className="w-2.5 h-2.5" />{new Date(a.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>}
                  <button onClick={() => deleteAction(a.id)} className="opacity-0 group-hover:opacity-100 text-revelio-subtle dark:text-revelio-dark-subtle hover:text-revelio-red"><Trash2 className="w-3 h-3" /></button>
                </div>
              ) })}
              {acts.length === 0 && <Empty message="Crea accionables." />}
            </div>
          )}

          {/* P6: Summary */}
          {retroPhase === 5 && (
            <div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
                {[
                  { l: 'Notas', v: notes.length, icon: MessageSquare, c: 'text-revelio-blue', bg: 'bg-revelio-blue/10' },
                  { l: 'Items', v: acts.length, icon: ListChecks, c: 'text-revelio-violet', bg: 'bg-revelio-violet/10' },
                  { l: 'Riesgos', v: rOpen.length, icon: AlertTriangle, c: rOpen.length > 0 ? 'text-revelio-orange' : 'text-revelio-green', bg: rOpen.length > 0 ? 'bg-revelio-orange/10' : 'bg-revelio-green/10' },
                  { l: 'Participantes', v: [...new Set(notes.map(n => n.userName))].length, icon: Users, c: 'text-revelio-text dark:text-revelio-dark-text', bg: 'bg-revelio-bg dark:bg-revelio-dark-border' },
                ].map(s => (
                  <div key={s.l} className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-3.5"><div className={`w-6 h-6 rounded-badge ${s.bg} flex items-center justify-center mb-1.5`}><s.icon className={`w-3 h-3 ${s.c}`} /></div><p className={`text-lg font-bold ${s.c}`}>{s.v}</p><p className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle uppercase tracking-wide">{s.l}</p></div>
                ))}
              </div>
              {notes.length > 0 && (
                <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-4 mb-3">
                  <h3 className="text-xs font-semibold mb-2">Notas más votadas</h3>
                  {[...notes].sort((a, b) => (b.votes?.length || 0) - (a.votes?.length || 0)).slice(0, 5).map(n => (<div key={n.id} className="flex items-center gap-1.5 py-1 border-b border-revelio-border dark:border-revelio-dark-border/50 last:border-0"><div className="w-1.5 h-1.5 rounded-full" style={{ background: CAT_COLORS[n.category] }} /><span className="text-[11px] flex-1">{n.text}</span><span className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle flex items-center gap-0.5"><ThumbsUp className="w-2.5 h-2.5" /> {n.votes?.length || 0}</span></div>))}
                </div>
              )}
              {acts.filter(a => a.status !== 'done' && a.status !== 'archived').length > 0 && (
                <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-4">
                  <h3 className="text-xs font-semibold mb-2">Items pendientes</h3>
                  {acts.filter(a => a.status !== 'done' && a.status !== 'archived').map(a => (<div key={a.id} className="flex items-center gap-1.5 py-1 border-b border-revelio-border dark:border-revelio-dark-border/50 last:border-0"><CheckSquare className="w-3 h-3 text-revelio-blue" /><span className="text-[11px] flex-1">{a.text}</span>{a.owner && <span className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle">{a.owner.split(' ')[0]}</span>}</div>))}
                </div>
              )}

              {/* Finalizar retro */}
              <button onClick={() => { setShowCelebration(true); soundComplete() }}
                className="w-full mt-5 py-3 rounded-xl bg-gradient-to-r from-revelio-blue to-revelio-violet text-white text-sm font-semibold flex items-center justify-center gap-2 hover:shadow-lg transition-all active:scale-[0.98]">
                <PartyPopper className="w-4 h-4" /> Finalizar retrospectiva
              </button>
            </div>
          )}
        </>}

        </div>
      </div>

      {/* Celebration overlay */}
      <Celebration
        show={showCelebration}
        onClose={() => { setShowCelebration(false); setInRetro(false) }}
        stats={{
          notes: notes.length,
          actions: acts.length,
          risks: rOpen.length,
          participants: [...new Set(notes.map(n => n.userName))].length,
          actionsDone: actDone,
        }}
      />

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

function Empty({ message }: { message: string }) {
  return <div className="text-center py-12"><MessageSquare className="w-8 h-8 mx-auto mb-1.5 text-revelio-border" /><p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle">{message}</p></div>
}
