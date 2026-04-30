// ═══ FINANCE SERVICE — Integration tests ═══
// We mock the data layer (data/*) and let domain/finance run for real,
// because domain is pure logic — mocking it would test mocks, not behavior.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Member, Room, Calendario, ServiceContractEntry } from '@/types'
import type { TimeEntry } from '@/data/time-entries'

// ── Mocks ────────────────────────────────────────────────────────────────────
let mockRooms: Room[] = []
let mockMembers: Member[] = []
let mockEntries: TimeEntry[] = []
let mockCalendars: Record<string, Calendario> = {}

vi.mock('@/data/team', () => ({
  fetchTeamMembers: vi.fn(async (sala?: string) => {
    if (!sala) return mockMembers
    return mockMembers.filter((m) => (m.rooms ?? []).includes(sala))
  }),
  updateMember: vi.fn(),
}))

vi.mock('@/data/rooms', () => ({
  fetchRooms: vi.fn(async () => mockRooms),
  createRoom: vi.fn(),
  deleteRoom: vi.fn(),
}))

vi.mock('@/data/time-entries', async () => {
  const actual = await vi.importActual<typeof import('@/data/time-entries')>('@/data/time-entries')
  return {
    ...actual,
    fetchTimeEntries: vi.fn(async (filter: { sala?: string; memberId?: string; year?: number } = {}) => {
      return mockEntries.filter((e) => {
        if (filter.sala && e.sala !== filter.sala) return false
        if (filter.memberId && e.member_id !== filter.memberId) return false
        if (filter.year !== undefined) {
          const y = String(filter.year)
          if (!e.date.startsWith(y)) return false
        }
        return true
      })
    }),
  }
})

vi.mock('@/data/calendarios', () => ({
  fetchCalendarios: vi.fn(async () => Object.values(mockCalendars)),
  fetchCalendariosIndexed: vi.fn(async () => mockCalendars),
  indexCalendarios: vi.fn(),
}))

// ── Fixtures ─────────────────────────────────────────────────────────────────
const stdCalendar: Calendario = {
  id: 'cal-std',
  name: 'Convenio TIC 2026',
  year: 2026,
  region: 'ES-AN',
  daily_hours_lj: 8,
  daily_hours_v: 7,
  daily_hours_intensive: 7,
intensive_start: '07-01',
  intensive_end: '08-31',
  convenio_hours: 1800,
  holidays: [
    { date: '2026-01-01', name: 'Año Nuevo' },
    { date: '2026-01-06', name: 'Reyes' },
    { date: '2026-12-25', name: 'Navidad' },
  ],
}

function makeMember(id: string, name: string, rooms: string[], salary = 36000): Member {
  return {
    id,
    name,
    username: name.toLowerCase(),
    email: `${name.toLowerCase()}@alten.es`,
    avatar: '👤',
    color: '#007AFF',
    role_label: 'Consultant',
    company: 'ALTEN',
    phone: '',
    rooms,
    is_superuser: false,
    house: null,
    dedication: 1,
    start_date: null,
    end_date: null,
    calendario_id: 'cal-std',
    convenio_id: null,
    vacations: [],
    annual_vac_days: 23,
    prev_year_pending: 0,
    created_at: '2026-01-01T00:00:00Z',
    cost_rates: [{ from: '2026-01', salary, multiplier: 1.33 }],
    cost_rate: 25,
  }
}

function makeRoom(slug: string, name: string, overrides: Partial<Room> = {}): Room {
  return {
    slug,
    name,
    tipo: 'agile',
    metadata: {},
    services: [],
    member_assigns: [],
    ...overrides,
  }
}

function makeService(
  id: string,
  cost: number,
  marginPct: number,
  from = '2026-01-01',
  to = '2026-12-31',
): ServiceContractEntry {
  return { id, name: `svc-${id}`, from, to, cost, margin_pct: marginPct, risk_pct: 0 }
}

function makeEntry(id: string, member_id: string, sala: string, date: string, hours: number): TimeEntry {
  return { id, member_id, sala, date, hours, status: 'aprobado' }
}

// ── Setup ────────────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks()
  mockCalendars = { 'cal-std': stdCalendar }
  mockMembers = []
  mockRooms = []
  mockEntries = []
})

// ═════════════════════════════════════════════════════════════════════════════
// loadProjectFinance
// ═════════════════════════════════════════════════════════════════════════════

