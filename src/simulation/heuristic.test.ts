import { describe, expect, it } from 'vitest'

import { createRun } from '../domain/run'
import type { GameState, MetaState } from '../domain/types'
import { chooseMapNode, simulateRun } from './heuristic'

const META: MetaState = {
  runs: 0,
  wins: 0,
  ink: 0,
  tutorialDone: true,
  soundEnabled: false,
  lastMode: 'standard',
}

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

  it('can choose both rest and shop branches when the route offers both', () => {
    const run = createRun('utility-branches', 'standard', META)
    const state: GameState = {
      screen: { name: 'map' },
      meta: META,
      selectedMode: 'standard',
      seedInput: run.seed,
      run: { ...run, floor: 4, paradox: 2 },
      battle: null,
      resumable: null,
    }

    expect(chooseMapNode(state, 'balanced')?.type).toBe('rest')
    const shopState = {
      ...state,
      run: {
        ...state.run!,
        paradox: 0,
        echoes: 25,
        deck: state.run!.deck.map((card, index) => index === 0 ? { ...card, upgraded: true } : card),
      },
    }
    expect(chooseMapNode(shopState, 'balanced')?.type).toBe('shop')
  })
})
