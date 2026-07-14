import { describe, expect, it } from 'vitest'

import { createRun } from './run'
import {
  effectiveCost,
  placeSelectedCard,
  removePlacedCard,
  resolveTimeline,
  startBattle,
} from './battle'
import type { BattleState, CardId, Era, MetaState, PlacedCard, RunState } from './types'

const META: MetaState = {
  runs: 0,
  wins: 0,
  ink: 0,
  tutorialDone: false,
  lastMode: 'standard',
}

function makeRun(seed = 'archive-test'): RunState {
  return createRun(seed, 'standard', META)
}

function makeBattle(cardIds: CardId[], incident: BattleState['incidentOrder'][number], eras: Era[]): BattleState {
  const hand = cardIds.map((cardId, index) => ({ cardId, uid: `${cardId}-${index}` }))
  const placed: PlacedCard[] = hand.map((card, index) => ({ ...card, era: eras[index], paid: 0 }))
  return {
    encounterId: 'fire',
    encounterTarget: 99,
    incidentOrder: [incident],
    round: 0,
    truth: 0,
    credibility: 0,
    witnessAlive: true,
    draw: [],
    discard: [],
    hand,
    energy: 3,
    placed,
    nextCardUid: hand.length,
    log: [],
  }
}

describe('seeded run generation', () => {
  it('reproduces the same route and opening hand for the same seed', () => {
    const first = makeRun('242713')
    const second = makeRun('242713')
    expect(first.layers).toEqual(second.layers)

    const firstBattle = startBattle(first, 'bell')
    const secondBattle = startBattle(second, 'bell')
    expect(firstBattle.battle.incidentOrder).toEqual(secondBattle.battle.incidentOrder)
    expect(firstBattle.battle.hand.map((card) => card.cardId)).toEqual(
      secondBattle.battle.hand.map((card) => card.cardId),
    )
  })

  it('changes generated routes when the seed changes', () => {
    const routes = ['archive-a', 'archive-b', 'archive-c'].map((seed) =>
      makeRun(seed).layers.flat().map((node) => node.id).join(','),
    )
    expect(new Set(routes).size).toBeGreaterThan(1)
  })
})

describe('timeline placement', () => {
  it('makes the first placed card free with the burned watch and refunds the paid cost on undo', () => {
    const run = { ...makeRun(), relics: ['watch'] as RunState['relics'] }
    const started = startBattle(run, 'fire')
    const card = started.battle.hand[0]
    const selected = { ...started.battle, selectedUid: card.uid }

    expect(effectiveCost(started.run, selected, card)).toBe(0)
    const placed = placeSelectedCard(started.run, selected, 0)
    expect(placed.energy).toBe(3)
    expect(placed.placed).toHaveLength(1)

    const removed = removePlacedCard(placed, card.uid)
    expect(removed.energy).toBe(3)
    expect(removed.placed).toHaveLength(0)
  })

  it('rejects a card that costs more than the remaining energy', () => {
    const run = makeRun()
    const started = startBattle(run, 'fire')
    const expensive = { cardId: 'memory' as const, uid: 'memory-test' }
    const battle = { ...started.battle, hand: [expensive], selectedUid: expensive.uid, energy: 1 }
    expect(placeSelectedCard(started.run, battle, 0)).toBe(battle)
  })
})

describe('causal resolution', () => {
  it('lets a seal prevent the warehouse fire and converts prevention into truth', () => {
    const run = makeRun()
    const battle = makeBattle(['seal'], 'fire', [0])
    const result = resolveTimeline(run, battle)
    expect(result.run.timeline).toBe(run.timeline)
    expect(result.battle.truth).toBe(1)
    expect(result.battle.log.join('')).toContain('火灾被控制')
  })

  it('only clears a past rumor when clarification happens no later than the incident', () => {
    const run = makeRun()
    const early = resolveTimeline(run, makeBattle(['clarify'], 'rumor', [0]))
    const late = resolveTimeline(run, makeBattle(['clarify'], 'rumor', [2]))

    expect(early.run.paradox).toBe(0)
    expect(early.battle.truth).toBe(1)
    expect(late.run.paradox).toBe(1)
    expect(late.battle.credibility).toBe(1)
    expect(late.battle.truth).toBe(0)
  })

  it('gives emergency evacuation its special effect only in the present', () => {
    const run = makeRun()
    const present = resolveTimeline(run, makeBattle(['rescue'], 'fire', [1]))
    const past = resolveTimeline(run, makeBattle(['rescue'], 'fire', [0]))

    expect(present.run.timeline).toBe(run.timeline)
    expect(present.battle.truth).toBe(2)
    expect(past.run.timeline).toBe(run.timeline - 4)
    expect(past.battle.log.join('')).toContain('疏散时机错误')
  })

  it('allows a past blackout to cancel a fixed event at the cost of paradox', () => {
    const run = makeRun()
    const result = resolveTimeline(run, makeBattle(['blackout'], 'fire', [0]))
    expect(result.run.timeline).toBe(run.timeline)
    expect(result.run.paradox).toBe(2)
    expect(result.battle.log.join('')).toContain('事件被提前停电取消')
  })

  it('ends the run immediately when paradox reaches its limit', () => {
    const run = { ...makeRun(), paradox: 7 }
    const result = resolveTimeline(run, makeBattle(['secondhand'], 'fire', [0]))
    expect(result.outcome).toBe('run-lost')
    expect(result.reason).toContain('悖论')
  })

  it('does not let evidence from the future retroactively answer a present silence', () => {
    const run = makeRun()
    const result = resolveTimeline(run, makeBattle(['ledger'], 'silence', [2]))
    expect(result.run.timeline).toBe(run.timeline - 4)
    expect(result.battle.truth).toBe(3)
    expect(result.battle.log.join('')).toContain('全城失语')
  })

  it('resolves a past inversion before a future rewrite card exists', () => {
    const run = makeRun()
    const result = resolveTimeline(run, makeBattle(['memory'], 'inversion', [2]))
    expect(result.run.paradox).toBe(4)
    expect(result.battle.log.join('')).toContain('因果倒置：悖论 +2')
  })

  it('stops the timeline immediately at the paradox limit instead of resolving later cards', () => {
    const run = { ...makeRun(), paradox: 7 }
    const battle = makeBattle(['secondhand', 'ledger'], 'fire', [0, 2])
    const result = resolveTimeline(run, battle)
    expect(result.outcome).toBe('run-lost')
    expect(result.battle.truth).toBe(0)
    expect(result.battle.log.join('')).not.toContain('账本残页')
  })
})
