import { describe, it, expect } from 'vitest'
import { calculateRetroScore, housePoints, checkBadges } from '../gamification'

describe('calculateRetroScore', () => {
  it('scores 0 with no input', () => {
    const r = calculateRetroScore({ notes: 0, actions: 0, risks: 0, participants: 0, tasksChecked: 0, totalTasks: 0 })
    expect(r.total).toBe(0)
    expect(r.tier).toBe('nox')
  })

  it('caps notes at 25', () => {
    const r = calculateRetroScore({ notes: 50, actions: 0, risks: 0, participants: 0, tasksChecked: 0, totalTasks: 0 })
    expect(r.total).toBe(25)
  })

  it('calculates full score correctly', () => {
    const r = calculateRetroScore({ notes: 25, actions: 10, risks: 5, participants: 5, tasksChecked: 10, totalTasks: 10 })
    expect(r.total).toBe(100)
    expect(r.tier).toBe('outstanding')
  })

  it('assigns correct tiers', () => {
    expect(calculateRetroScore({ notes: 20, actions: 5, risks: 3, participants: 4, tasksChecked: 5, totalTasks: 10 }).tier).toBe('expectoPatronum')
    expect(calculateRetroScore({ notes: 10, actions: 3, risks: 2, participants: 2, tasksChecked: 0, totalTasks: 0 }).tier).toBe('alohomora')
  })
})

describe('housePoints', () => {
  it('awards points by score', () => {
    expect(housePoints(90)).toBe(50)
    expect(housePoints(65)).toBe(30)
    expect(housePoints(45)).toBe(15)
    expect(housePoints(25)).toBe(5)
    expect(housePoints(5)).toBe(0)
  })
})

describe('checkBadges', () => {
  it('awards first_retro', () => {
    const badges = checkBadges({ retrosCompleted: 1, risksIdentified: 0, itemsCompleted: 0, notesCreated: 0, consecutiveGoodRetros: 0, hadPerfectRetro: false, outstandingCount: 0, allActionsOnTime: false })
    expect(badges).toContain('first_retro')
  })

  it('awards multiple badges', () => {
    const badges = checkBadges({ retrosCompleted: 5, risksIdentified: 10, itemsCompleted: 20, notesCreated: 50, consecutiveGoodRetros: 3, hadPerfectRetro: true, outstandingCount: 5, allActionsOnTime: true })
    expect(badges).toContain('first_retro')
    expect(badges).toContain('risk_hunter')
    expect(badges).toContain('action_hero')
    expect(badges).toContain('note_master')
    expect(badges).toContain('team_player')
    expect(badges).toContain('streak_3')
    expect(badges).toContain('perfect_retro')
    expect(badges).toContain('patronus')
    expect(badges).toContain('early_bird')
    expect(badges).toContain('hogwarts_grad')
  })
})
