// EquipoTab — Tab "Equipo" del proyecto.
// Muestra el equipo asignado al proyecto con 3 sub-vistas:
//   - team: tarjetas de personas con sus tareas y vacaciones del día
//   - ftes: dedicación a lo largo del tiempo (FTEsPanel)
//   - vac:  calendario de vacaciones (VacationsPanel)
//
// El sub-view es state interno; no se persiste y no se sube a la URL.
// Si en el futuro queremos enlaces compartibles a una sub-vista
// concreta lo elevaremos a query param.
import { useState } from 'react'
import { Users, Calendar as CalendarIcon, Umbrella } from 'lucide-react'
import type { Member } from '@/types'
import { FTEsPanel } from './FTEsPanel'
import { VacationsPanel } from './VacationsPanel'
import { Empty } from './_shared'

// Local types — duplicated from ProjectPage for now. Pending refactor:
// move shared types to src/types/project.ts.
interface Action { id: string; text: string; status: string; owner: string; date: string; priority: string; createdAt: string; [k: string]: unknown }

type EquipoView = 'team' | 'ftes' | 'vac'

interface EquipoTabProps {
  slug: string
  team: Member[]
  actions: Action[]
}

export function EquipoTab({ slug, team, actions }: EquipoTabProps) {
  const [view, setView] = useState<EquipoView>('team')
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle">{team.length} persona{team.length !== 1 ? 's' : ''}</p>
        <div className="flex bg-revelio-bg dark:bg-revelio-dark-border rounded-lg overflow-hidden">
          <button onClick={() => setView('team')} className={`px-2.5 py-1 text-[10px] font-semibold flex items-center gap-1 ${view === 'team' ? 'bg-revelio-blue text-white' : 'text-revelio-subtle dark:text-revelio-dark-subtle'}`}><Users className="w-3 h-3" /> Equipo</button>
          <button onClick={() => setView('ftes')} className={`px-2.5 py-1 text-[10px] font-semibold flex items-center gap-1 ${view === 'ftes' ? 'bg-revelio-blue text-white' : 'text-revelio-subtle dark:text-revelio-dark-subtle'}`}><CalendarIcon className="w-3 h-3" /> FTEs</button>
          <button onClick={() => setView('vac')} className={`px-2.5 py-1 text-[10px] font-semibold flex items-center gap-1 ${view === 'vac' ? 'bg-revelio-blue text-white' : 'text-revelio-subtle dark:text-revelio-dark-subtle'}`}><Umbrella className="w-3 h-3" /> Vac</button>
        </div>
      </div>

      {view === 'team' && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {team.map(m => {
              const myActs = actions.filter(a => a.owner === m.name)
              const myDone = myActs.filter(a => a.status === 'done' || a.status === 'archived').length
              const isOnVac = ((m as Member & { vacations?: unknown[] }).vacations || []).some((v: unknown) => {
                const vr = v as { from?: string; to?: string }
                return vr.from && vr.from <= today && (!vr.to || vr.to >= today)
              })
              return (
                <div key={m.id} className="rounded-lg border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card px-3 py-2.5 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{ background: m.color || '#007AFF' }}>{m.avatar || '👤'}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-revelio-text dark:text-revelio-dark-text truncate">{m.name}</p>
                    <p className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle">{m.role_label || '—'}</p>
                  </div>
                  {isOnVac
                    ? <span className="text-[9px] font-semibold text-revelio-orange bg-revelio-orange/10 px-1.5 py-0.5 rounded">Vac</span>
                    : myActs.length > 0
                      ? <span className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle">{myDone}/{myActs.length}</span>
                      : null}
                </div>
              )
            })}
          </div>
          {team.length === 0 && <Empty message="Nadie asignado." />}
        </>
      )}

      {view === 'ftes' && <FTEsPanel team={team} sala={slug} />}
      {view === 'vac' && <VacationsPanel team={team} />}
    </div>
  )
}
