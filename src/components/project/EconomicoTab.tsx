// EconomicoTab — Tab "Económico" del proyecto.
// Vista financiera (P&L, márgenes, presupuesto vs real). Visible solo
// para usuarios con permisos de service manager / superuser; el filtro de
// permiso lo aplica ProjectPage al construir la lista de tabs visibles.
//
// Hoy es un wrapper fino sobre FinancePanel. Cuando se añadan toggles,
// filtros o sub-secciones (P&L, costes, facturación), viven aquí.
import { FinancePanel } from './FinancePanel'
import type { Member, Room } from '@/types'

interface RoomFinanceData {
  billing_type: string
  budget: number
  sell_rate: number
  fixed_price: number
  planned_hours: number
  services: Array<{ id: string; name: string; from: string; to: string; cost: number; margin_pct: number; risk_pct: number }>
}

function buildRoomFinanceData(room: Room | null): RoomFinanceData | undefined {
  if (!room) return undefined
  const r = room as unknown as Record<string, unknown>
  return {
    billing_type: (r.billing_type as string) || 'fixed',
    budget: Number(r.budget) || 0,
    sell_rate: Number(r.sell_rate) || 0,
    fixed_price: Number(r.fixed_price) || 0,
    planned_hours: Number(r.planned_hours) || 0,
    services: (r.services as RoomFinanceData['services']) || [],
  }
}

interface EconomicoTabProps {
  slug: string
  team: Member[]
  room: Room | null
}

export function EconomicoTab({ slug, team, room }: EconomicoTabProps) {
  return (
    <FinancePanel
      team={team}
      sala={slug}
      roomData={buildRoomFinanceData(room)}
    />
  )
}
