import { describe, it, expect } from 'vitest'
import * as sounds from '../../lib/sounds'

describe('sounds module', () => {
  it('exports all sound functions', () => {
    expect(typeof sounds.soundSuccess).toBe('function')
    expect(typeof sounds.soundCreate).toBe('function')
    expect(typeof sounds.soundDelete).toBe('function')
    expect(typeof sounds.soundDrop).toBe('function')
    expect(typeof sounds.soundTick).toBe('function')
    expect(typeof sounds.soundNotify).toBe('function')
    expect(typeof sounds.soundError).toBe('function')
    expect(typeof sounds.soundComplete).toBe('function')
    expect(typeof sounds.soundSlide).toBe('function')
  })
})
