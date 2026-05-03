// RetroTab — Tab "Retro" del proyecto.
//
// Encapsula el contenido de las 6 fases de la retrospectiva:
//   1. Revisión          — objetivo y tareas heredadas
//   2. Individual        — escribir notas por categoría
//   3. Discusión         — votar y debatir notas
//   4. Riesgos           — registrar riesgos / problemas / oportunidades
//   5. Items             — crear acciones concretas
//   6. Resumen           — revisar y finalizar la retro
//
// Lo que vive aquí dentro:
//   - State UI muy local: textos de los formularios, categoría seleccionada,
//     show/hide del modal de celebración.
//   - Handlers de mutación: addNote, deleteNote, addRisk, addAction, etc.
//
// Lo que NO vive aquí (lo aporta ProjectPage como prop):
//   - La fase activa (URL + realtime + autosave la gestiona el padre).
//   - Los datos persistidos (notes, tasks, objective, actions, risks).
//   - El canal Realtime (vive en ProjectPage para que el broadcast
//     llegue a todos los listeners, no solo a este tab).
//   - El banner de fase y el sidebar de fases (parte del chrome del proyecto).
import { useCallback, useMemo, useState } from 'react'
import {
  ClipboardCheck, MessageSquare, MessageCircle, AlertTriangle, ListChecks, BarChart3,
  Send, Plus, Trash2, ThumbsUp, CheckSquare, PartyPopper,
} from 'lucide-react'
import type { Member } from '@/types'
import { Celebration } from '@/components/retro/Celebration'
import { RiskHeatmap } from '@/components/retro/RiskHeatmap'
import { Empty, uid } from './_shared'
import { soundCreate, soundSuccess, soundDelete } from '@/lib/sounds'

// Local types — duplicated from ProjectPage for now. Pending refactor:
// move shared types to src/types/project.ts.
interface Action { id: string; text: string; status: string; owner: string; date: string; priority: string; createdAt: string; [k: string]: unknown }
interface Risk { id: string; text: string; title: string; status: string; prob: string; impact: string; type: string; owner: string; escalation?: { level?: string }; createdAt: string }
interface Note { id: string; text: string; category: string; userName: string; userId: string; votes: string[]; createdAt: string }
interface TaskItem { text: string; done: boolean }

interface CurrentUser { id: string; name: string }

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

interface RetroTabProps {
  /** Active phase (0..5). Lives in ProjectPage because URL + autosave + realtime own it. */
  phase: number
  /** Notes / tasks / objective: persisted retro state. */
  notes: Note[]
  tasks: TaskItem[]
  objective: string
  /** Project-wide state shown inside Items / Risks phases. */
  actions: Action[]
  risks: Risk[]
  /** Team members for owner pickers. */
  team: Member[]
  /** Current user (for vote ownership and note attribution). */
  currentUser: CurrentUser | null
  /** Mutators. Each one MUST handle persistence and realtime broadcast. */
  onNotesChange: (next: Note[]) => void
  onTasksChange: (next: TaskItem[]) => void
  onObjectiveChange: (next: string) => void
  onActionsChange: (next: Action[]) => void
  onRisksChange: (next: Risk[]) => void
  /** Phase advance — ProjectPage will navigate / persist / broadcast. */
  onPhaseChange: (phase: number) => void
}

