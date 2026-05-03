// SeguimientoTab — Tab "Seguimiento" del proyecto.
// Vista principal de gestión de actionables (tareas y épicas), con 4 sub-vistas:
//   - list:     agrupado por estado o por horizonte temporal
//   - board:    kanban con drag-and-drop entre columnas
//   - timeline: gantt visual delegado a TimelineView
//   - epics:    agrupación por épica con drag-and-drop para asignar
//
// El sub-view es state interno; no se persiste en URL. Lo mismo para el
// zoom y offset del timeline, que solo viven mientras estás aquí.
import { useMemo, useState } from 'react'
import { ListChecks, LayoutDashboard, TrendingUp, FolderOpen, Plus } from 'lucide-react'
import type { Member } from '@/types'
import { TimelineView } from './TimelineView'
import { Empty, uid } from './_shared'
import { soundDrop, soundSlide } from '@/lib/sounds'

// Local types — duplicated from ProjectPage for now. Pending refactor:
// move shared types to src/types/project.ts.
interface Action { id: string; text: string; status: string; owner: string; date: string; priority: string; createdAt: string; [k: string]: unknown }
interface Risk { id: string; text: string; title: string; status: string; prob: string; impact: string; type: string; owner: string; escalation?: { level?: string }; createdAt: string }

// Visual mappings — only used here; kept local for cohesion.
const STATUS_LABEL: Record<string, string> = { todo: 'Pendiente', backlog: 'Backlog', doing: 'En curso', in_progress: 'En curso', inprogress: 'En curso', done: 'Hecho', blocked: 'Bloqueado' }
const STATUS_COLOR: Record<string, string> = { todo: 'bg-gray-200 text-gray-600', backlog: 'bg-gray-200 text-gray-600', doing: 'bg-revelio-blue/15 text-revelio-blue', in_progress: 'bg-revelio-blue/15 text-revelio-blue', done: 'bg-revelio-green/15 text-revelio-green', blocked: 'bg-revelio-red/15 text-revelio-red' }
const PRIO_COLOR: Record<string, string> = { critical: 'text-revelio-red', high: 'text-revelio-orange', medium: 'text-revelio-blue', low: 'text-revelio-subtle dark:text-revelio-dark-subtle' }
const PRIO_BG: Record<string, string> = { critical: 'bg-revelio-red/10', high: 'bg-revelio-orange/10', medium: 'bg-revelio-blue/10', low: 'bg-revelio-bg dark:bg-revelio-dark-border' }
const PRIO_LABEL: Record<string, string> = { critical: 'Crítica', high: 'Alta', medium: 'Media', low: 'Baja' }

// Kanban board columns. Order matters: from left to right.
const KANBAN_COLS: Array<{ id: string; label: string; color: string }> = [
  { id: 'todo', label: 'Pendiente', color: '#8E8E93' },
  { id: 'doing', label: 'En curso', color: '#007AFF' },
  { id: 'blocked', label: 'Bloqueado', color: '#FF3B30' },
  { id: 'done', label: 'Hecho', color: '#34C759' },
]

type SeguiView = 'list' | 'board' | 'timeline' | 'epics'
type ListGroup = 'status' | 'horizon'
type TlZoom = 'week' | 'month' | 'quarter' | 'year'

interface SeguimientoTabProps {
  /** Raw actions (incluye épicas y tareas). Necesario para drag-and-drop. */
  actions: Action[]
  /** Risks for the timeline overlay. */
  risks: Risk[]
  /** Project team for the timeline rows. */
  team: Member[]
  /**
   * Update the actions list. ProjectPage debe encargarse de persistir y
   * hacer el broadcast realtime; aquí solo emitimos el array nuevo.
   */
  onActionsChange: (next: Action[]) => void
  /** Open the task detail modal (edit / create). */
  onOpenDetail: (action: Action) => void
}

