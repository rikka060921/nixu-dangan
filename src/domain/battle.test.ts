import { describe, expect, it } from 'vitest'

import { createRun } from './run'
import {
  effectiveCost,
  placeSelectedCard,
  removePlacedCard,
  resolveTimeline,
  selectCard,
  startBattle,
} from './battle'
import type { BattleState, CardId, Era, MetaState, PlacedCard, RunState } from './types'

const META: MetaState = {
  runs: 0,
  wins: 0,
  ink: 0,
  tutorialDone: false,
  soundEnabled: true,
  soundVolume: 300,
  lastMode: 'standard',
}

function makeRun(seed = 'archive-test'): RunState {
  return createRun(seed, 'standard', META)
}

function makeBattle(cardIds: CardId[], incident: BattleState['incidentOrder'][number], eras: Era[]): BattleState {
  const hand = cardIds.map((cardId, index) => ({ cardId, upgraded: false, uid: `${cardId}-${index}` }))
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
    watchAvailable: true,
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
    expect(removed.watchAvailable).toBe(true)
  })

  it('consumes the burned watch only once per case, not once per round', () => {
    const run = { ...makeRun(), relics: ['watch'] as RunState['relics'] }
    const source = { ...makeBattle(['ledger'], 'theft', [0]), placed: [], selectedUid: 'ledger-0' }
    const planned = placeSelectedCard(run, source, 0)
    expect(planned.placed[0].paid).toBe(0)
    expect(planned.watchAvailable).toBe(false)

    const next = resolveTimeline(run, planned)
    expect(next.outcome).toBe('continue')
    expect(next.battle.watchAvailable).toBe(false)
    expect(effectiveCost(next.run, next.battle, next.battle.hand[0])).toBe(1)
  })

  it('consumes the burned watch before the calibration needle when both discounts match', () => {
    const run = { ...makeRun(), relics: ['watch', 'needle'] as RunState['relics'] }
    const source = { ...makeBattle(['memory', 'ledger'], 'theft', [0]), placed: [], selectedUid: 'memory-0' }
    const first = placeSelectedCard(run, source, 0)

    expect(first.placed[0]).toMatchObject({ cardId: 'memory', paid: 0, discount: 'watch' })
    expect(first.watchAvailable).toBe(false)
    expect(effectiveCost(run, first, first.hand[1])).toBe(1)
  })

  it('moves the burned-watch discount to the first remaining plan after an undo', () => {
    const run = { ...makeRun(), relics: ['watch', 'needle'] as RunState['relics'] }
    const source = { ...makeBattle(['ledger', 'memory', 'seal'], 'theft', [0]), placed: [], selectedUid: 'ledger-0' }
    const first = placeSelectedCard(run, source, 0)
    const second = placeSelectedCard(run, selectCard(first, 'memory-1'), 1)
    const undone = removePlacedCard(second, 'ledger-0')

    expect(undone.placed).toEqual([
      expect.objectContaining({ cardId: 'memory', paid: 0, discount: 'watch' }),
    ])
    expect(undone.watchAvailable).toBe(false)
    expect(effectiveCost(run, undone, undone.hand[2])).toBe(1)
  })

  it('rejects a card that costs more than the remaining energy', () => {
    const run = makeRun()
    const started = startBattle(run, 'fire')
    const expensive = { cardId: 'memory' as const, upgraded: false, uid: 'memory-test' }
    const battle = { ...started.battle, hand: [expensive], selectedUid: expensive.uid, energy: 1 }
    expect(placeSelectedCard(started.run, battle, 0)).toBe(battle)
  })

  it('makes the first rewrite card free with the calibration needle', () => {
    const run = { ...makeRun(), relics: ['needle'] as RunState['relics'] }
    const battle = makeBattle(['memory', 'annotation'], 'theft', [0, 2])
    expect(effectiveCost(run, { ...battle, placed: [] }, battle.hand[0])).toBe(0)
    expect(effectiveCost(run, { ...battle, placed: [battle.placed[0]] }, battle.hand[1])).toBe(1)
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

  it('applies an upgrade to one card instance without changing the base copy rules', () => {
    const run = makeRun()
    const normalBattle = makeBattle(['memory'], 'theft', [0])
    const upgradedSource = makeBattle(['memory'], 'theft', [0])
    const upgradedBattle: BattleState = {
      ...upgradedSource,
      hand: upgradedSource.hand.map((card) => ({ ...card, upgraded: true })),
      placed: upgradedSource.placed.map((card) => ({ ...card, upgraded: true })),
    }

    const normal = resolveTimeline(run, normalBattle)
    const upgraded = resolveTimeline(run, upgradedBattle)

    expect(normal.run.paradox).toBe(2)
    expect(upgraded.run.paradox).toBe(1)
    expect(upgraded.battle.truth).toBe(normal.battle.truth)
  })

  it('initializes case resources from persistent relic hooks', () => {
    const run = { ...makeRun(), paradox: 3, relics: ['ticket', 'key'] as RunState['relics'] }
    const started = startBattle(run, 'fire')
    expect(started.run.paradox).toBe(2)
    expect(started.battle.credibility).toBe(1)
  })

  it('raises a chapter boss target when too many key cases were skipped', () => {
    const base = makeRun('boss-pressure')
    const run: RunState = {
      ...base,
      floor: 5,
      cleared: [{ floor: 0, id: base.layers[0][0].id }],
    }
    const started = startBattle(run, 'curator')
    expect(started.battle.encounterTarget).toBe(26)
    expect(started.battle.log.join('')).toContain('目标 +8')
  })

  it('reduces fixed-event damage with the cracked lens', () => {
    const run = { ...makeRun(), relics: ['lens'] as RunState['relics'] }
    const result = resolveTimeline(run, makeBattle(['ledger'], 'fire', [2]))
    expect(result.run.timeline).toBe(run.timeline - 2)
    expect(result.battle.log.join('')).toContain('裂纹目镜')
  })

  it('rewards upgraded cards and three-era planning through relic hooks', () => {
    const run = { ...makeRun(), relics: ['carbon', 'bellshard'] as RunState['relics'] }
    const source = makeBattle(['thread', 'ledger', 'anchor'], 'theft', [0, 1, 2])
    const battle: BattleState = {
      ...source,
      hand: source.hand.map((card, index) => index === 0 ? { ...card, upgraded: true } : card),
      placed: source.placed.map((card, index) => index === 0 ? { ...card, upgraded: true } : card),
    }
    const result = resolveTimeline(run, battle)
    expect(result.battle.log.join('')).toContain('复写黑纸')
    expect(result.battle.log.join('')).toContain('逆钟碎片')
  })
})