export function RetroTab({
  phase, notes, tasks, objective, actions, risks, team, currentUser,
  onNotesChange, onTasksChange, onObjectiveChange, onActionsChange, onRisksChange, onPhaseChange,
}: RetroTabProps) {
  // Local form state — only relevant while typing.
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

  // Derived data
  const acts = useMemo(() => actions.filter(a => a.status !== 'discarded' && a.status !== 'cancelled'), [actions])
  const workItems = useMemo(() => acts.filter(a => (a.type || 'tarea') !== 'epica'), [acts])
  const actDone = workItems.filter(a => a.status === 'done' || a.status === 'archived').length
  const rOpen = useMemo(() => risks.filter(r => r.status !== 'mitigated'), [risks])
  const notesByCategory = useMemo(() => {
    const g: Record<string, Note[]> = {}
    notes.forEach(n => { const c = n.category || 'bien'; if (!g[c]) g[c] = []; g[c].push(n) })
    return g
  }, [notes])

  // Handlers (each one fires the corresponding onXChange so the parent persists + broadcasts)
  const addNote = useCallback(() => {
    if (!noteText.trim() || !currentUser) return
    const next = [...notes, { id: uid(), text: noteText.trim(), category: noteCat, userName: currentUser.name, userId: currentUser.id, votes: [], createdAt: new Date().toISOString() }]
    onNotesChange(next)
    setNoteText('')
  }, [noteText, noteCat, notes, currentUser, onNotesChange])

  const toggleVote = useCallback((nid: string) => {
    if (!currentUser) return
    const next = notes.map(n => n.id === nid ? { ...n, votes: n.votes.includes(currentUser.id) ? n.votes.filter(v => v !== currentUser.id) : [...n.votes, currentUser.id] } : n)
    onNotesChange(next)
  }, [notes, currentUser, onNotesChange])

  const deleteNote = useCallback((nid: string) => {
    const next = notes.filter(n => n.id !== nid)
    onNotesChange(next)
  }, [notes, onNotesChange])

  const addAction = useCallback(() => {
    if (!actionText.trim()) return
    const next: Action[] = [...actions, { id: uid(), text: actionText.trim(), status: 'todo', owner: actionOwner, date: actionDate, priority: 'medium', createdAt: new Date().toISOString() }]
    onActionsChange(next)
    setActionText('')
    setActionOwner('')
    setActionDate('')
    soundCreate()
  }, [actionText, actionOwner, actionDate, actions, onActionsChange])

  const toggleActionStatus = useCallback((id: string) => {
    const next = actions.map(a => a.id === id ? { ...a, status: a.status === 'done' ? 'todo' : 'done' } : a)
    onActionsChange(next)
    soundSuccess()
  }, [actions, onActionsChange])

  const deleteAction = useCallback((id: string) => {
    const next = actions.filter(a => a.id !== id)
    onActionsChange(next)
    soundDelete()
  }, [actions, onActionsChange])

  const addRisk = useCallback(() => {
    if (!riskText.trim()) return
    const next: Risk[] = [...risks, { id: uid(), text: riskText.trim(), title: riskText.trim(), status: 'open', prob: riskProb, impact: riskImpact, type: riskType, owner: '', createdAt: new Date().toISOString() }]
    onRisksChange(next)
    setRiskText('')
  }, [riskText, riskProb, riskImpact, riskType, risks, onRisksChange])

  const toggleRiskMitigated = useCallback((id: string) => {
    const next = risks.map(r => r.id === id ? { ...r, status: r.status === 'mitigated' ? 'open' : 'mitigated' } : r)
    onRisksChange(next)
  }, [risks, onRisksChange])

  const deleteRisk = useCallback((id: string) => {
    const next = risks.filter(r => r.id !== id)
    onRisksChange(next)
  }, [risks, onRisksChange])

  const toggleTask = useCallback((i: number) => {
    const next = tasks.map((t, idx) => idx === i ? { ...t, done: !t.done } : t)
    onTasksChange(next)
  }, [tasks, onTasksChange])

  return (
    <>
      {/* P1: Review */}
      {phase === 0 && (
        <div>
          <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-4 mb-3">
            <h3 className="text-xs font-semibold text-revelio-text dark:text-revelio-dark-text mb-1.5 flex items-center gap-1"><ClipboardCheck className="w-3.5 h-3.5 text-revelio-blue" /> Objetivo</h3>
            <input value={objective} onChange={e => onObjectiveChange(e.target.value)} placeholder="Objetivo del periodo..." className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-sm outline-none focus:border-revelio-blue dark:bg-revelio-dark-bg dark:text-revelio-dark-text" />
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
      {phase === 1 && (
        <div>
          <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-3.5 mb-4">
            <div className="flex gap-1.5 mb-2">{NOTE_CATS.map(c => (<button key={c.id} onClick={() => setNoteCat(c.id)} className={`px-2.5 py-1 rounded-lg text-[10px] font-medium ${noteCat === c.id ? 'text-white' : 'bg-revelio-bg dark:bg-revelio-dark-border text-revelio-subtle dark:text-revelio-dark-subtle'}`} style={noteCat === c.id ? { background: c.color } : undefined}>{c.label}</button>))}</div>
            <div className="flex gap-2"><input value={noteText} onChange={e => setNoteText(e.target.value)} onKeyDown={e => e.key === 'Enter' && addNote()} placeholder="Escribe una nota..." className="flex-1 rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-1.5 text-xs outline-none focus:border-revelio-blue dark:bg-revelio-dark-bg dark:text-revelio-dark-text" /><button onClick={addNote} disabled={!noteText.trim()} className="px-3 py-1.5 rounded-lg bg-revelio-blue text-white text-xs font-medium disabled:opacity-30 flex items-center gap-1"><Send className="w-3 h-3" /> Añadir</button></div>
          </div>
          {Object.entries(notesByCategory).map(([cat, cn]) => (
            <div key={cat} className="mb-4">
              <h4 className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1" style={{ color: CAT_COLORS[cat] || '#86868B' }}><div className="w-2 h-2 rounded-full" style={{ background: CAT_COLORS[cat] }} /> {cat} ({cn.length})</h4>
              {cn.map(n => (<div key={n.id} className="rounded-lg border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card px-3 py-2 flex items-center gap-2 group mb-1"><div className="w-1 h-5 rounded-full" style={{ background: CAT_COLORS[n.category] }} /><span className="text-xs flex-1">{n.text}</span><span className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle">{n.userName?.split(' ')[0]}</span>{currentUser && n.userId === currentUser.id && <button onClick={() => deleteNote(n.id)} className="opacity-0 group-hover:opacity-100 text-revelio-subtle dark:text-revelio-dark-subtle hover:text-revelio-red"><Trash2 className="w-3 h-3" /></button>}</div>))}
            </div>
          ))}
          {notes.length === 0 && <Empty message="Escribe notas con el formulario de arriba." />}
        </div>
      )}

      {/* P3: Discuss / vote */}
      {phase === 2 && (
        <div>
          <p className="text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle mb-3">Pulsa para votar</p>
          {Object.entries(notesByCategory).map(([cat, cn]) => (
            <div key={cat} className="mb-4">
              <h4 className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1" style={{ color: CAT_COLORS[cat] || '#86868B' }}><div className="w-2 h-2 rounded-full" style={{ background: CAT_COLORS[cat] }} /> {cat}</h4>
              {[...cn].sort((a, b) => (b.votes?.length || 0) - (a.votes?.length || 0)).map(n => {
                const voted = currentUser ? n.votes?.includes(currentUser.id) : false
                return (
                  <div key={n.id} className="rounded-lg border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card px-3 py-2 flex items-center gap-2 mb-1">
                    <div className="w-1 h-5 rounded-full" style={{ background: CAT_COLORS[n.category] }} />
                    <span className="text-xs flex-1">{n.text}</span>
                    <button onClick={() => toggleVote(n.id)} className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${voted ? 'bg-revelio-blue/15 text-revelio-blue' : 'bg-revelio-bg dark:bg-revelio-dark-border text-revelio-subtle dark:text-revelio-dark-subtle'}`}><ThumbsUp className="w-2.5 h-2.5" /> {n.votes?.length || 0}</button>
                  </div>
                )
              })}
            </div>
          ))}
          {notes.length === 0 && <Empty message="Sin notas. Vuelve a fase 2." />}
        </div>
      )}

      {/* P4: Risks */}
      {phase === 3 && (
        <div>
          <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-3.5 mb-4">
            <div className="flex gap-1.5 mb-2">{RISK_TYPES.map(t => (<button key={t.id} onClick={() => setRiskType(t.id)} className={`px-2.5 py-1 rounded-lg text-[10px] font-medium ${riskType === t.id ? 'text-white' : 'bg-revelio-bg dark:bg-revelio-dark-border text-revelio-subtle dark:text-revelio-dark-subtle'}`} style={riskType === t.id ? { background: t.color } : undefined}>{t.label}</button>))}</div>
            <div className="flex gap-2 mb-2"><input value={riskText} onChange={e => setRiskText(e.target.value)} onKeyDown={e => e.key === 'Enter' && addRisk()} placeholder="Describe el riesgo..." className="flex-1 rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-1.5 text-xs outline-none focus:border-revelio-blue dark:bg-revelio-dark-bg dark:text-revelio-dark-text" /><button onClick={addRisk} disabled={!riskText.trim()} className="px-3 py-1.5 rounded-lg bg-revelio-orange text-white text-xs font-medium disabled:opacity-30 flex items-center gap-1"><Plus className="w-3 h-3" /> Añadir</button></div>
            <div className="flex gap-3">
              <div className="flex items-center gap-1.5 text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle"><span>Prob:</span>{['baja', 'media', 'alta'].map(p => (<button key={p} onClick={() => setRiskProb(p)} className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${riskProb === p ? 'bg-revelio-text text-white' : 'bg-revelio-bg dark:bg-revelio-dark-border'}`}>{p}</button>))}</div>
              <div className="flex items-center gap-1.5 text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle"><span>Impacto:</span>{['bajo', 'medio', 'alto'].map(p => (<button key={p} onClick={() => setRiskImpact(p)} className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${riskImpact === p ? 'bg-revelio-text text-white' : 'bg-revelio-bg dark:bg-revelio-dark-border'}`}>{p}</button>))}</div>
            </div>
          </div>
          {rOpen.length > 0 && (
            <div className="mb-4"><RiskHeatmap risks={rOpen} /></div>
          )}
          {risks.map(r => (
            <div key={r.id} className="rounded-lg border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card px-3 py-2 flex items-center gap-2 group mb-1">
              <span className={`text-[9px] font-bold uppercase ${r.status === 'mitigated' ? 'text-revelio-green' : 'text-revelio-orange'}`}>{r.status === 'mitigated' ? '✓' : r.type}</span>
              <span className={`text-xs flex-1 ${r.status === 'mitigated' ? 'line-through text-revelio-subtle dark:text-revelio-dark-subtle' : ''}`}>{r.text}</span>
              <span className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle">{r.prob}/{r.impact}</span>
              <button onClick={() => toggleRiskMitigated(r.id)} className="text-[10px] text-revelio-green hover:underline opacity-0 group-hover:opacity-100">{r.status === 'mitigated' ? 'Reabrir' : 'Mitigar'}</button>
              <button onClick={() => deleteRisk(r.id)} className="opacity-0 group-hover:opacity-100 text-revelio-subtle dark:text-revelio-dark-subtle hover:text-revelio-red"><Trash2 className="w-3 h-3" /></button>
            </div>
          ))}
          {risks.length === 0 && <Empty message="Sin riesgos. Usa el formulario." />}
        </div>
      )}

      {/* P5: Items / actions */}
      {phase === 4 && (
        <div>
          <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-3.5 mb-4">
            <div className="flex gap-2 mb-2"><input value={actionText} onChange={e => setActionText(e.target.value)} onKeyDown={e => e.key === 'Enter' && addAction()} placeholder="Describe la acción..." className="flex-1 rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-1.5 text-xs outline-none focus:border-revelio-blue dark:bg-revelio-dark-bg dark:text-revelio-dark-text" /><button onClick={addAction} disabled={!actionText.trim()} className="px-3 py-1.5 rounded-lg bg-revelio-blue text-white text-xs font-medium disabled:opacity-30 flex items-center gap-1"><Plus className="w-3 h-3" /> Crear</button></div>
            <div className="flex gap-2">
              <select value={actionOwner} onChange={e => setActionOwner(e.target.value)} className="rounded-lg border border-revelio-border dark:border-revelio-dark-border px-2 py-1 text-[10px] outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text">
                <option value="">Sin responsable</option>
                {team.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
              </select>
              <input type="date" value={actionDate} onChange={e => setActionDate(e.target.value)} className="rounded-lg border border-revelio-border dark:border-revelio-dark-border px-2 py-1 text-[10px] outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text" />
            </div>
          </div>
          {acts.map(a => (
            <div key={a.id} className="rounded-lg border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card px-3 py-2 flex items-center gap-2 group mb-1">
              <button onClick={() => toggleActionStatus(a.id)} className={`w-4 h-4 rounded flex items-center justify-center ${a.status === 'done' ? 'bg-revelio-green text-white' : 'border border-revelio-border'}`}>{a.status === 'done' && <CheckSquare className="w-3 h-3" />}</button>
              <span className={`text-xs flex-1 ${a.status === 'done' ? 'line-through text-revelio-subtle dark:text-revelio-dark-subtle' : ''}`}>{a.text}</span>
              {a.owner && <span className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle">{a.owner.split(' ')[0]}</span>}
              {a.date && <span className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle">{new Date(a.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>}
              <button onClick={() => deleteAction(a.id)} className="opacity-0 group-hover:opacity-100 text-revelio-subtle dark:text-revelio-dark-subtle hover:text-revelio-red"><Trash2 className="w-3 h-3" /></button>
            </div>
          ))}
          {acts.length === 0 && <Empty message="Crea accionables." />}
        </div>
      )}

      {/* P6: Summary */}
      {phase === 5 && (
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
            {[
              { l: 'Notas', v: notes.length, icon: MessageSquare, c: 'text-revelio-blue', bg: 'bg-revelio-blue/10' },
              { l: 'Items', v: acts.length, icon: ListChecks, c: 'text-revelio-green', bg: 'bg-revelio-green/10' },
              { l: 'Riesgos', v: rOpen.length, icon: AlertTriangle, c: rOpen.length > 0 ? 'text-revelio-orange' : 'text-revelio-green', bg: rOpen.length > 0 ? 'bg-revelio-orange/10' : 'bg-revelio-green/10' },
              { l: 'Participantes', v: [...new Set(notes.map(n => n.userName))].length, icon: ListChecks, c: 'text-revelio-text dark:text-revelio-dark-text', bg: 'bg-revelio-bg dark:bg-revelio-dark-border' },
            ].map(s => (
              <div key={s.l} className={`rounded-card p-3 ${s.bg}`}><s.icon className={`w-4 h-4 mb-1 ${s.c}`} /><p className={`text-lg font-bold ${s.c}`}>{s.v}</p><p className="text-[8px] text-revelio-subtle dark:text-revelio-dark-subtle uppercase">{s.l}</p></div>
            ))}
          </div>
          <button onClick={() => setShowCelebration(true)} className="w-full px-4 py-2.5 rounded-card bg-revelio-violet text-white text-xs font-semibold flex items-center justify-center gap-1.5 hover:opacity-90"><PartyPopper className="w-3.5 h-3.5" /> Finalizar retro</button>
        </div>
      )}

      {/* Celebration overlay */}
      <Celebration
        show={showCelebration}
        onClose={() => { setShowCelebration(false); onPhaseChange(0) }}
        stats={{
          notes: notes.length,
          actions: acts.length,
          risks: rOpen.length,
          participants: [...new Set(notes.map(n => n.userName))].length,
          actionsDone: actDone,
        }}
      />
    </>
  )
}

// Re-export so ProjectPage can keep using the constant for the sidebar
// without having to declare it twice. Phases are sequenced visually in the
// sidebar, but their logic lives here.
export const RETRO_PHASES = [
  { id: 'review', label: 'Revisión', num: '01', icon: ClipboardCheck, desc: 'Revisa objetivo y tareas.' },
  { id: 'individual', label: 'Individual', num: '02', icon: MessageSquare, desc: 'Escribe notas individuales.' },
  { id: 'discuss', label: 'Discusión', num: '03', icon: MessageCircle, desc: 'Vota y debate las notas.' },
  { id: 'risks', label: 'Riesgos', num: '04', icon: AlertTriangle, desc: 'Identifica riesgos y problemas.' },
  { id: 'actions', label: 'Items', num: '05', icon: ListChecks, desc: 'Crea tareas concretas.' },
  { id: 'summary', label: 'Resumen', num: '06', icon: BarChart3, desc: 'Revisa y finaliza.' },
]
