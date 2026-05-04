// ═══ TEAM SERVICE — Integration tests ═══
// Mocks data/team and data/orgChart. Pure helpers are tested directly.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Member, OrgChartEntry } from '@/types'

// ── Mocks ──────────────────────────────────────────────────────────────────
let mockMembers: Member[] = []
let mockEntries: OrgChartEntry[] = []

vi.mock('@/data/team', () => ({
  fetchTeamMembers: vi.fn(async () => mockMembers),
  updateMember: vi.fn(),
}))

vi.mock('@/data/orgChart', () => ({
  fetchOrgChartBySala: vi.fn(async (_sala: string) => mockEntries),
  fetchOrgChartBySalas: vi.fn(),
}))

import { aggregateOrgChartByMember, dedicationAt, isPeriodActive, loadProjectTeam } from '../team'

// ── Fixtures ───────────────────────────────────────────────────────────────
function makeMember(id: string, name: string): Member {
  return {
    id,
    name,
    username: name.toLowerCase(),
    email: `${name.toLowerCase()}@alten.es`,
    avatar: '👤',
    color: '#007AFF',
    role_label: 'Consultant',
    is_superuser: false,
    rooms: [],
  } as unknown as Member
}

function makeEntry(overrides: Partial<OrgChartEntry>): OrgChartEntry {
  return {
    id: `e-${Math.random().toString(36).slice(2, 8)}`,
    sala: 'vwfs',
    member_id: 'm1',
    manager_id: null,
    dedication: 1,
    start_date: '',
    end_date: '',
    ...overrides,
  }
}

beforeEach(() => {
  mockMembers = []
  mockEntries = []
  vi.clearAllMocks()
})

// ════════════════════════════════════════════════════════════════════════════
// isPeriodActive
// ════════════════════════════════════════════════════════════════════════════

