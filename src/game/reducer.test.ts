import { describe, expect, it } from 'vitest'

import { ACT_MISSIONS } from '../content/gameContent'
import type { BattleState, GameState, MetaState, RunState } from '../domain/types'
import { createRun } from '../domain/run'
import { gameReducer } from './reducer'

const META: MetaState = {
  runs: 0,
  wins: 0,
  ink: 0,
  tutorialDone: false,
  soundEnabled: true,
  lastMode: 'standard',
}

function titleState(): GameState {
  return {
    screen: { name: 'title' },
    meta: META,
    selectedMode: 'standard',
    seedInput: '242713',
    run: null,
    battle: null,
    resumable: null,
  }
}

function winningBattle(): BattleState {
  const hand = [{ cardId: 'ledger' as const, upgraded: false, uid: 'ledger-win' }]
  return {
    encounterId: 'fire',
    encounterTarget: 1,
    incidentOrder: ['fire'],
    round: 0,
    truth: 0,
    credibility: 0,
    witnessAlive: true,
    draw: [],
    discard: [],
    hand,
    energy: 2,
    placed: [{ ...hand[0], era: 0, paid: 1 }],
    watchAvailable: true,
    nextCardUid: 1,
    log: [],
  }
}

describe('game reducer loop', () => {
  it('starts a seeded run and advances an event node back to the map', () => {
    const started = gameReducer(titleState(), { type: 'start-run' })
    expect(started.screen.name).toBe('map')
    expect(started.run?.seed).toBe('242713')

    const eventFloor = started.run!.layers.findIndex((layer) => layer.some((node) => node.type === 'event'))
    const eventNode = started.run!.layers[eventFloor].find((node) => node.type === 'event')!
    const atEvent = { ...started, run: { ...started.run!, floor: eventFloor } }
    const event = gameReducer(atEvent, { type: 'select-node', nodeId: eventNode.id })
    expect(event.screen.name).toBe('event')

    const resolved = gameReducer(event, {
      type: 'choose-event',
      choiceId: eventNode.id === 'telegram' ? 'read' : 'keep',
    })
    expect(resolved.screen.name).toBe('map')
    expect(resolved.run?.floor).toBe(eventFloor + 1)
    expect(resolved.run?.cleared[0]).toEqual({ floor: eventFloor, id: eventNode.id })
  })

  it('turns a won battle into a deterministic reward and advances after choosing a card', () => {
    const run = { ...createRun('reward-seed', 'standard', META), currentNode: 'fire', currentTitle: '余烬证人' }
    const state: GameState = {
      ...titleState(),
      screen: { name: 'battle' },
      run,
      battle: winningBattle(),
    }
    const won = gameReducer(state, { type: 'resolve-timeline' })
    expect(won.screen.name).toBe('reward')
    expect(won.run?.echoes).toBe(22)
    if (won.screen.name !== 'reward') throw new Error('reward screen expected')
    expect(won.screen.options).toHaveLength(3)

    const chosen = gameReducer(won, { type: 'choose-reward', cardId: won.screen.options[0] })
    expect(chosen.screen.name).toBe('map')
    expect(chosen.run?.floor).toBe(1)
    expect(chosen.run?.deck).toHaveLength(run.deck.length + 1)
  })

  it('closes a chapter after its boss reward before opening the next act', () => {
    const run = {
      ...createRun('chapter-seed', 'standard', META),
      floor: 5,
      currentNode: 'curator',
      currentTitle: '封馆人',
    }
    const battle = {
      ...winningBattle(),
      encounterId: 'curator' as const,
    }
    const won = gameReducer(
      { ...titleState(), screen: { name: 'battle' }, run, battle },
      { type: 'resolve-timeline' },
    )
    expect(won.screen.name).toBe('reward')
    if (won.screen.name !== 'reward') throw new Error('reward screen expected')
    expect(won.screen.relicGained).toBeDefined()

    const rewarded = gameReducer(won, { type: 'choose-reward', cardId: won.screen.options[0] })
    expect(rewarded.screen).toEqual({ name: 'chapter', act: 0 })
    expect(rewarded.run?.floor).toBe(6)
    expect(rewarded.run?.timeline).toBe(Math.min(run.maxTimeline, won.run!.timeline + 6))
    expect(rewarded.run?.paradox).toBe(Math.max(0, won.run!.paradox - 3))
    expect(rewarded.run?.cleared.at(-1)).toEqual({ floor: 5, id: 'curator' })

    const continued = gameReducer(rewarded, { type: 'continue-chapter' })
    expect(continued.screen.name).toBe('map')
    expect(continued.run?.currentTitle).toBe(ACT_MISSIONS[1].title)
    expect(continued.run?.layers[continued.run.floor][0].id).toMatch(/station|hospital|press/)
  })

  it('spends echoes exactly once for each shop slot', () => {
    const run = { ...createRun('shop-seed', 'standard', META), echoes: 30 }
    const state: GameState = {
      ...titleState(),
      run,
      screen: {
        name: 'shop',
        shop: { cards: ['thread', 'echo', 'delay'], relic: 'ash', bought: [], removing: false, upgrading: false },
      },
    }
    const bought = gameReducer(state, { type: 'buy-shop-card', index: 0 })
    expect(bought.run?.echoes).toBe(18)
    expect(bought.run?.deck.at(-1)).toEqual({ cardId: 'thread', upgraded: false })
    const duplicate = gameReducer(bought, { type: 'buy-shop-card', index: 0 })
    expect(duplicate).toBe(bought)
  })

  it('upgrades exactly one deck copy at rest and advances the route', () => {
    const run = { ...createRun('rest-upgrade', 'standard', META), currentNode: 'rest', currentTitle: '回声室' }
    const state: GameState = {
      ...titleState(),
      run,
      screen: { name: 'rest', removing: false, upgrading: true },
    }

    const upgraded = gameReducer(state, { type: 'upgrade-rest-card', index: 0 })
    expect(upgraded.screen.name).toBe('map')
    expect(upgraded.run?.floor).toBe(1)
    expect(upgraded.run?.deck[0]).toEqual({ cardId: 'seal', upgraded: true })
    expect(upgraded.run?.deck[1]).toEqual({ cardId: 'seal', upgraded: false })
  })

  it('charges once for a shop upgrade and rejects an already upgraded copy', () => {
    const run = { ...createRun('shop-upgrade', 'standard', META), echoes: 30 }
    const state: GameState = {
      ...titleState(),
      run,
      screen: {
        name: 'shop',
        shop: { cards: ['thread', 'echo', 'delay'], relic: 'ash', bought: [], removing: false, upgrading: true },
      },
    }

    const upgraded = gameReducer(state, { type: 'upgrade-shop-card', index: 0 })
    expect(upgraded.run?.echoes).toBe(12)
    expect(upgraded.run?.deck[0].upgraded).toBe(true)
    if (upgraded.screen.name !== 'shop') throw new Error('shop expected')
    expect(upgraded.screen.shop.bought).toContain('upgrade')
    expect(gameReducer(upgraded, { type: 'upgrade-shop-card', index: 0 })).toBe(upgraded)
  })

  it('keeps a minimum playable deck and guards shop edit actions by their active mode', () => {
    const shortRun = { ...createRun('minimum-deck', 'standard', META), deck: createRun('minimum-deck', 'standard', META).deck.slice(0, 3), currentNode: 'rest' }
    const restState: GameState = { ...titleState(), run: shortRun, screen: { name: 'rest', removing: true, upgrading: false } }
    expect(gameReducer(restState, { type: 'remove-rest-card', index: 0 })).toBe(restState)

    const shopState: GameState = {
      ...titleState(),
      run: { ...createRun('shop-guard', 'standard', META), echoes: 40 },
      screen: { name: 'shop', shop: { cards: ['thread'], relic: 'ash', bought: [], removing: false, upgrading: false } },
    }
    expect(gameReducer(shopState, { type: 'remove-shop-card', index: 0 })).toBe(shopState)
    expect(gameReducer(shopState, { type: 'upgrade-shop-card', index: 0 })).toBe(shopState)
  })

  it('rejects stale route and forged reward actions', () => {
    const run = createRun('action-guard', 'standard', META)
    const battleState: GameState = { ...titleState(), run, battle: winningBattle(), screen: { name: 'battle' } }
    const node = run.layers[0][0]
    expect(gameReducer(battleState, { type: 'select-node', nodeId: node.id })).toBe(battleState)

    const rewardState: GameState = { ...titleState(), run, screen: { name: 'reward', options: ['thread'], gain: 12 } }
    expect(gameReducer(rewardState, { type: 'choose-reward', cardId: 'vow' })).toBe(rewardState)
  })

  it('keeps current global preferences and progression when resuming an older session snapshot', () => {
    const savedRun = createRun('resume-meta', 'standard', META)
    const savedMeta = { ...META, tutorialDone: false, soundEnabled: true, runs: 1, wins: 0, ink: 2 }
    const currentMeta = { ...META, tutorialDone: true, soundEnabled: false, runs: 4, wins: 2, ink: 19 }
    const state: GameState = {
      ...titleState(),
      meta: currentMeta,
      resumable: {
        ...titleState(),
        screen: { name: 'map' },
        meta: savedMeta,
        run: savedRun,
      },
    }

    const resumed = gameReducer(state, { type: 'resume-run' })
    expect(resumed.meta).toEqual(currentMeta)
    expect(resumed.run).toBe(savedRun)
    expect(resumed.resumable).toBeNull()
  })

  it('ignores battle actions when a stale battle object survives on another screen', () => {
    const run = createRun('stale-battle', 'standard', META)
    const state: GameState = { ...titleState(), run, screen: { name: 'map' }, battle: winningBattle() }
    expect(gameReducer(state, { type: 'select-card', uid: 'ledger-win' })).toBe(state)
    expect(gameReducer(state, { type: 'place-card', era: 0 })).toBe(state)
    expect(gameReducer(state, { type: 'remove-placed', uid: 'ledger-win' })).toBe(state)
    expect(gameReducer(state, { type: 'resolve-timeline' })).toBe(state)
  })

  it('ends the run immediately when an event reaches a terminal resource limit', () => {
    const run = { ...createRun('event-terminal', 'standard', META), paradox: 7, currentNode: 'telegram', currentTitle: '无字电报' }
    const state: GameState = { ...titleState(), run, screen: { name: 'event', eventId: 'telegram' } }
    const ended = gameReducer(state, { type: 'choose-event', choiceId: 'read' })
    expect(ended.screen.name).toBe('ending')
    if (ended.screen.name !== 'ending') throw new Error('ending expected')
    expect(ended.screen.won).toBe(false)
    expect(ended.meta.runs).toBe(1)
  })

  it('records confirmed event clues for the final archive explanation', () => {
    const run = { ...createRun('event-clue', 'standard', META), currentNode: 'telegram', currentTitle: '无字电报' }
    const state: GameState = { ...titleState(), run, screen: { name: 'event', eventId: 'telegram' } }
    const resolved = gameReducer(state, { type: 'choose-event', choiceId: 'read' })
    expect(resolved.screen.name).toBe('map')
    expect(resolved.run?.clues).toContain('archive-origin')
  })

  it('closes the final boss by sealing zero history', () => {
    const run = { ...createRun('final-archive', 'standard', META), floor: 17, currentNode: 'boss', currentTitle: '零时档案', clues: ['archive-origin', 'zero-self', 'future-city'] as RunState['clues'] }
    const battle = { ...winningBattle(), encounterId: 'boss' as const }
    const ended = gameReducer({ ...titleState(), run, battle, screen: { name: 'battle' } }, { type: 'resolve-timeline' })
    expect(ended.screen.name).toBe('ending')
    if (ended.screen.name !== 'ending') throw new Error('ending expected')
    expect(ended.screen.won).toBe(true)
    expect(ended.run?.story.at(-1)).toContain('第零号历史')
  })

  it('does not buy a duplicate relic from a recovered shop', () => {
    const run = { ...createRun('duplicate-relic', 'standard', META), echoes: 40, relics: ['ash'] as RunState['relics'] }
    const state: GameState = {
      ...titleState(),
      run,
      screen: { name: 'shop', shop: { cards: [], relic: 'ash', bought: [], removing: false, upgrading: false } },
    }
    expect(gameReducer(state, { type: 'buy-shop-relic' })).toBe(state)
  })

  it('awards meta progression and clears the resumable run on a terminal loss', () => {
    const run = { ...createRun('loss-seed', 'standard', META), floor: 3, paradox: 7 }
    const battle: BattleState = {
      ...winningBattle(),
      encounterTarget: 99,
      hand: [{ cardId: 'secondhand', upgraded: false, uid: 'bad-second' }],
      placed: [{ cardId: 'secondhand', upgraded: false, uid: 'bad-second', era: 0, paid: 0 }],
    }
    const lost = gameReducer(
      { ...titleState(), screen: { name: 'battle' }, run, battle, resumable: titleState() },
      { type: 'resolve-timeline' },
    )
    expect(lost.screen.name).toBe('ending')
    expect(lost.meta.runs).toBe(1)
    expect(lost.meta.ink).toBe(2)
    expect(lost.resumable).toBeNull()
  })
})
