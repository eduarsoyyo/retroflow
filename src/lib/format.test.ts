// ═══ TESTS: lib/format — Pure formatters, no mocks needed ═══
// These tests cover the public formatters used across the UI for
// numbers, currency, percentages and hours. The functions are
// presentation-only (input → string) and live in `src/lib/format.ts`.
//
// Conventions verified here:
//   - Spanish locale (thousands `.`, decimals `,`).
//   - Euro suffix is the `€` character with no separator.
//   - All functions are NaN/Infinity-safe (return a sensible default
//     instead of throwing or rendering "NaN").
import { describe, it, expect } from 'vitest'
import {
  formatNumber,
  formatEuro,
  formatNumberCompact,
  formatPercent,
  formatHours,
} from '@/lib/format'

describe('formatNumber', () => {
  it('formats with Spanish locale (dot thousands, comma decimal, 1 decimal)', () => {
    expect(formatNumber(1234.5)).toBe('1.234,5')
  })

  it('rounds to 1 decimal', () => {
    expect(formatNumber(1234.567)).toBe('1.234,6')
  })

  it('handles 0', () => {
    expect(formatNumber(0)).toBe('0,0')
  })

  it('formats millions', () => {
    expect(formatNumber(1234567.89)).toBe('1.234.567,9')
  })

  it('returns 0,0 for NaN', () => {
    expect(formatNumber(NaN)).toBe('0,0')
  })

  it('returns 0,0 for Infinity', () => {
    expect(formatNumber(Infinity)).toBe('0,0')
  })

  it('formats negative numbers', () => {
    expect(formatNumber(-1234.5)).toBe('-1.234,5')
  })
})

describe('formatEuro', () => {
  it('appends € suffix', () => {
    expect(formatEuro(1234)).toMatch(/€$/)
  })

  it('rounds to integer (no decimals)', () => {
    const result = formatEuro(1234.567)
    expect(result).not.toContain(',')
    expect(result).toMatch(/€$/)
  })

  it('contains the right digits for thousands', () => {
    expect(formatEuro(1234).replace(/\D/g, '')).toBe('1234')
  })

  it('formats millions', () => {
    expect(formatEuro(1234567).replace(/\D/g, '')).toBe('1234567')
  })

  it('formats 0', () => {
    expect(formatEuro(0).replace(/\D/g, '')).toBe('0')
    expect(formatEuro(0)).toMatch(/€$/)
  })

  it('returns 0€ for NaN', () => {
    expect(formatEuro(NaN)).toBe('0€')
  })

  it('returns 0€ for Infinity', () => {
    expect(formatEuro(Infinity)).toBe('0€')
  })
})

describe('formatNumberCompact', () => {
  it('does not include € symbol', () => {
    expect(formatNumberCompact(1234)).not.toContain('€')
  })

  it('rounds to integer', () => {
    expect(formatNumberCompact(1234.567).replace(/\D/g, '')).toBe('1235')
  })

  it('contains the right digits', () => {
    expect(formatNumberCompact(1234).replace(/\D/g, '')).toBe('1234')
  })

  it('formats 0', () => {
    expect(formatNumberCompact(0)).toBe('0')
  })

  it('returns 0 for NaN', () => {
    expect(formatNumberCompact(NaN)).toBe('0')
  })

  it('returns 0 for Infinity', () => {
    expect(formatNumberCompact(Infinity)).toBe('0')
  })
})

describe('formatPercent', () => {
  it('appends % suffix with 1 decimal', () => {
    expect(formatPercent(12.345)).toBe('12,3%')
  })

  it('uses comma as decimal separator', () => {
    expect(formatPercent(50)).toBe('50,0%')
  })

  it('handles negative values', () => {
    expect(formatPercent(-3.14)).toBe('-3,1%')
  })

  it('returns 0,0% for NaN', () => {
    expect(formatPercent(NaN)).toBe('0,0%')
  })

  it('returns 0,0% for Infinity', () => {
    expect(formatPercent(Infinity)).toBe('0,0%')
  })
})

describe('formatHours', () => {
  it('appends "h" suffix with 1 decimal', () => {
    expect(formatHours(7.5)).toBe('7,5 h')
  })

  it('handles 0', () => {
    expect(formatHours(0)).toBe('0,0 h')
  })

  it('formats large hours with thousands separator', () => {
    expect(formatHours(1764)).toBe('1.764,0 h')
  })

  it('returns 0,0 h for NaN', () => {
    expect(formatHours(NaN)).toBe('0,0 h')
  })
})