describe('loadProjectFinance — actual mode', () => {
  it('throws if project does not exist', async () => {
    const { loadProjectFinance } = await import('@/services/finance')
    await expect(loadProjectFinance('ghost', 2026)).rejects.toThrow(/not found/i)
  })

  it('returns zeros when project has no services and no entries', async () => {
    mockRooms = [makeRoom('empty', 'Empty')]
    const { loadProjectFinance } = await import('@/services/finance')
    const r = await loadProjectFinance('empty', 2026)
    expect(r.totalRevenue).toBe(0)
    expect(r.totalCost).toBe(0)
    expect(r.margin).toBe(0)
    expect(r.marginPct).toBe(0)
    expect(r.months).toHaveLength(12)
    expect(r.members).toEqual([])
  })

  it('computes revenue from a 12-month service prorated equally', async () => {
    mockRooms = [makeRoom('vwfs', 'VWFS', { services: [makeService('s1', 60_000, 25)] })]
    const { loadProjectFinance } = await import('@/services/finance')
    const r = await loadProjectFinance('vwfs', 2026)
    // sale = 60_000 / (1 - 0.25) = 80_000 → ~6_667/month
    expect(r.totalRevenue).toBeGreaterThan(79_900)
    expect(r.totalRevenue).toBeLessThan(80_100)
    r.months.forEach((m) => expect(m.revenue).toBeGreaterThan(0))
  })

  it('aggregates revenue from multiple services with overlapping periods', async () => {
    // Service A: jan-jun, 30k cost, 25% margin → sale 40k over 6 months ≈ 6_667/month jan-jun
    // Service B: apr-dec, 60k cost, 30% margin → sale ~85_714 over 9 months ≈ 9_524/month apr-dec
    mockRooms = [
      makeRoom('vwfs', 'VWFS', {
        services: [
          makeService('a', 30_000, 25, '2026-01-01', '2026-06-30'),
          makeService('b', 60_000, 30, '2026-04-01', '2026-12-31'),
        ],
      }),
    ]
    const { loadProjectFinance } = await import('@/services/finance')
    const r = await loadProjectFinance('vwfs', 2026)

    // Jan, Feb, Mar: only A
    expect(r.months[0]!.revenue).toBeGreaterThan(6_500)
    expect(r.months[0]!.revenue).toBeLessThan(6_800)
    // Apr, May, Jun: A + B
    expect(r.months[3]!.revenue).toBeGreaterThan(15_000)
    // Jul-Dec: only B
    expect(r.months[6]!.revenue).toBeGreaterThan(9_400)
    expect(r.months[6]!.revenue).toBeLessThan(9_700)
    // Total ≈ 40k + 85.7k
    expect(r.totalRevenue).toBeGreaterThan(120_000)
    expect(r.totalRevenue).toBeLessThan(130_000)
  })

  it('costs each time entry at the cost/hour vigente at its date', async () => {
    const m = makeMember('u1', 'Eva', ['vwfs'], 30_000)
    m.cost_rates = [
      { from: '2026-01', to: '2026-06', salary: 30_000, multiplier: 1.33 },
      { from: '2026-07', salary: 36_000, multiplier: 1.33 },
    ]
    mockMembers = [m]
    mockRooms = [makeRoom('vwfs', 'VWFS')]
    mockEntries = [
      makeEntry('e1', 'u1', 'vwfs', '2026-03-15', 8), // pre-bump
      makeEntry('e2', 'u1', 'vwfs', '2026-09-15', 8), // post-bump
    ]
    const { loadProjectFinance } = await import('@/services/finance')
    const r = await loadProjectFinance('vwfs', 2026, 'actual')

    // pre: 30000*1.33/1800 ≈ 22.17 €/h → 8h ≈ 177€
    // post: 36000*1.33/1800 ≈ 26.6 €/h → 8h ≈ 213€
    // total ≈ 390€
    expect(r.totalCost).toBeGreaterThan(380)
    expect(r.totalCost).toBeLessThan(400)
    expect(r.members).toHaveLength(1)
    expect(r.members[0]!.hours).toBe(16)
  })

  it('skips members with no entries in actual mode', async () => {
    mockMembers = [makeMember('u1', 'Eva', ['vwfs']), makeMember('u2', 'Tom', ['vwfs'])]
    mockRooms = [makeRoom('vwfs', 'VWFS')]
    mockEntries = [makeEntry('e1', 'u1', 'vwfs', '2026-03-15', 8)]
    const { loadProjectFinance } = await import('@/services/finance')
    const r = await loadProjectFinance('vwfs', 2026)
    expect(r.members).toHaveLength(1)
    expect(r.members[0]!.memberId).toBe('u1')
  })

  it('does not load time_entries in theoretical mode', async () => {
    mockMembers = [makeMember('u1', 'Eva', ['vwfs'])]
    mockRooms = [
      makeRoom('vwfs', 'VWFS', {
        member_assigns: [{ member_id: 'u1', dedication: 1, from: '2026-01-01', to: '2026-12-31' }],
      }),
    ]
    const { loadProjectFinance } = await import('@/services/finance')
    const dataModule = await import('@/data/time-entries')
    const r = await loadProjectFinance('vwfs', 2026, 'theoretical')
    expect(dataModule.fetchTimeEntries).not.toHaveBeenCalled()
    expect(r.totalCost).toBeGreaterThan(0)
  })

  it('theoretical mode: cost ≈ effective_hours × dedication × cost_hour', async () => {
    const m = makeMember('u1', 'Eva', ['vwfs'], 36_000)
    mockMembers = [m]
    mockRooms = [
      makeRoom('vwfs', 'VWFS', {
        member_assigns: [{ member_id: 'u1', dedication: 0.5, from: '2026-01-01', to: '2026-12-31' }],
      }),
    ]
    const { loadProjectFinance } = await import('@/services/finance')
    const r = await loadProjectFinance('vwfs', 2026, 'theoretical')
    expect(r.totalCost).toBeGreaterThan(15_000)
    expect(r.totalCost).toBeLessThan(35_000)
    const monthsWithCost = r.months.filter((mm) => mm.cost > 0).length
    expect(monthsWithCost).toBe(12)
  })

  it('aggregates margin and pct correctly', async () => {
    mockRooms = [makeRoom('vwfs', 'VWFS', { services: [makeService('s1', 75_000, 25)] })]
    mockMembers = [makeMember('u1', 'Eva', ['vwfs'])]
    mockEntries = [makeEntry('e1', 'u1', 'vwfs', '2026-06-15', 100)]
    const { loadProjectFinance } = await import('@/services/finance')
    const r = await loadProjectFinance('vwfs', 2026)
    expect(r.margin).toBe(r.totalRevenue - r.totalCost)
    if (r.totalRevenue > 0) {
      expect(r.marginPct).toBe(Math.round((r.margin / r.totalRevenue) * 100))
    }
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// loadProjectForecast
// ═════════════════════════════════════════════════════════════════════════════

describe('loadProjectForecast', () => {
  it('returns contracted figures alongside the theoretical P&L', async () => {
    mockRooms = [makeRoom('vwfs', 'VWFS', { services: [makeService('s1', 60_000, 25)] })]
    mockMembers = []
    const { loadProjectForecast } = await import('@/services/finance')
    const r = await loadProjectForecast('vwfs', 2026)
    expect(r.contractedRevenue).toBe(80_000)
    expect(r.contractedCost).toBe(60_000)
    expect(r.contractedMarginPct).toBe(25)
    expect(r.mode).toBe('theoretical')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// loadMemberCostSummary
// ═════════════════════════════════════════════════════════════════════════════

describe('loadMemberCostSummary', () => {
  it('throws when member does not exist', async () => {
    const { loadMemberCostSummary } = await import('@/services/finance')
    await expect(loadMemberCostSummary('ghost', 2026)).rejects.toThrow(/not found/i)
  })

  it('breaks down cost by project', async () => {
    mockMembers = [makeMember('u1', 'Eva', ['vwfs', 'endesa'], 36_000)]
    mockEntries = [
      makeEntry('e1', 'u1', 'vwfs', '2026-03-01', 100),
      makeEntry('e2', 'u1', 'endesa', '2026-04-01', 50),
    ]
    const { loadMemberCostSummary } = await import('@/services/finance')
    const r = await loadMemberCostSummary('u1', 2026)
    expect(r.totalHoursLogged).toBe(150)
    expect(r.byProject).toHaveLength(2)
    expect(r.byProject[0]!.sala).toBe('vwfs')
    expect(r.byProject[0]!.hours).toBe(100)
    expect(r.totalCost).toBeGreaterThan(0)
  })

  it('uses date-aware cost rates for total cost', async () => {
    const m = makeMember('u1', 'Eva', ['vwfs'])
    m.cost_rates = [
      { from: '2026-01', to: '2026-06', salary: 30_000, multiplier: 1.33 },
      { from: '2026-07', salary: 50_000, multiplier: 1.33 },
    ]
    mockMembers = [m]
    mockEntries = [
      makeEntry('e1', 'u1', 'vwfs', '2026-02-01', 10),
      makeEntry('e2', 'u1', 'vwfs', '2026-08-01', 10),
    ]
    const { loadMemberCostSummary } = await import('@/services/finance')
    const r = await loadMemberCostSummary('u1', 2026)
    expect(r.totalCost).toBeGreaterThan(580)
    expect(r.totalCost).toBeLessThan(600)
  })

  it('reports effective theoretical hours from calendar', async () => {
    mockMembers = [makeMember('u1', 'Eva', ['vwfs'])]
    const { loadMemberCostSummary } = await import('@/services/finance')
    const r = await loadMemberCostSummary('u1', 2026)
    expect(r.effectiveTheoreticalHours).toBeGreaterThan(1700)
    expect(r.effectiveTheoreticalHours).toBeLessThan(2100)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// loadAllProjectsPnL
// ═════════════════════════════════════════════════════════════════════════════

describe('loadAllProjectsPnL', () => {
  it('skips archived & cancelled projects', async () => {
    mockRooms = [
      makeRoom('live', 'Live', { status: 'active' }),
      makeRoom('old', 'Old', { status: 'archived' }),
      makeRoom('dead', 'Dead', { status: 'cancelled' }),
    ]
    const { loadAllProjectsPnL } = await import('@/services/finance')
    const r = await loadAllProjectsPnL(2026)
    expect(r.projects).toHaveLength(1)
    expect(r.projects[0]!.slug).toBe('live')
  })

  it('aggregates revenue across all projects, sorted by revenue desc', async () => {
    mockRooms = [
      makeRoom('big', 'Big', { services: [makeService('s1', 200_000, 25)] }),
      makeRoom('small', 'Small', { services: [makeService('s2', 30_000, 25)] }),
    ]
    const { loadAllProjectsPnL } = await import('@/services/finance')
    const r = await loadAllProjectsPnL(2026)
    expect(r.projects).toHaveLength(2)
    expect(r.projects[0]!.slug).toBe('big')
    expect(r.totalRevenue).toBeGreaterThan(0)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// loadMemberHours
// ═════════════════════════════════════════════════════════════════════════════

describe('loadMemberHours', () => {
  it('reports balance = logged - theoretical', async () => {
    mockMembers = [makeMember('u1', 'Eva', ['vwfs'])]
    mockEntries = [
      makeEntry('e1', 'u1', 'vwfs', '2026-01-15', 8),
      makeEntry('e2', 'u1', 'vwfs', '2026-02-15', 8),
    ]
    const { loadMemberHours } = await import('@/services/finance')
    const r = await loadMemberHours('u1', 2026)
    expect(r.loggedHours).toBe(16)
    expect(r.theoreticalHours).toBeGreaterThan(0)
    expect(r.balance).toBe(r.loggedHours - r.theoreticalHours)
  })

  it('groups logged hours by month', async () => {
    mockMembers = [makeMember('u1', 'Eva', ['vwfs'])]
    mockEntries = [
      makeEntry('e1', 'u1', 'vwfs', '2026-01-15', 8),
      makeEntry('e2', 'u1', 'vwfs', '2026-01-16', 8),
      makeEntry('e3', 'u1', 'vwfs', '2026-03-01', 4),
    ]
    const { loadMemberHours } = await import('@/services/finance')
    const r = await loadMemberHours('u1', 2026)
    expect(r.byMonth['2026-01']).toBe(16)
    expect(r.byMonth['2026-03']).toBe(4)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// loadProjectMembers
// ═════════════════════════════════════════════════════════════════════════════

describe('loadProjectMembers', () => {
  it('returns members with dedication and hours, sorted by dedication desc', async () => {
    mockMembers = [makeMember('u1', 'Eva', ['vwfs']), makeMember('u2', 'Tom', ['vwfs'])]
    mockRooms = [
      makeRoom('vwfs', 'VWFS', {
        member_assigns: [
          { member_id: 'u1', dedication: 0.5, from: '2026-01-01', to: '2026-12-31' },
          { member_id: 'u2', dedication: 1, from: '2026-01-01', to: '2026-12-31' },
        ],
      }),
    ]
    mockEntries = [makeEntry('e1', 'u1', 'vwfs', '2026-03-01', 40)]
    const { loadProjectMembers } = await import('@/services/finance')
    const r = await loadProjectMembers('vwfs', 2026)
    expect(r).toHaveLength(2)
    expect(r[0]!.memberId).toBe('u2')
    expect(r[1]!.hoursLogged).toBe(40)
  })

  it('throws when project does not exist', async () => {
    const { loadProjectMembers } = await import('@/services/finance')
    await expect(loadProjectMembers('ghost', 2026)).rejects.toThrow(/not found/i)
  })
})