describe('isPeriodActive', () => {
  it('treats empty start/end as open-ended', () => {
    expect(isPeriodActive(makeEntry({ start_date: '', end_date: '' }), '2026-04-30')).toBe(true)
  })

  it('excludes entries whose start is after asOf', () => {
    expect(isPeriodActive(makeEntry({ start_date: '2027-01-01' }), '2026-04-30')).toBe(false)
  })

  it('excludes entries whose end is before asOf', () => {
    expect(isPeriodActive(makeEntry({ end_date: '2025-12-31' }), '2026-04-30')).toBe(false)
  })

  it('includes the boundary days inclusively', () => {
    expect(isPeriodActive(makeEntry({ start_date: '2026-04-30', end_date: '2026-04-30' }), '2026-04-30')).toBe(true)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// aggregateOrgChartByMember
// ════════════════════════════════════════════════════════════════════════════

describe('aggregateOrgChartByMember', () => {
  it('sums dedications of multiple active periods for the same member', () => {
    const entries = [
      makeEntry({ member_id: 'm1', dedication: 0.5, start_date: '2026-01-01', end_date: '2026-06-30' }),
      makeEntry({ member_id: 'm1', dedication: 0.3, start_date: '2026-04-01', end_date: '2026-12-31' }),
    ]
    const out = aggregateOrgChartByMember(entries, '2026-05-15')
    expect(out.get('m1')?.effectiveDedication).toBeCloseTo(0.8)
    expect(out.get('m1')?.activePeriods).toHaveLength(2)
  })

  it('excludes periods that ended before asOf', () => {
    const entries = [
      makeEntry({ member_id: 'm1', dedication: 1, start_date: '2025-01-01', end_date: '2025-12-31' }),
      makeEntry({ member_id: 'm1', dedication: 0.5, start_date: '2026-01-01', end_date: '' }),
    ]
    expect(aggregateOrgChartByMember(entries, '2026-04-30').get('m1')?.effectiveDedication).toBe(0.5)
  })

  it('excludes members whose only period is in the future', () => {
    const entries = [makeEntry({ member_id: 'm1', start_date: '2027-01-01', end_date: '' })]
    expect(aggregateOrgChartByMember(entries, '2026-04-30').get('m1')).toBeUndefined()
  })

  it('uses dedication=1 when undefined', () => {
    const entries = [makeEntry({ member_id: 'm1', dedication: undefined })]
    expect(aggregateOrgChartByMember(entries, '2026-04-30').get('m1')?.effectiveDedication).toBe(1)
  })

  it('clamps negative or NaN dedications to 0', () => {
    const entries = [
      makeEntry({ member_id: 'm1', dedication: -0.5 }),
      makeEntry({ member_id: 'm1', dedication: Number.NaN }),
    ]
    expect(aggregateOrgChartByMember(entries, '2026-04-30').get('m1')?.effectiveDedication).toBe(0)
  })

  it('keeps members separated', () => {
    const entries = [
      makeEntry({ member_id: 'm1', dedication: 0.5 }),
      makeEntry({ member_id: 'm2', dedication: 1 }),
    ]
    const out = aggregateOrgChartByMember(entries, '2026-04-30')
    expect(out.size).toBe(2)
    expect(out.get('m1')?.effectiveDedication).toBe(0.5)
    expect(out.get('m2')?.effectiveDedication).toBe(1)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// loadProjectTeam
// ════════════════════════════════════════════════════════════════════════════

describe('loadProjectTeam', () => {
  it('returns one row per member with aggregated dedication', async () => {
    mockMembers = [makeMember('40', 'Ana'), makeMember('50', 'Bea')]
    mockEntries = [
      makeEntry({ member_id: '40', dedication: 0.5 }),
      makeEntry({ member_id: '40', dedication: 0.3 }),
      makeEntry({ member_id: '50', dedication: 1 }),
    ]

    const out = await loadProjectTeam({ sala: 'vwfs', asOf: '2026-04-30' })

    expect(out).toHaveLength(2)
    expect(out.find((r) => r.member.id === '40')?.effectiveDedication).toBeCloseTo(0.8)
    expect(out.find((r) => r.member.id === '50')?.effectiveDedication).toBe(1)
  })

  it('excludes orphan members (in org_chart but not in team_members)', async () => {
    mockMembers = [makeMember('40', 'Ana')]
    mockEntries = [
      makeEntry({ member_id: '40', dedication: 1 }),
      makeEntry({ member_id: 'orphan', dedication: 1 }),
    ]

    const out = await loadProjectTeam({ sala: 'vwfs' })

    expect(out).toHaveLength(1)
    expect(out[0]?.member.id).toBe('40')
  })

  it('returns an empty array when no team is assigned', async () => {
    mockMembers = [makeMember('40', 'Ana')]
    mockEntries = []

    const out = await loadProjectTeam({ sala: 'vwfs' })

    expect(out).toEqual([])
  })

  it('parallelizes the two loads (members + orgChart)', async () => {
    mockMembers = [makeMember('40', 'Ana')]
    mockEntries = [makeEntry({ member_id: '40' })]

    await loadProjectTeam({ sala: 'vwfs' })

    const teamMod = await import('@/data/team')
    const orgMod = await import('@/data/orgChart')
    expect(teamMod.fetchTeamMembers).toHaveBeenCalledTimes(1)
    expect(orgMod.fetchOrgChartBySala).toHaveBeenCalledTimes(1)
    expect(orgMod.fetchOrgChartBySala).toHaveBeenCalledWith('vwfs')
  })
})
// ════════════════════════════════════════════════════════════════════════════
// dedicationAt
// ════════════════════════════════════════════════════════════════════════════

describe('dedicationAt', () => {
  it('returns 0 when the member has no entries', () => {
    const entries = [makeEntry({ member_id: 'other', dedication: 1 })]
    expect(dedicationAt(entries, 'm1', '2026-04-30')).toBe(0)
  })

  it('returns 0 when no entry of the member is active at the date', () => {
    const entries = [
      makeEntry({ member_id: 'm1', dedication: 1, start_date: '2025-01-01', end_date: '2025-12-31' }),
      makeEntry({ member_id: 'm1', dedication: 0.5, start_date: '2027-01-01', end_date: '' }),
    ]
    expect(dedicationAt(entries, 'm1', '2026-04-30')).toBe(0)
  })

  it('returns the dedication of the only active period', () => {
    const entries = [makeEntry({ member_id: 'm1', dedication: 0.5, start_date: '', end_date: '' })]
    expect(dedicationAt(entries, 'm1', '2026-04-30')).toBe(0.5)
  })

  it('sums dedications when multiple periods overlap at the date', () => {
    const entries = [
      makeEntry({ member_id: 'm1', dedication: 0.5, start_date: '2026-01-01', end_date: '2026-06-30' }),
      makeEntry({ member_id: 'm1', dedication: 0.3, start_date: '2026-04-01', end_date: '2026-12-31' }),
    ]
    expect(dedicationAt(entries, 'm1', '2026-05-15')).toBeCloseTo(0.8)
  })

  it('ignores entries belonging to other members', () => {
    const entries = [
      makeEntry({ member_id: 'm1', dedication: 0.5 }),
      makeEntry({ member_id: 'm2', dedication: 1 }),
    ]
    expect(dedicationAt(entries, 'm1', '2026-04-30')).toBe(0.5)
  })

  it('clamps negative or NaN dedications to 0', () => {
    const entries = [
      makeEntry({ member_id: 'm1', dedication: -0.5 }),
      makeEntry({ member_id: 'm1', dedication: Number.NaN }),
      makeEntry({ member_id: 'm1', dedication: 0.4 }),
    ]
    expect(dedicationAt(entries, 'm1', '2026-04-30')).toBe(0.4)
  })

  it('treats undefined dedication as 1', () => {
    const entries = [makeEntry({ member_id: 'm1', dedication: undefined })]
    expect(dedicationAt(entries, 'm1', '2026-04-30')).toBe(1)
  })

  it('respects period boundaries inclusively', () => {
    const entries = [makeEntry({ member_id: 'm1', dedication: 0.6, start_date: '2026-04-30', end_date: '2026-04-30' })]
    expect(dedicationAt(entries, 'm1', '2026-04-30')).toBe(0.6)
    expect(dedicationAt(entries, 'm1', '2026-04-29')).toBe(0)
    expect(dedicationAt(entries, 'm1', '2026-05-01')).toBe(0)
  })
})

