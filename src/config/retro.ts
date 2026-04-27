/**
 * Retro configuration constants.
 * Mirrors v1 config/retro.ts — will be migrated to DB-driven config in Phase 6.
 */

export const RETRO_PHASES = [
  { id: 'p1', name: 'Repaso', icon: 'ClipboardList' },
  { id: 'p2', name: 'Análisis Individual', icon: 'PenTool' },
  { id: 'p3', name: 'Puesta en Común', icon: 'MessageCircle' },
  { id: 'p4', name: 'Accionables', icon: 'CheckSquare' },
  { id: 'p5', name: 'Riesgos', icon: 'AlertTriangle' },
  { id: 'p6', name: 'Dashboard', icon: 'BarChart3' },
] as const

export const NOTE_CATEGORIES = ['good', 'bad', 'start', 'stop'] as const
export type NoteCategory = typeof NOTE_CATEGORIES[number]

export const CATEGORY_LABELS: Record<NoteCategory, string> = {
  good: 'Bien',
  bad: 'Mal',
  start: 'Empezar',
  stop: 'Parar',
}

export const CATEGORY_COLORS: Record<NoteCategory, string> = {
  good: '#34C759',
  bad: '#FF3B30',
  start: '#007AFF',
  stop: '#FF9500',
}

export const HOUSES = ['Gryffindor', 'Slytherin', 'Ravenclaw', 'Hufflepuff'] as const
export type House = typeof HOUSES[number]

export const HOUSE_COLORS: Record<House, string> = {
  Gryffindor: '#AE0001',
  Slytherin: '#1A472A',
  Ravenclaw: '#0E1A40',
  Hufflepuff: '#ECB939',
}
