import { describe, it, expect } from 'vitest'
import { analyzeProject, analyzeCapacity, computeProjectKPIs } from '../intelligence'

describe('analyzeProject', () => {
  const today = '2026-04-25'

  it('returns empty for clean project', () => {
    const alerts = analyzeProject('test', [
      { id: '1', text: 'Task', status: 'doing', date: '2026-05-01' }
    ], [], today)
    expect(alerts.length).toBe(0)
  })

  it('detects overdue items', () => {
    const alerts = analyzeProject('test', [
      { id: '1', text: 'Late task', status: 'todo', date: '2026-04-20' }
    ], [], today)
    expect(alerts.some(a => a.type === 'overdue')).toBe(true)
  })

  it('detects blocked items', () => {
    const alerts = analyzeProject('test', [
      { id: '1', text: 'Blocked', status: 'blocked' }
    ], [], today)
    expect(alerts.some(a => a.type === 'blocked')).toBe(true)
  })

  it('detects single point of failure', () => {
    const items = Array.from({ length: 5 }, (_, i) => ({ id: `${i}`, text: `T${i}`, status: 'doing', owner: 'Juan' }))
    const alerts = analyzeProject('test', items, [], today)
    expect(alerts.some(a => a.type === 'single_point')).toBe(true)
  })

  it('detects milestone at risk', () => {
    const alerts = analyzeProject('test', [
      { id: '1', text: 'Release', status: 'todo', date: '2026-04-27', type: 'hito' }
    ], [], today)
    expect(alerts.some(a => a.type === 'milestone_risk')).toBe(true)
  })

  it('detects escalated risks', () => {
    const alerts = analyzeProject('test', [], [
      { id: 'r1', title: 'Risk', status: 'abierto', prob: 'alta', impact: 'alto', escalation: { level: 'pm' } }
    ], today)
    expect(alerts.some(a => a.severity === 'critical')).toBe(true)
  })
})

describe('analyzeCapacity', () => {
  it('detects overload', () => {
    const alerts = analyzeCapacity(
      [{ id: '1', name: 'Ana' }],
      [{ member_id: '1', sala: 'a', dedication: 0.8 }, { member_id: '1', sala: 'b', dedication: 0.5 }],
      [], '2026-04-25'
    )
    expect(alerts.some(a => a.type === 'overload')).toBe(true)
  })
})

describe('computeProjectKPIs', () => {
  it('computes health correctly', () => {
    const kpi = computeProjectKPIs('test', 'Test', [
      { id: '1', text: 'Done', status: 'done' },
      { id: '2', text: 'Late', status: 'todo', date: '2026-04-20' },
    ], [], '2026-04-25')
    expect(kpi.pctDone).toBe(50)
    expect(kpi.overdue).toBe(1)
    expect(kpi.health).toBeLessThan(100)
  })
})
