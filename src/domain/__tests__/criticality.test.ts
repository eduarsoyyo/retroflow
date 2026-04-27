import { describe, it, expect } from 'vitest'
import { calculateCriticality, criticalityLevel, criticalityColor } from '../criticality'

describe('calculateCriticality', () => {
  it('returns product of probability and impact', () => {
    expect(calculateCriticality(3, 3)).toBe(9)
    expect(calculateCriticality(1, 1)).toBe(1)
    expect(calculateCriticality(2, 3)).toBe(6)
    expect(calculateCriticality(1, 5)).toBe(5)
  })

  it('handles zero values', () => {
    expect(calculateCriticality(0, 5)).toBe(0)
    expect(calculateCriticality(3, 0)).toBe(0)
  })
})

describe('criticalityLevel', () => {
  it('returns critical for score >= 6', () => {
    expect(criticalityLevel(6)).toBe('critical')
    expect(criticalityLevel(9)).toBe('critical')
    expect(criticalityLevel(25)).toBe('critical')
  })

  it('returns moderate for score 3-5', () => {
    expect(criticalityLevel(3)).toBe('moderate')
    expect(criticalityLevel(4)).toBe('moderate')
    expect(criticalityLevel(5)).toBe('moderate')
  })

  it('returns low for score < 3', () => {
    expect(criticalityLevel(1)).toBe('low')
    expect(criticalityLevel(2)).toBe('low')
    expect(criticalityLevel(0)).toBe('low')
  })
})

describe('criticalityColor', () => {
  it('returns red for critical', () => {
    expect(criticalityColor('critical')).toBe('#FF3B30')
  })
  it('returns orange for moderate', () => {
    expect(criticalityColor('moderate')).toBe('#FF9500')
  })
  it('returns green for low', () => {
    expect(criticalityColor('low')).toBe('#34C759')
  })
})
