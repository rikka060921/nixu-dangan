// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'

import { LEGACY_SAVE_KEY, loadSession } from './storage'

describe('legacy save migration', () => {
  beforeEach(() => localStorage.clear())

  it('migrates V2 field names, route descriptions, card instances and shop purchase keys', () => {
    localStorage.setItem(
      LEGACY_SAVE_KEY,
      JSON.stringify({
        format: 'reverse-archive-save',
        version: 2,
        selectedMode: 'standard',
        meta: { runs: 2, wins: 1, ink: 4 },
        state: {
          screen: 'shop',
          shop: { cards: ['thread'], relic: 'ash', bought: ['c0'], removing: false },
        },
        run: {
          hp: 21,
          maxHp: 30,
          paradox: 2,
          paradoxLimit: 8,
          echoes: 18,
          deck: ['seal', 'ledger'],
          relics: ['watch'],
          floor: 2,
          cleared: [],
          story: ['旧历史'],
          currentTitle: '倒悬书摊',
          currentNode: 'shop',
          mode: 'standard',
          seed: 'legacy-42',
          rngState: 123,
          layers: [[{ type: 'shop', id: 'shop', icon: '铺', title: '倒悬书摊', sub: '交易节点', desc: '旧版描述' }]],
        },
        battle: null,
        rewardOptions: [],
      }),
    )

    const migrated = loadSession()
    expect(migrated?.run?.timeline).toBe(21)
    expect(migrated?.run?.layers[0][0].description).toBe('旧版描述')
    expect(migrated?.notice).toContain('V2')
    expect(migrated?.screen.name).toBe('shop')
    if (migrated?.screen.name !== 'shop') throw new Error('shop screen expected')
    expect(migrated.screen.shop.bought).toEqual(['card-0'])
  })
})

