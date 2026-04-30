import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Member, OrgChartEntry } from '@/types'

vi.mock('@/data/team', () => ({
  fetchTeamMembers: vi.fn(),
  handleSupabaseError: vi.fn(),
}))

vi.mock('@/data/orgChart', () => ({
  fetchOrgChartBySala: vi.fn(),
}))

import { fetchTeamMembers } from '@/data/team'
import { fetchOrgChartBySala } from '@/data/orgChart'
import { aggregateOrgChartByMember, isPeriodActive, loadProjectTeam } from '../finance'

const fetchTeamMembersMock = vi.mocked(fetchTeamMembers)
const fetchOrgChartMock = vi.mocked(fetchOrgChartBySala)

function makeMember(id: string, name: string): Member {
  return {
    id,
    name,
    username: name.toLowerCase(),
    email: `${name.toLowerCase()}@x.es`,
    avatar: '',
    color: '#000',
    role_label: '',
    is_superuser: false,
    rooms: [],
  } as unknown as Member
}

function makeEntry(overrides: Partial<OrgChartEntry>): OrgChartEntry {
  return {
    sala: 'vwfs',
    member_id: 'm1',
    dedication: 1,
    start_date: '',
    end_date: '',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ----------------------------------------------------------------------------
// isPeriodActive
// ----------------------------------------------------------------------------

describe('isPeriodActive', () => {
  it('debería tratar start/end vacios como periodo abierto', () => {
    expect(isPeriodActive(makeEntry({ start_date: '', end_date: '' }), '2026-04-30')).toBe(true)
  })

  it('debería excluir periodos cuyo start es posterior a asOf', () => {
    expect(isPeriodActive(makeEntry({ start_date: '2027-01-01' }), '2026-04-30')).toBe(false)
  })

  it('debería excluir periodos cuyo end es anterior a asOf', () => {
    expect(isPeriodActive(makeEntry({ end_date: '2025-12-31' }), '2026-04-30')).toBe(false)
  })

  it('debería incluir asOf en el limite (inclusive en ambos extremos)', () => {
    expect(isPeriodActive(makeEntry({ start_date: '2026-04-30', end_date: '2026-04-30' }), '2026-04-30')).toBe(true)
  })
})

// ----------------------------------------------------------------------------
// aggregateOrgChartByMember
// ----------------------------------------------------------------------------

describe('aggregateOrgChartByMember', () => {
  it('debería sumar dedications de varios periodos activos del mismo miembro', () => {
    const entries: OrgChartEntry[] = [
      makeEntry({ member_id: 'm1', dedication: 0.5, start_date: '2026-01-01', end_date: '2026-06-30' }),
      makeEntry({ member_id: 'm1', dedication: 0.3, start_date: '2026-04-01', end_date: '2026-12-31' }),
    ]
    const out = aggregateOrgChartByMember(entries, '2026-05-15')
    expect(out.get('m1')?.effectiveDedication).toBeCloseTo(0.8)
    expect(out.get('m1')?.activePeriods).toHaveLength(2)
  })

  it('debería excluir periodos pasados', () => {
    const entries: OrgChartEntry[] = [
      makeEntry({ member_id: 'm1', dedication: 1, start_date: '2025-01-01', end_date: '2025-12-31' }),
      makeEntry({ member_id: 'm1', dedication: 0.5, start_date: '2026-01-01', end_date: '' }),
    ]
    const out = aggregateOrgChartByMember(entries, '2026-04-30')
    expect(out.get('m1')?.effectiveDedication).toBe(0.5)
  })

  it('debería excluir miembros cuyo unico periodo es futuro', () => {
    const entries: OrgChartEntry[] = [
      makeEntry({ member_id: 'm1', dedication: 1, start_date: '2027-01-01', end_date: '' }),
    ]
    expect(aggregateOrgChartByMember(entries, '2026-04-30').get('m1')).toBeUndefined()
  })

  it('debería usar dedication=1 si viene undefined', () => {
    const entries: OrgChartEntry[] = [makeEntry({ member_id: 'm1', dedication: undefined })]
    expect(aggregateOrgChartByMember(entries, '2026-04-30').get('m1')?.effectiveDedication).toBe(1)
  })

  it('debería tratar dedications negativas o NaN como 0', () => {
    const entries: OrgChartEntry[] = [
      makeEntry({ member_id: 'm1', dedication: -0.5 }),
      makeEntry({ member_id: 'm1', dedication: Number.NaN }),
    ]
    expect(aggregateOrgChartByMember(entries, '2026-04-30').get('m1')?.effectiveDedication).toBe(0)
  })

  it('debería separar entradas de miembros distintos', () => {
    const entries: OrgChartEntry[] = [
      makeEntry({ member_id: 'm1', dedication: 0.5 }),
      makeEntry({ member_id: 'm2', dedication: 1 }),
    ]
    const out = aggregateOrgChartByMember(entries, '2026-04-30')
    expect(out.size).toBe(2)
    expect(out.get('m1')?.effectiveDedication).toBe(0.5)
    expect(out.get('m2')?.effectiveDedication).toBe(1)
  })
})

// ----------------------------------------------------------------------------
// loadProjectTeam — orquestacion
// ----------------------------------------------------------------------------

describe('loadProjectTeam', () => {
  it('debería devolver una fila por miembro presente en team_members con dedicacion agregada', async () => {
    fetchTeamMembersMock.mockResolvedValue([makeMember('40', 'Ana'), makeMember('50', 'Bea')])
    fetchOrgChartMock.mockResolvedValue([
      makeEntry({ member_id: '40', dedication: 0.5 }),
      makeEntry({ member_id: '40', dedication: 0.3 }),
      makeEntry({ member_id: '50', dedication: 1 }),
    ])

    const out = await loadProjectTeam({ sala: 'vwfs', asOf: '2026-04-30' })

    expect(out).toHaveLength(2)
    const ana = out.find((r) => r.member.id === '40')
    const bea = out.find((r) => r.member.id === '50')
    expect(ana?.effectiveDedication).toBeCloseTo(0.8)
    expect(bea?.effectiveDedication).toBe(1)
  })

  it('debería excluir miembros huerfanos (en org_chart pero no en team_members)', async () => {
    fetchTeamMembersMock.mockResolvedValue([makeMember('40', 'Ana')])
    fetchOrgChartMock.mockResolvedValue([
      makeEntry({ member_id: '40', dedication: 1 }),
      makeEntry({ member_id: 'huerfano', dedication: 1 }),
    ])

    const out = await loadProjectTeam({ sala: 'vwfs' })

    expect(out).toHaveLength(1)
    expect(out[0]?.member.id).toBe('40')
  })

  it('debería devolver array vacio si no hay equipo asignado', async () => {
    fetchTeamMembersMock.mockResolvedValue([makeMember('40', 'Ana')])
    fetchOrgChartMock.mockResolvedValue([])

    const out = await loadProjectTeam({ sala: 'vwfs' })

    expect(out).toEqual([])
  })

  it('debería paralelizar las dos cargas (members + orgChart)', async () => {
    fetchTeamMembersMock.mockResolvedValue([makeMember('40', 'Ana')])
    fetchOrgChartMock.mockResolvedValue([makeEntry({ member_id: '40' })])

    await loadProjectTeam({ sala: 'vwfs' })

    expect(fetchTeamMembersMock).toHaveBeenCalledTimes(1)
    expect(fetchOrgChartMock).toHaveBeenCalledTimes(1)
    // Ambos disparados con la misma sala
    expect(fetchOrgChartMock).toHaveBeenCalledWith('vwfs')
  })
})
