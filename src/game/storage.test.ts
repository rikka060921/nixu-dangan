// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'

import { MAP_TEMPLATES } from '../content/gameContent'
import { placeSelectedCard, removePlacedCard, selectCard, startBattle } from '../domain/battle'
import { createRun } from '../domain/run'
import type { GameState, MetaState } from '../domain/types'
import { LEGACY_SAVE_KEY, loadMeta, loadSession, META_KEY, SAVE_KEY, VERSION3_SAVE_KEY, VERSION4_SAVE_KEY } from './storage'

const META: MetaState = {
  runs: 0,
  wins: 0,
  ink: 0,
  tutorialDone: true,
  soundEnabled: true,
  soundVolume: 300,
  lastMode: 'standard',
}

function saveV5(state: unknown): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify({ format: 'reverse-archive-save', version: 5, state }))
}

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
      soundEnabled: true,
      soundVolume: 300,
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
      meta: { runs: 0, wins: 0, ink: 0, tutorialDone: false, soundEnabled: true, soundVolume: 300, lastMode: 'standard' },
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
        draw: oldRun.deck.slice(1),
        discard: [],
        hand: [{ ...oldRun.deck[0], uid: 'legacy-hand-0' }],
        energy: 3,
        placed: [],
        watchAvailable: true,
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
      soundEnabled: true,
      soundVolume: 300,
      lastMode: 'standard',
    })
    localStorage.setItem(VERSION4_SAVE_KEY, JSON.stringify({
      format: 'reverse-archive-save',
      version: 4,
      state: {
        screen: { name: 'rest', removing: false },
        meta: { runs: 0, wins: 0, ink: 0, tutorialDone: false, soundEnabled: true, soundVolume: 300, lastMode: 'standard' },
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
      { cardId: 'seal', upgraded: false },
    ])
    expect(migrated?.screen).toEqual({ name: 'rest', removing: false, upgrading: false })
    expect(migrated?.notice).toContain('卡牌升级')
  })

  it('falls back to an older save when the current payload is corrupted', () => {
    const run = createRun('fallback-save', 'standard', { runs: 0, wins: 0, ink: 0, tutorialDone: true, soundEnabled: true, soundVolume: 300, lastMode: 'standard' })
    localStorage.setItem(SAVE_KEY, '{broken-json')
    localStorage.setItem(VERSION4_SAVE_KEY, JSON.stringify({
      format: 'reverse-archive-save',
      version: 4,
      state: { screen: { name: 'map' }, meta: { runs: 0, wins: 0, ink: 0, tutorialDone: true, soundEnabled: true, soundVolume: 300, lastMode: 'standard' }, selectedMode: 'standard', seedInput: run.seed, run, battle: null, resumable: null },
    }))

    const recovered = loadSession()
    expect(recovered?.run?.seed).toBe('fallback-save')
    expect(recovered?.notice).toContain('V4')
  })

  it('repairs a structurally valid but unplayable V5 payload', () => {
    const run = createRun('repair-save', 'standard', { runs: 0, wins: 0, ink: 0, tutorialDone: true, soundEnabled: true, soundVolume: 300, lastMode: 'standard' })
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      format: 'reverse-archive-save',
      version: 5,
      state: {
        screen: { name: 'battle' },
        meta: { runs: 1, wins: 0, ink: 2, tutorialDone: true, soundEnabled: true, soundVolume: 300, lastMode: 'standard' },
        selectedMode: 'invalid',
        seedInput: run.seed,
        run: { ...run, timeline: 0, paradox: 99, deck: ['not-a-card'], relics: ['not-a-relic'], layers: [] },
        battle: null,
      },
    }))

    const repaired = loadSession()
    expect(repaired?.screen.name).toBe('map')
    expect(repaired?.run?.deck).toHaveLength(3)
    expect(repaired?.run?.layers).toHaveLength(18)
    expect(repaired?.run?.relics).toEqual([])
    expect(repaired?.run?.timeline).toBe(1)
    expect(repaired?.run?.paradox).toBe(7)
    expect(repaired?.selectedMode).toBe('standard')
  })

  it('normalizes malformed standalone meta values instead of trusting their JSON types', () => {
    localStorage.setItem(META_KEY, JSON.stringify({
      runs: 'not-a-number',
      wins: -4,
      ink: '7',
      tutorialDone: 'true',
      soundEnabled: 'false',
      soundVolume: 'loud',
      lastMode: 'unknown',
    }))

    expect(loadMeta()).toEqual({
      runs: 0,
      wins: 0,
      ink: 7,
      tutorialDone: false,
      soundEnabled: true,
      soundVolume: 300,
      lastMode: 'standard',
    })
  })

  it('defaults old volume settings to 300% and clamps stored numeric values', () => {
    localStorage.setItem(META_KEY, JSON.stringify({ ...META, soundVolume: undefined }))
    expect(loadMeta().soundVolume).toBe(300)
    localStorage.setItem(META_KEY, JSON.stringify({ ...META, soundVolume: 999 }))
    expect(loadMeta().soundVolume).toBe(300)
    localStorage.setItem(META_KEY, JSON.stringify({ ...META, soundVolume: 0 }))
    expect(loadMeta().soundVolume).toBe(10)
  })

  it('uses current global meta as the fallback for a partial V5 session', () => {
    const currentMeta: MetaState = { runs: 9, wins: 3, ink: 17, tutorialDone: true, soundEnabled: false, soundVolume: 180, lastMode: 'paradox' }
    const run = createRun('meta-fallback', 'standard', META)
    saveV5({ screen: { name: 'map' }, selectedMode: 'standard', seedInput: run.seed, run, battle: null })

    expect(loadSession(currentMeta)?.meta).toEqual({ ...currentMeta, lastMode: 'standard' })
  })

  it('canonicalizes saved map nodes from content templates while preserving legacy descriptions', () => {
    const run = createRun('canonical-map', 'standard', META)
    const layers = run.layers.map((layer) => layer.map((node) => ({ ...node }))) as Array<Array<Record<string, unknown>>>
    const nodeId = String(layers[0][0].id)
    layers[0][0] = { ...layers[0][0], type: 'event', title: { corrupted: true }, description: '旧版保留描述' }
    saveV5({ screen: { name: 'map' }, meta: META, selectedMode: 'standard', seedInput: run.seed, run: { ...run, layers }, battle: null })

    const repairedNode = loadSession()?.run?.layers[0][0]
    expect(repairedNode).toEqual({ ...MAP_TEMPLATES[nodeId], description: '旧版保留描述' })
  })

  it('rejects inherited object properties as content identifiers', () => {
    const run = createRun('own-content-keys', 'standard', META)
    saveV5({
      screen: { name: 'event', eventId: 'constructor' },
      meta: META,
      selectedMode: 'standard',
      seedInput: run.seed,
      run: { ...run, deck: ['constructor'], relics: ['toString'], clues: ['__proto__'] },
      battle: null,
    })

    const repaired = loadSession()
    expect(repaired?.screen).toEqual({ name: 'event', eventId: 'telegram' })
    expect(repaired?.run?.deck).toHaveLength(3)
    expect(repaired?.run?.deck.some((card) => String(card.cardId) === 'constructor')).toBe(false)
    expect(repaired?.run?.relics).toEqual([])
    expect(repaired?.run?.clues).toEqual([])
  })

  it('returns a partial or stale battle to the map with no actionable battle state', () => {
    const run = createRun('partial-battle', 'standard', META)
    const node = run.layers[0][0]
    const activeRun = { ...run, currentNode: node.id, currentTitle: node.title }
    saveV5({
      screen: { name: 'battle' },
      meta: META,
      selectedMode: 'standard',
      seedInput: run.seed,
      run: activeRun,
      battle: { encounterId: node.id },
    })

    const repaired = loadSession()
    expect(repaired?.screen).toEqual({ name: 'map' })
    expect(repaired?.battle).toBeNull()
  })

  it('restores challenge limits from the selected mode instead of standard defaults', () => {
    const zeroMeta: MetaState = { ...META, lastMode: 'zero' }
    const run = createRun('zero-repair', 'zero', zeroMeta)
    const partialRun = { ...run, maxTimeline: undefined, timeline: undefined, paradoxLimit: 999 }
    saveV5({ screen: { name: 'map' }, meta: zeroMeta, selectedMode: 'zero', seedInput: run.seed, run: partialRun, battle: null })

    const repaired = loadSession()
    expect(repaired?.run?.timeline).toBe(24)
    expect(repaired?.run?.maxTimeline).toBe(24)
    expect(repaired?.run?.paradoxLimit).toBe(7)
  })

  it('recovers the first-round watch discount from an older V5 battle', () => {
    const watchMeta: MetaState = { ...META, ink: 3 }
    const run = createRun('legacy-watch', 'standard', watchMeta)
    const node = run.layers[0][0]
    const activeRun = { ...run, currentNode: node.id, currentTitle: node.title }
    const started = startBattle(activeRun, node.id as Parameters<typeof startBattle>[1])
    const selected = selectCard(started.battle, started.battle.hand[0].uid)
    const planned = placeSelectedCard(started.run, selected, 0)
    const legacyBattle = { ...planned } as Record<string, unknown>
    delete legacyBattle.watchAvailable
    legacyBattle.placed = planned.placed.map(({ discount: _discount, ...card }) => card)
    saveV5({ screen: { name: 'battle' }, meta: watchMeta, selectedMode: 'standard', seedInput: run.seed, run: started.run, battle: legacyBattle })

    const repaired = loadSession()
    expect(repaired?.screen.name).toBe('battle')
    expect(repaired?.battle?.placed[0].discount).toBe('watch')
    const removed = removePlacedCard(repaired!.battle!, repaired!.battle!.placed[0].uid)
    expect(removed.watchAvailable).toBe(true)
  })

  it('treats a throwing localStorage getter as unavailable storage', () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage')
    try {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get: () => { throw new DOMException('blocked', 'SecurityError') },
      })
      expect(loadMeta()).toEqual({ runs: 0, wins: 0, ink: 0, tutorialDone: false, soundEnabled: true, soundVolume: 300, lastMode: 'standard' })
      expect(loadSession()).toBeNull()
    } finally {
      if (descriptor) Object.defineProperty(window, 'localStorage', descriptor)
      else Reflect.deleteProperty(window, 'localStorage')
    }
  })
})
