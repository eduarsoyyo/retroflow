// ═══ CLIENTES — Data layer integration tests ═══
// Mocks supabase client. Tests verify the queries we send and how we
// transform the responses, not Supabase itself.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Cliente } from '@/types'

// ── Supabase mock ──────────────────────────────────────────────────────────
type MockResult<T> = { data: T | null; error: { message: string; code?: string } | null }

let nextResult: MockResult<unknown> = { data: [], error: null }
const lastCall: { table?: string; method?: string; payload?: unknown } = {}

function chain() {
  return {
    select: (cols: string) => {
      lastCall.method = `select(${cols})`
      return chain()
    },
    insert: (row: unknown) => {
      lastCall.method = 'insert'
      lastCall.payload = row
      return chain()
    },
    update: (row: unknown) => {
      lastCall.method = 'update'
      lastCall.payload = row
      return chain()
    },
    delete: () => {
      lastCall.method = 'delete'
      return chain()
    },
    eq: (_col: string, _val: unknown) => chain(),
    order: (_col: string) => Promise.resolve(nextResult),
    maybeSingle: () => Promise.resolve(nextResult),
    single: () => Promise.resolve(nextResult),
    then: (resolve: (v: MockResult<unknown>) => void) => resolve(nextResult),
  }
}

vi.mock('@/data/supabase', () => ({
  supabase: {
    from: (table: string) => {
      lastCall.table = table
      lastCall.method = undefined
      lastCall.payload = undefined
      return chain()
    },
  },
}))

import {
  fetchClientes,
  fetchClienteBySlug,
  fetchClienteById,
  createCliente,
  updateCliente,
  deleteCliente,
} from '../clientes'

// ── Fixtures ───────────────────────────────────────────────────────────────
function makeCliente(overrides: Partial<Cliente> = {}): Cliente {
  return {
    id: 'c1',
    slug: 'vwfs',
    name: 'Volkswagen Financial Services',
    logo_url: null,
    contact_name: null,
    contact_email: null,
    notes: null,
    status: 'active',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

beforeEach(() => {
  nextResult = { data: [], error: null }
  lastCall.table = undefined
  lastCall.method = undefined
  lastCall.payload = undefined
})

// ════════════════════════════════════════════════════════════════════════════
// fetchClientes
// ════════════════════════════════════════════════════════════════════════════

describe('fetchClientes', () => {
  it('queries the clientes table ordered by name', async () => {
    nextResult = { data: [makeCliente()], error: null }
    const out = await fetchClientes()
    expect(lastCall.table).toBe('clientes')
    expect(out).toHaveLength(1)
    expect(out[0]?.slug).toBe('vwfs')
  })

  it('returns [] when supabase returns null data', async () => {
    nextResult = { data: null, error: null }
    expect(await fetchClientes()).toEqual([])
  })

  it('throws RevelioError on supabase error', async () => {
    nextResult = { data: null, error: { message: 'boom' } }
    await expect(fetchClientes()).rejects.toThrow('boom')
  })
})

// ════════════════════════════════════════════════════════════════════════════
// fetchClienteBySlug / fetchClienteById
// ════════════════════════════════════════════════════════════════════════════

describe('fetchClienteBySlug', () => {
  it('returns the cliente when found', async () => {
    nextResult = { data: makeCliente({ slug: 'endesa' }), error: null }
    const out = await fetchClienteBySlug('endesa')
    expect(out?.slug).toBe('endesa')
  })

  it('returns null when not found', async () => {
    nextResult = { data: null, error: null }
    expect(await fetchClienteBySlug('missing')).toBeNull()
  })
})

describe('fetchClienteById', () => {
  it('returns the cliente when found', async () => {
    nextResult = { data: makeCliente({ id: 'abc' }), error: null }
    const out = await fetchClienteById('abc')
    expect(out?.id).toBe('abc')
  })

  it('returns null when not found', async () => {
    nextResult = { data: null, error: null }
    expect(await fetchClienteById('missing')).toBeNull()
  })
})

// ════════════════════════════════════════════════════════════════════════════
// createCliente / updateCliente / deleteCliente
// ════════════════════════════════════════════════════════════════════════════

describe('createCliente', () => {
  it('sends the insert payload and returns the created row', async () => {
    const created = makeCliente({ id: 'new-id', slug: 'ada', name: 'ADA' })
    nextResult = { data: created, error: null }

    const out = await createCliente({
      slug: 'ada',
      name: 'ADA',
      logo_url: null,
      contact_name: null,
      contact_email: null,
      notes: null,
      status: 'active',
    })

    expect(lastCall.table).toBe('clientes')
    expect(lastCall.payload).toMatchObject({ slug: 'ada', name: 'ADA' })
    expect(out.id).toBe('new-id')
  })

  it('throws RevelioError on supabase error', async () => {
    nextResult = { data: null, error: { message: 'duplicate slug', code: '23505' } }
    await expect(
      createCliente({ slug: 'vwfs', name: 'dup', logo_url: null, contact_name: null, contact_email: null, notes: null, status: 'active' }),
    ).rejects.toThrow('duplicate slug')
  })
})

describe('updateCliente', () => {
  it('sends the update payload', async () => {
    nextResult = { data: null, error: null }
    await updateCliente('abc', { name: 'Renamed' })
    expect(lastCall.table).toBe('clientes')
    expect(lastCall.method).toBe('update')
    expect(lastCall.payload).toEqual({ name: 'Renamed' })
  })

  it('throws RevelioError on supabase error', async () => {
    nextResult = { data: null, error: { message: 'not found' } }
    await expect(updateCliente('missing', { name: 'x' })).rejects.toThrow('not found')
  })
})

describe('deleteCliente', () => {
  it('sends a delete on clientes', async () => {
    nextResult = { data: null, error: null }
    await deleteCliente('abc')
    expect(lastCall.table).toBe('clientes')
    expect(lastCall.method).toBe('delete')
  })

  it('throws RevelioError on supabase error', async () => {
    nextResult = { data: null, error: { message: 'fk violation', code: '23503' } }
    await expect(deleteCliente('abc')).rejects.toThrow('fk violation')
  })
})