import { describe, expect, it } from 'vitest'

import { simulateRun } from './heuristic'

describe('headless run simulation', () => {
  it('is deterministic for a fixed seed', () => {
    expect(simulateRun('regression-17')).toEqual(simulateRun('regression-17'))
  })

  it('terminates a batch of seeded runs without deadlocks or invalid resources', () => {
    const results = Array.from({ length: 50 }, (_, index) => simulateRun(`batch-${index}`))
    expect(results.every((result) => result.terminal)).toBe(true)
    expect(results.every((result) => result.actions < 500)).toBe(true)
    expect(results.every((result) => Number.isFinite(result.timeline) && Number.isFinite(result.paradox))).toBe(true)
    expect(results.some((result) => result.floor >= 3)).toBe(true)
  })
})

