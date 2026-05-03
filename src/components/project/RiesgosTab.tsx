// RiesgosTab — Tab "Riesgos" del proyecto.
// Lista de riesgos / problemas / oportunidades del proyecto, con escalado.
// Hoy es un wrapper sobre RisksPanel; cuando se añadan filtros, vista
// heatmap dentro del tab, etc, viven aquí.
import { RisksPanel } from './RisksPanel'

// Domain types: shared shapes from src/types/project.ts.
import type { Action, Risk } from '@/types/project'

// Shape RisksPanel expects internally (keeps the inline type from old code).
type RisksPanelRisk = {
  id: string
  title: string
  text?: string
  description?: string
  type: 'riesgo' | 'problema' | 'oportunidad'
  status: string
  prob?: string
  impact?: string
  owner?: string
  createdAt: string
  escalation?: { level?: string; by?: string; date?: string; reason?: string }
  [k: string]: unknown
}

interface RiesgosTabProps {
  risks: Risk[]
  workItems: Action[]
  currentUser: string
  onUpdate: (next: Risk[]) => void
}

export function RiesgosTab({ risks, workItems, currentUser, onUpdate }: RiesgosTabProps) {
  return (
    <RisksPanel
      risks={risks as unknown as RisksPanelRisk[]}
      onUpdate={next => onUpdate(next as unknown as Risk[])}
      currentUser={currentUser}
      items={workItems.map(a => ({ id: a.id, text: a.text }))}
    />
  )
}
