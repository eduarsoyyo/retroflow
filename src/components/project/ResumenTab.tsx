// ResumenTab — Tab "Resumen" del proyecto.
// Vista general del proyecto: estado, próximas acciones, riesgos abiertos.
// Hoy es un wrapper sobre DashboardPanel.
import { DashboardPanel } from './DashboardPanel'
import type { Member } from '@/types'

// Local types — duplicated from ProjectPage for now. Pending refactor:
// move shared types to src/types/project.ts.
interface Action { id: string; text: string; status: string; owner: string; date: string; priority: string; createdAt: string; [k: string]: unknown }
interface Risk { id: string; text: string; title: string; status: string; prob: string; impact: string; type: string; owner: string; escalation?: { level?: string }; createdAt: string }

export type ProjectTabId = 'resumen' | 'seguimiento' | 'riesgos' | 'equipo' | 'economico' | 'retro'

interface ResumenTabProps {
  actions: Action[]
  risks: Risk[]
  team: Member[]
  onTabChange: (tab: ProjectTabId) => void
}

export function ResumenTab({ actions, risks, team, onTabChange }: ResumenTabProps) {
  const today = new Date().toISOString().slice(0, 10)
  return (
    <DashboardPanel
      actions={actions}
      risks={risks}
      team={team}
      today={today}
      onTabChange={t => onTabChange(t as ProjectTabId)}
    />
  )
}
