/** Revelio Gamification — Harry Potter themed */

export interface RetroScore {
  total: number
  tier: Tier
  breakdown: { notes: number; actions: number; risks: number; participation: number; completion: number }
}

export type Tier = 'outstanding' | 'expectoPatronum' | 'lumos' | 'alohomora' | 'nox'
export type House = 'gryffindor' | 'slytherin' | 'ravenclaw' | 'hufflepuff'

export const TIERS: Record<Tier, { label: string; emoji: string; min: number; color: string }> = {
  outstanding:     { label: 'Outstanding',      emoji: '🏆', min: 80, color: '#FFD700' },
  expectoPatronum: { label: 'Expecto Patronum', emoji: '✨', min: 60, color: '#5856D6' },
  lumos:           { label: 'Lumos',            emoji: '💡', min: 40, color: '#007AFF' },
  alohomora:       { label: 'Alohomora',        emoji: '🔑', min: 20, color: '#FF9500' },
  nox:             { label: 'Nox',              emoji: '🌑', min: 0,  color: '#8E8E93' },
}

export const HOUSES: Record<House, { label: string; emoji: string; color: string }> = {
  gryffindor: { label: 'Gryffindor', emoji: '🦁', color: '#C41E3A' },
  slytherin:  { label: 'Slytherin',  emoji: '🐍', color: '#1A472A' },
  ravenclaw:  { label: 'Ravenclaw',  emoji: '🦅', color: '#0E1A40' },
  hufflepuff: { label: 'Hufflepuff', emoji: '🦡', color: '#ECB939' },
}

export const BADGES = [
  { id: 'first_retro',     label: 'Primera retro',     emoji: '⚡', desc: 'Completar tu primera retrospectiva' },
  { id: 'risk_hunter',     label: 'Cazador de riesgos', emoji: '🛡️', desc: 'Identificar 10 riesgos' },
  { id: 'action_hero',     label: 'Héroe de acciones',  emoji: '🗡️', desc: 'Completar 20 items' },
  { id: 'note_master',     label: 'Maestro de notas',   emoji: '📚', desc: 'Crear 50 notas en retros' },
  { id: 'team_player',     label: 'Jugador de equipo',  emoji: '🤝', desc: 'Participar en 5 retros' },
  { id: 'streak_3',        label: 'Racha de 3',         emoji: '🔥', desc: '3 retros consecutivas con score >60' },
  { id: 'perfect_retro',   label: 'Retro perfecta',     emoji: '🏆', desc: 'Score de 100 en una retro' },
  { id: 'early_bird',      label: 'Madrugador',         emoji: '🦉', desc: 'Cerrar todas las acciones antes del deadline' },
  { id: 'patronus',        label: 'Patronus revelado',  emoji: '🦌', desc: 'Alcanzar Outstanding 5 veces' },
  { id: 'hogwarts_grad',   label: 'Graduado Hogwarts',  emoji: '🎓', desc: 'Obtener todos los badges anteriores' },
]

/**
 * Calculate retro quality score (0-100).
 * - Notes: up to 25 points (1pt per note, max 25)
 * - Actions created: up to 20 points (2pt per action, max 20)
 * - Risks identified: up to 15 points (3pt per risk, max 15)
 * - Participation: up to 20 points (4pt per participant, max 20)
 * - Task completion: up to 20 points (% of checked tasks × 20)
 */
export function calculateRetroScore(metrics: {
  notes: number
  actions: number
  risks: number
  participants: number
  tasksChecked: number
  totalTasks: number
}): RetroScore {
  const notes = Math.min(metrics.notes, 25)
  const actions = Math.min(metrics.actions * 2, 20)
  const risks = Math.min(metrics.risks * 3, 15)
  const participation = Math.min(metrics.participants * 4, 20)
  const completion = metrics.totalTasks > 0 ? Math.round((metrics.tasksChecked / metrics.totalTasks) * 20) : 0

  const total = notes + actions + risks + participation + completion

  const tier: Tier = total >= 80 ? 'outstanding' : total >= 60 ? 'expectoPatronum' : total >= 40 ? 'lumos' : total >= 20 ? 'alohomora' : 'nox'

  return { total, tier, breakdown: { notes, actions, risks, participation, completion } }
}

/** Award house points based on retro score */
export function housePoints(score: number): number {
  if (score >= 80) return 50
  if (score >= 60) return 30
  if (score >= 40) return 15
  if (score >= 20) return 5
  return 0
}

/** Check which badges a user has earned */
export function checkBadges(stats: {
  retrosCompleted: number
  risksIdentified: number
  itemsCompleted: number
  notesCreated: number
  consecutiveGoodRetros: number
  hadPerfectRetro: boolean
  outstandingCount: number
  allActionsOnTime: boolean
}): string[] {
  const earned: string[] = []
  if (stats.retrosCompleted >= 1) earned.push('first_retro')
  if (stats.risksIdentified >= 10) earned.push('risk_hunter')
  if (stats.itemsCompleted >= 20) earned.push('action_hero')
  if (stats.notesCreated >= 50) earned.push('note_master')
  if (stats.retrosCompleted >= 5) earned.push('team_player')
  if (stats.consecutiveGoodRetros >= 3) earned.push('streak_3')
  if (stats.hadPerfectRetro) earned.push('perfect_retro')
  if (stats.allActionsOnTime) earned.push('early_bird')
  if (stats.outstandingCount >= 5) earned.push('patronus')
  if (earned.length >= 9) earned.push('hogwarts_grad')
  return earned
}
