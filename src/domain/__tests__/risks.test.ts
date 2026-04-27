import { describe, it, expect, beforeEach } from 'vitest'
import { riskNumber, resetRiskNumbers } from '../risks'

describe('riskNumber', () => {
  beforeEach(() => resetRiskNumbers())

  it('assigns sequential numbers starting at 1', () => {
    expect(riskNumber('a')).toBe(1)
    expect(riskNumber('b')).toBe(2)
    expect(riskNumber('c')).toBe(3)
  })

  it('returns same number for same id', () => {
    expect(riskNumber('x')).toBe(1)
    expect(riskNumber('x')).toBe(1)
    expect(riskNumber('y')).toBe(2)
    expect(riskNumber('x')).toBe(1)
  })

  it('resets correctly', () => {
    riskNumber('a')
    riskNumber('b')
    resetRiskNumbers()
    expect(riskNumber('c')).toBe(1)
  })
})
