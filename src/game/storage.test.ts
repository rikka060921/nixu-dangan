// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'

import { MAP_TEMPLATES } from '../content/gameContent'
import { createRun } from '../domain/run'
import type { GameState } from '../domain/types'
import { LEGACY_SAVE_KEY, loadSession, VERSION3_SAVE_KEY, VERSION4_SAVE_KEY } from './storage'

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
    expect(migrated?.run?.layers).toHaveLength(18)
    expect(migrated?.run?.layers[0][0].description).toBe('旧版描述')
    expect(migrated?.notice).toContain('V2')
    expect(migrated?.screen.name).toBe('shop')
    if (migrated?.screen.name !== 'shop') throw new Error('shop screen expected')
    expect(migrated.screen.shop.bought).toEqual(['card-0'])
  })

  it('extends a one-act V3 campaign and converts its former final boss into the first chapter boss', () => {
    const run = createRun('old-campaign', 'standard', {
      runs: 0,
      wins: 0,
      ink: 0,
      tutorialDone: false,
      lastMode: 'standard',
    })
    const oldRun = {
      ...run,
      layers: run.layers.slice(0, 6).map((layer, index) => index === 5 ? [{ ...MAP_TEMPLATES.boss }] : layer),
      floor: 5,
      currentNode: 'boss',
      currentTitle: '零时档案',
    }
    const state: GameState = {
      screen: { name: 'battle' },
      meta: { runs: 0, wins: 0, ink: 0, tutorialDone: false, lastMode: 'standard' },
      selectedMode: 'standard',
      seedInput: 'old-campaign',
      run: oldRun,
      battle: {
        encounterId: 'boss',
        encounterTarget: 20,
        incidentOrder: ['rewrite', 'fire', 'purge', 'collapse', 'collapse'],
        round: 0,
        truth: 4,
        credibility: 0,
        witnessAlive: true,
        draw: [],
        discard: [],
        hand: [],
        energy: 3,
        placed: [],
        nextCardUid: 0,
        log: [],
      },
      resumable: null,
    }
    localStorage.setItem(VERSION3_SAVE_KEY, JSON.stringify({
      format: 'reverse-archive-save',
      version: 3,
      state,
    }))

    const migrated = loadSession()
    expect(migrated?.run?.layers).toHaveLength(18)
    expect(migrated?.run?.layers[5][0].id).toBe('curator')
    expect(migrated?.run?.currentNode).toBe('curator')
    expect(migrated?.battle?.encounterId).toBe('curator')
    expect(migrated?.notice).toContain('三幕')
  })

  it('migrates V4 string decks into individually upgradeable cards', () => {
    const run = createRun('v4-upgrade', 'standard', {
      runs: 0,
      wins: 0,
      ink: 0,
      tutorialDone: false,
      lastMode: 'standard',
    })
    localStorage.setItem(VERSION4_SAVE_KEY, JSON.stringify({
      format: 'reverse-archive-save',
      version: 4,
      state: {
        screen: { name: 'rest', removing: false },
        meta: { runs: 0, wins: 0, ink: 0, tutorialDone: false, lastMode: 'standard' },
        selectedMode: 'standard',
        seedInput: 'v4-upgrade',
        run: { ...run, deck: ['seal', 'memory'] },
        battle: null,
        resumable: null,
      },
    }))

    const migrated = loadSession()
    expect(migrated?.run?.deck).toEqual([
      { cardId: 'seal', upgraded: false },
      { cardId: 'memory', upgraded: false },
    ])
    expect(migrated?.screen).toEqual({ name: 'rest', removing: false, upgrading: false })
    expect(migrated?.notice).toContain('卡牌升级')
  })
})
