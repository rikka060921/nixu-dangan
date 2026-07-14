import { describe, expect, it } from 'vitest'

import { CARDS } from '../content/cards'
import { createRun, pickRewardOptions } from './run'
import type { MetaState } from './types'

const META: MetaState = {
  runs: 0,
  wins: 0,
  ink: 0,
  tutorialDone: true,
  lastMode: 'standard',
}

describe('constrained card rewards', () => {
  it('is deterministic and never repeats a card in the same reward set', () => {
    const first = pickRewardOptions(createRun('reward-constraint', 'standard', META)).options
    const second = pickRewardOptions(createRun('reward-constraint', 'standard', META)).options
    expect(first).toEqual(second)
    expect(new Set(first).size).toBe(first.length)
  })

  it('uses rarity and duplicate penalties across a fixed seed corpus', () => {
    const counts = new Map<string, number>()
    for (let index = 0; index < 1000; index += 1) {
      const options = pickRewardOptions(createRun(`reward-corpus-${index}`, 'standard', META)).options
      for (const cardId of options) {
        counts.set(cardId, (counts.get(cardId) ?? 0) + 1)
        counts.set(CARDS[cardId].rarity, (counts.get(CARDS[cardId].rarity) ?? 0) + 1)
      }
    }

    expect(counts.get('thread') ?? 0).toBeGreaterThan(counts.get('ledger') ?? 0)
    expect(counts.get('普通') ?? 0).toBeGreaterThan(counts.get('稀有') ?? 0)
  })
})

