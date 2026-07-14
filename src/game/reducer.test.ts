import { describe, expect, it } from 'vitest'

import type { BattleState, GameState, MetaState } from '../domain/types'
import { createRun } from '../domain/run'
import { gameReducer } from './reducer'

const META: MetaState = {
  runs: 0,
  wins: 0,
  ink: 0,
  tutorialDone: false,
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
  const hand = [{ cardId: 'ledger' as const, uid: 'ledger-win' }]
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
    nextCardUid: 1,
    log: [],
  }
}

describe('game reducer loop', () => {
  it('starts a seeded run and advances an event node back to the map', () => {
    const started = gameReducer(titleState(), { type: 'start-run' })
    expect(started.screen.name).toBe('map')
    expect(started.run?.seed).toBe('242713')

    const eventNode = started.run!.layers[0].find((node) => node.type === 'event')!
    const event = gameReducer(started, { type: 'select-node', nodeId: eventNode.id })
    expect(event.screen.name).toBe('event')

    const resolved = gameReducer(event, {
      type: 'choose-event',
      choiceId: eventNode.id === 'telegram' ? 'read' : 'keep',
    })
    expect(resolved.screen.name).toBe('map')
    expect(resolved.run?.floor).toBe(1)
    expect(resolved.run?.cleared[0].id).toBe(eventNode.id)
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
    expect(continued.run?.layers[continued.run.floor][0].id).toMatch(/station|hospital|press/)
  })

  it('spends echoes exactly once for each shop slot', () => {
    const run = { ...createRun('shop-seed', 'standard', META), echoes: 30 }
    const state: GameState = {
      ...titleState(),
      run,
      screen: {
        name: 'shop',
        shop: { cards: ['thread', 'echo', 'delay'], relic: 'ash', bought: [], removing: false },
      },
    }
    const bought = gameReducer(state, { type: 'buy-shop-card', index: 0 })
    expect(bought.run?.echoes).toBe(18)
    expect(bought.run?.deck.at(-1)).toBe('thread')
    const duplicate = gameReducer(bought, { type: 'buy-shop-card', index: 0 })
    expect(duplicate).toBe(bought)
  })

  it('awards meta progression and clears the resumable run on a terminal loss', () => {
    const run = { ...createRun('loss-seed', 'standard', META), floor: 3, paradox: 7 }
    const battle: BattleState = {
      ...winningBattle(),
      encounterTarget: 99,
      hand: [{ cardId: 'secondhand', uid: 'bad-second' }],
      placed: [{ cardId: 'secondhand', uid: 'bad-second', era: 0, paid: 0 }],
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