export function SeguimientoTab({ actions, risks, team, onActionsChange, onOpenDetail }: SeguimientoTabProps) {
  const [view, setView] = useState<SeguiView>('list')
  const [tlZoom, setTlZoom] = useState<TlZoom>('month')
  const [tlOffset, setTlOffset] = useState(0)
  const [listGroup, setListGroup] = useState<ListGroup>('status')

  const acts = useMemo(() => actions.filter(a => a.status !== 'discarded' && a.status !== 'cancelled'), [actions])
  const workItems = useMemo(() => acts.filter(a => (a.type || 'tarea') !== 'epica'), [acts])
  const actDone = workItems.filter(a => a.status === 'done' || a.status === 'archived').length
  const today = new Date().toISOString().slice(0, 10)

  return (
            <div>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle">{workItems.length} items · {actDone} completados</p>
                <div className="flex items-center gap-2">
                  <div className="flex bg-revelio-bg dark:bg-revelio-dark-border rounded-lg overflow-hidden">
                    <button onClick={() => setView('list')} className={`px-2.5 py-1 text-[10px] font-semibold flex items-center gap-1 ${view === 'list' ? 'bg-revelio-blue text-white' : 'text-revelio-subtle dark:text-revelio-dark-subtle'}`}><ListChecks className="w-3 h-3" /> Lista</button>
                    <button onClick={() => setView('board')} className={`px-2.5 py-1 text-[10px] font-semibold flex items-center gap-1 ${view === 'board' ? 'bg-revelio-blue text-white' : 'text-revelio-subtle dark:text-revelio-dark-subtle'}`}><LayoutDashboard className="w-3 h-3" /> Board</button>
                    <button onClick={() => setView('timeline')} className={`px-2.5 py-1 text-[10px] font-semibold flex items-center gap-1 ${view === 'timeline' ? 'bg-revelio-blue text-white' : 'text-revelio-subtle dark:text-revelio-dark-subtle'}`}><TrendingUp className="w-3 h-3" /> Timeline</button>
                    <button onClick={() => setView('epics')} className={`px-2.5 py-1 text-[10px] font-semibold flex items-center gap-1 ${view === 'epics' ? 'bg-revelio-blue text-white' : 'text-revelio-subtle dark:text-revelio-dark-subtle'}`}><FolderOpen className="w-3 h-3" /> Épicas</button>
                  </div>
                  <button onClick={() => {
                    const newItem: Action = { id: uid(), text: '', status: 'backlog', owner: '', date: '', priority: 'medium', createdAt: new Date().toISOString(), type: 'tarea' }
                    onOpenDetail(newItem)
                  }} className="px-3 py-1.5 rounded-lg bg-revelio-blue text-white text-[10px] font-semibold flex items-center gap-1 hover:bg-revelio-blue/90 transition-colors">
                    <Plus className="w-3 h-3" /> Nuevo item
                  </button>
                </div>
              </div>

              {/* LIST VIEW */}
              {view === 'list' && (
                <div>
                  {/* Group by toggle */}
                  <div className="flex gap-1 mb-3">
                    <span className="text-[8px] text-revelio-subtle dark:text-revelio-dark-subtle self-center mr-1">Agrupar:</span>
                    <button onClick={() => setListGroup('status')} className={`px-2 py-0.5 rounded text-[8px] font-semibold ${listGroup === 'status' ? 'bg-revelio-blue text-white' : 'bg-revelio-bg dark:bg-revelio-dark-border text-revelio-subtle dark:text-revelio-dark-subtle'}`}>Estado</button>
                    <button onClick={() => setListGroup('horizon')} className={`px-2 py-0.5 rounded text-[8px] font-semibold ${listGroup === 'horizon' ? 'bg-revelio-blue text-white' : 'bg-revelio-bg dark:bg-revelio-dark-border text-revelio-subtle dark:text-revelio-dark-subtle'}`}>Horizonte</button>
                  </div>

                  {listGroup === 'status' && ['doing', 'todo', 'backlog', 'blocked', 'done'].map(status => {
                    const items = workItems.filter(a => { if (status === 'doing') return a.status === 'doing' || a.status === 'in_progress' || a.status === 'inprogress'; if (status === 'todo') return a.status === 'todo' || a.status === 'pending'; return a.status === status })
                    if (items.length === 0) return null
                    return (
                      <div key={status} className="mb-5">
                        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-revelio-subtle dark:text-revelio-dark-subtle mb-1.5 flex items-center gap-1.5"><span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${STATUS_COLOR[status] || 'bg-gray-100 text-gray-500'}`}>{STATUS_LABEL[status] || status}</span><span className="text-revelio-border">{items.length}</span></h4>
                        <div className="space-y-1">
                          {items.map(a => { const isOv = a.status !== 'done' && a.date && a.date < today; return (
                            <div key={a.id} onClick={() => onOpenDetail(a)} className={`rounded-lg border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card px-3 py-2 flex items-center gap-2.5 cursor-pointer hover:border-revelio-blue/30 transition-colors ${isOv ? 'border-revelio-red/30' : 'border-revelio-border'}`}>
                              <div className={`w-1.5 h-1.5 rounded-full ${a.status === 'done' ? 'bg-revelio-green' : a.status === 'blocked' ? 'bg-revelio-red' : 'bg-revelio-blue'}`} />
                              <span className={`text-xs flex-1 ${a.status === 'done' ? 'line-through text-revelio-subtle dark:text-revelio-dark-subtle' : 'text-revelio-text dark:text-revelio-dark-text'}`}>{a.text}</span>
                              {a.priority && <span className={`text-[9px] font-semibold px-1 py-0.5 rounded ${PRIO_BG[a.priority] || ''} ${PRIO_COLOR[a.priority] || ''}`}>{PRIO_LABEL[a.priority]}</span>}
                              {a.owner && <span className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle">{a.owner.split(' ')[0]}</span>}
                              {a.date && <span className={`text-[9px] ${isOv ? 'text-revelio-red font-semibold' : 'text-revelio-subtle dark:text-revelio-dark-subtle'}`}>{new Date(a.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>}
                            </div>
                          ) })}
                        </div>
                      </div>
                    )
                  })}

                  {listGroup === 'horizon' && (() => {
                    const pending = workItems.filter(a => a.status !== 'done' && a.status !== 'archived')
                    const endOfToday = today
                    const endOfWeek = (() => { const d = new Date(); d.setDate(d.getDate() + (7 - d.getDay())); return d.toISOString().slice(0, 10) })()
                    const endOfMonth = (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10) })()

                    const groups = [
                      { label: 'Vencido', color: '#FF3B30', items: pending.filter(a => a.date && a.date < endOfToday) },
                      { label: 'Hoy', color: '#FF9500', items: pending.filter(a => a.date === endOfToday) },
                      { label: 'Esta semana', color: '#007AFF', items: pending.filter(a => a.date && a.date > endOfToday && a.date <= endOfWeek) },
                      { label: 'Este mes', color: '#5856D6', items: pending.filter(a => a.date && a.date > endOfWeek && a.date <= endOfMonth) },
                      { label: 'Después', color: '#8E8E93', items: pending.filter(a => a.date && a.date > endOfMonth) },
                      { label: 'Sin fecha', color: '#C7C7CC', items: pending.filter(a => !a.date) },
                    ]

                    return groups.map(g => {
                      if (g.items.length === 0) return null
                      return (
                        <div key={g.label} className="mb-5">
                          <h4 className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                            <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold text-white" style={{ background: g.color }}>{g.label}</span>
                            <span className="text-revelio-border dark:text-revelio-dark-border">{g.items.length}</span>
                          </h4>
                          <div className="space-y-1">
                            {g.items.map(a => (
                              <div key={a.id} onClick={() => onOpenDetail(a)} className={`rounded-lg border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card px-3 py-2 flex items-center gap-2.5 cursor-pointer hover:border-revelio-blue/30 transition-colors ${g.label === 'Vencido' ? 'border-revelio-red/30' : 'border-revelio-border'}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${a.status === 'blocked' ? 'bg-revelio-red' : a.status === 'doing' || a.status === 'inprogress' ? 'bg-revelio-blue' : 'bg-revelio-subtle'}`} />
                                <span className="text-xs flex-1 text-revelio-text dark:text-revelio-dark-text">{a.text}</span>
                                <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${STATUS_COLOR[a.status] || 'bg-gray-100 text-gray-500'}`}>{STATUS_LABEL[a.status] || a.status}</span>
                                {a.owner && <span className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle">{a.owner.split(' ')[0]}</span>}
                                {a.date && <span className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle">{new Date(a.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })
                  })()}

                  {workItems.length === 0 && <Empty message="Sin items." />}
                </div>
              )}

              {/* KANBAN BOARD */}
              {view === 'board' && (
                <div>
                  {/* Kanban columns */}
                  <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: 300 }}>
                  {KANBAN_COLS.map(col => {
                    const items = workItems.filter(a => {
                      if (col.id === 'doing') return a.status === 'doing' || a.status === 'in_progress' || a.status === 'inprogress'
                      if (col.id === 'todo') return a.status === 'todo' || a.status === 'pending'
                      return a.status === col.id
                    })
                    return (
                      <div key={col.id} className="flex-shrink-0 w-60 flex flex-col"
                        onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('ring-2', 'ring-revelio-blue/30') }}
                        onDragLeave={e => { e.currentTarget.classList.remove('ring-2', 'ring-revelio-blue/30') }}
                        onDrop={e => {
                          e.currentTarget.classList.remove('ring-2', 'ring-revelio-blue/30')
                          const id = e.dataTransfer.getData('text/plain')
                          if (!id) return
                          const newStatus = col.id === 'doing' ? 'doing' : col.id === 'todo' ? 'todo' : col.id
                          const next = actions.map(a => a.id === id ? { ...a, status: newStatus, updatedAt: new Date().toISOString() } : a)
                          onActionsChange(next)
                          soundDrop()
                        }}>
                        <div className="flex items-center gap-1.5 mb-2 px-1">
                          <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                          <span className="text-[10px] font-bold uppercase tracking-wider dark:text-revelio-dark-text">{col.label}</span>
                          <span className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle ml-auto bg-revelio-bg dark:bg-revelio-dark-border px-1.5 py-0.5 rounded-full">{items.length}</span>
                        </div>
                        <div className="flex-1 bg-revelio-bg/50 dark:bg-revelio-dark-border/30 rounded-xl p-1.5 space-y-1.5 min-h-[80px] transition-all">
                          {items.map(a => {
                            const isOv = a.status !== 'done' && a.date && a.date < today
                            return (
                              <div key={a.id} draggable
                                onDragStart={e => { e.dataTransfer.setData('text/plain', a.id); e.dataTransfer.effectAllowed = 'move'; soundSlide() }}
                                onClick={() => onOpenDetail(a)}
                                className={`rounded-lg border bg-white dark:bg-revelio-dark-card p-2.5 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-revelio-blue/30 transition-all ${isOv ? 'border-revelio-red/30' : 'border-revelio-border dark:border-revelio-dark-border'}`}>
                                <p className={`text-[11px] font-medium leading-snug mb-1.5 ${a.status === 'done' ? 'line-through text-revelio-subtle dark:text-revelio-dark-subtle' : 'dark:text-revelio-dark-text'}`}>{a.text}</p>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {a.priority && <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${PRIO_BG[a.priority] || ''} ${PRIO_COLOR[a.priority] || ''}`}>{PRIO_LABEL[a.priority]}</span>}
                                  {a.owner && <span className="text-[8px] text-revelio-subtle dark:text-revelio-dark-subtle bg-revelio-bg dark:bg-revelio-dark-border px-1 py-0.5 rounded">{a.owner.split(' ')[0]}</span>}
                                  {a.date && <span className={`text-[8px] ${isOv ? 'text-revelio-red font-bold' : 'text-revelio-subtle dark:text-revelio-dark-subtle'}`}>{new Date(a.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>}
                                  {a.epicLink ? <span className="text-[8px] text-revelio-violet font-semibold">{String(a.epicLink)}</span> : null}
                                </div>
                              </div>
                            )
                          })}
                          {items.length === 0 && <p className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle text-center py-4">—</p>}
                        </div>
                      </div>
                    )
                  })}
                  </div>

                  {/* Backlog — separate section below board */}
                  {(() => {
                    const blItems = workItems.filter(a => a.status === 'backlog')
                    if (blItems.length === 0) return null
                    return (
                      <div className="mt-4 rounded-card border border-dashed border-revelio-border dark:border-revelio-dark-border bg-revelio-bg/30 dark:bg-revelio-dark-border/20 p-4"
                        onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('ring-2', 'ring-revelio-blue/30') }}
                        onDragLeave={e => { e.currentTarget.classList.remove('ring-2', 'ring-revelio-blue/30') }}
                        onDrop={e => { e.currentTarget.classList.remove('ring-2', 'ring-revelio-blue/30'); const id = e.dataTransfer.getData('text/plain'); if (!id) return; const next = actions.map(a => a.id === id ? { ...a, status: 'backlog', updatedAt: new Date().toISOString() } : a); onActionsChange(next) }}>
                        <div className="flex items-center gap-1.5 mb-2">
                          <div className="w-2 h-2 rounded-full bg-[#86868B]" />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-revelio-subtle dark:text-revelio-dark-subtle">Backlog</span>
                          <span className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle ml-1 bg-revelio-bg dark:bg-revelio-dark-border px-1.5 py-0.5 rounded-full">{blItems.length}</span>
                        </div>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                          {blItems.map(a => (
                            <div key={a.id} draggable onDragStart={e => { e.dataTransfer.setData('text/plain', a.id); e.dataTransfer.effectAllowed = 'move'; soundSlide() }}
                              onClick={() => onOpenDetail(a)}
                              className="rounded-lg border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card px-3 py-2 cursor-grab active:cursor-grabbing hover:shadow-sm hover:border-revelio-blue/30 transition-all flex items-center gap-2">
                              <span className="text-[11px] flex-1 dark:text-revelio-dark-text">{a.text}</span>
                              {a.priority && <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${PRIO_BG[a.priority] || ''} ${PRIO_COLOR[a.priority] || ''}`}>{PRIO_LABEL[a.priority]}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}
              {view === 'timeline' && (
                <TimelineView
                  workItems={workItems}
                  allActions={actions}
                  team={team.map(m => ({ id: m.id, name: m.name, avatar: m.avatar, color: m.color, vacations: (m.vacations || []) as unknown as Array<{ from: string; to?: string; type?: string; label?: string }> }))}
                  risks={risks}
                  today={today}
                  zoom={tlZoom}
                  offset={tlOffset}
                  onZoomChange={z => { setTlZoom(z); setTlOffset(0) }}
                  onOffsetChange={setTlOffset}
                  onItemClick={a => onOpenDetail(a as unknown as Action)}
                  onItemUpdate={updated => {
                    const next = actions.map(a => a.id === updated.id ? { ...a, ...updated } : a)
                    onActionsChange(next)
                  }}
                />
              )}

              {view === 'epics' && (() => {
                const epicItems = acts.filter(a => (a.type || '') === 'epica')
                const epicGroups = epicItems.map(epic => {
                  const children = acts.filter(a => String(a.epicLink || '') === epic.id)
                  const done = children.filter(a => a.status === 'done' || a.status === 'archived').length
                  const totalSP = children.reduce((s, a) => s + (Number(a.storyPoints) || 0), 0)
                  const doneSP = children.filter(a => a.status === 'done' || a.status === 'archived').reduce((s, a) => s + (Number(a.storyPoints) || 0), 0)
                  const totalH = children.reduce((s, a) => s + (Number(a.hours) || 0), 0)
                  const pct = children.length > 0 ? Math.round(done / children.length * 100) : 0
                  const epicStatus = epic.status === 'done' ? 'done' : pct === 100 && children.length > 0 ? 'done' : pct > 0 ? 'doing' : 'todo'
                  return { ...epic, children, done, total: children.length, totalSP, doneSP, totalH, pct, epicStatus }
                })
                const noEpic = acts.filter(a => (a.type || '') !== 'epica' && !a.epicLink)

                const dropOnEpic = (epicId: string, itemId: string) => {
                  const next = actions.map(a => a.id === itemId ? { ...a, epicLink: epicId } : a)
                  onActionsChange(next)
                }
                const dropOffEpic = (itemId: string) => {
                  const next = actions.map(a => a.id === itemId ? { ...a, epicLink: undefined } : a)
                  onActionsChange(next)
                }

                return (
                  <div className="space-y-3">
                    {epicGroups.length === 0 && (
                      <div className="text-center py-8">
                        <FolderOpen className="w-8 h-8 text-revelio-border dark:text-revelio-dark-border mx-auto mb-2" />
                        <p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle">Sin épicas definidas</p>
                        <p className="text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle mt-1">Pulsa "Nuevo item" y selecciona tipo Épica</p>
                      </div>
                    )}

                    {epicGroups.map(epic => (
                      <div key={epic.id} className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card overflow-hidden"
                        onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('ring-2', 'ring-[#AF52DE]/40') }}
                        onDragLeave={e => e.currentTarget.classList.remove('ring-2', 'ring-[#AF52DE]/40')}
                        onDrop={e => { e.currentTarget.classList.remove('ring-2', 'ring-[#AF52DE]/40'); const id = e.dataTransfer.getData('text/plain'); if (id && id !== epic.id) dropOnEpic(epic.id, id); soundDrop() }}>
                        <div className="px-4 py-3 border-b border-revelio-border/50 dark:border-revelio-dark-border/50 cursor-pointer hover:bg-revelio-bg/30 dark:hover:bg-revelio-dark-border/30" onClick={() => onOpenDetail(epic)}>
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-[#AF52DE]/10 flex items-center justify-center flex-shrink-0">
                              <FolderOpen className="w-4 h-4 text-[#AF52DE]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-semibold text-[#AF52DE]">{epic.text || 'Sin título'}</h4>
                                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${epic.epicStatus === 'done' ? 'bg-revelio-green/10 text-revelio-green' : epic.epicStatus === 'doing' ? 'bg-revelio-blue/10 text-revelio-blue' : 'bg-revelio-bg dark:bg-revelio-dark-border text-revelio-subtle dark:text-revelio-dark-subtle'}`}>{epic.epicStatus === 'done' ? 'Completada' : epic.epicStatus === 'doing' ? 'En progreso' : 'Pendiente'}</span>
                                <span className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle">{epic.done}/{epic.total} items</span>
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                <div className="flex-1 h-1.5 bg-revelio-bg dark:bg-revelio-dark-border rounded-full overflow-hidden max-w-[200px]">
                                  <div className="h-full rounded-full transition-all" style={{ width: `${epic.pct}%`, background: epic.pct === 100 ? '#34C759' : epic.pct > 50 ? '#007AFF' : '#FF9500' }} />
                                </div>
                                <span className="text-[10px] font-bold" style={{ color: epic.pct === 100 ? '#34C759' : epic.pct > 50 ? '#007AFF' : '#FF9500' }}>{epic.pct}%</span>
                                {epic.totalSP > 0 && <span className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle">{epic.doneSP}/{epic.totalSP} SP</span>}
                                {epic.totalH > 0 && <span className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle">{epic.totalH}h</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                        {epic.children.length > 0 && (
                          <div className="divide-y divide-revelio-border/30 dark:divide-revelio-dark-border/30">
                            {epic.children.map(a => {
                              const isDone = a.status === 'done' || a.status === 'archived'
                              const typeInfo = [{ id: 'historia', l: 'HU', c: '#5856D6' }, { id: 'tarea', l: 'T', c: '#007AFF' }, { id: 'bug', l: 'B', c: '#FF3B30' }, { id: 'mejora', l: 'M', c: '#34C759' }].find(t => t.id === (a.type || 'tarea'))
                              return (
                                <div key={a.id} draggable onDragStart={e => { e.dataTransfer.setData('text/plain', a.id); e.dataTransfer.effectAllowed = 'move'; soundSlide() }}
                                  onClick={() => onOpenDetail(a)} className="px-4 py-2 flex items-center gap-2.5 hover:bg-revelio-bg/50 dark:hover:bg-revelio-dark-border/30 cursor-grab active:cursor-grabbing transition-colors">
                                  {typeInfo && <span className="text-[8px] font-bold w-5 h-5 rounded flex items-center justify-center text-white flex-shrink-0" style={{ background: typeInfo.c }}>{typeInfo.l}</span>}
                                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isDone ? 'bg-revelio-green' : a.status === 'blocked' ? 'bg-revelio-red' : 'bg-revelio-blue'}`} />
                                  <span className={`text-xs flex-1 ${isDone ? 'line-through text-revelio-subtle dark:text-revelio-dark-subtle' : 'dark:text-revelio-dark-text'}`}>{a.text}</span>
                                  {a.priority && <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${PRIO_BG[a.priority] || ''} ${PRIO_COLOR[a.priority] || ''}`}>{PRIO_LABEL[a.priority]}</span>}
                                  {a.owner && <span className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle">{a.owner.split(' ')[0]}</span>}
                                  {a.storyPoints ? <span className="text-[8px] font-bold text-revelio-violet bg-revelio-violet/10 px-1 py-0.5 rounded">{String(a.storyPoints)} SP</span> : null}
                                </div>
                              )
                            })}
                          </div>
                        )}
                        {epic.children.length === 0 && <div className="px-4 py-3 text-center text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle">Arrastra items aquí para asignarlos</div>}
                      </div>
                    ))}

                    {noEpic.length > 0 && (
                      <div className="rounded-card border border-dashed border-revelio-border dark:border-revelio-dark-border bg-revelio-bg/30 dark:bg-revelio-dark-border/20 p-4"
                        onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('ring-2', 'ring-revelio-blue/30') }}
                        onDragLeave={e => e.currentTarget.classList.remove('ring-2', 'ring-revelio-blue/30')}
                        onDrop={e => { e.currentTarget.classList.remove('ring-2', 'ring-revelio-blue/30'); const id = e.dataTransfer.getData('text/plain'); if (id) dropOffEpic(id); soundDrop() }}>
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-revelio-subtle dark:text-revelio-dark-subtle">Sin épica</span>
                          <span className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle bg-revelio-bg dark:bg-revelio-dark-border px-1.5 py-0.5 rounded-full">{noEpic.length}</span>
                        </div>
                        <div className="space-y-1">
                          {noEpic.map(a => (
                            <div key={a.id} draggable onDragStart={e => { e.dataTransfer.setData('text/plain', a.id); e.dataTransfer.effectAllowed = 'move'; soundSlide() }}
                              onClick={() => onOpenDetail(a)} className="flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-grab active:cursor-grabbing hover:bg-white dark:hover:bg-revelio-dark-card transition-colors">
                              <div className={`w-1.5 h-1.5 rounded-full ${a.status === 'done' ? 'bg-revelio-green' : 'bg-revelio-subtle'}`} />
                              <span className={`text-[11px] flex-1 ${a.status === 'done' ? 'line-through text-revelio-subtle dark:text-revelio-dark-subtle' : 'dark:text-revelio-dark-text'}`}>{a.text}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
  )
}
