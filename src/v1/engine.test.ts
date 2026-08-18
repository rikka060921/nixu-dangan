import { describe, expect, it } from 'vitest'

import { drawHand, hashSeed, resolvePlan, suggestPlan } from './engine'
import type { CardInstanceV1 } from './types'

const cards = (ids: CardInstanceV1['cardId'][]): CardInstanceV1[] => ids.map((cardId, index) => ({ uid: `t${index}`, cardId }))

describe('1.x causal chain engine', () => {
  it('draws deterministic mixed-lane hands with a guaranteed opening card', () => {
    const first = drawHand(['seed', 'echo', 'rewrite'], hashSeed('same'), 1, 'backflow')
    const second = drawHand(['seed', 'echo', 'rewrite'], hashSeed('same'), 1, 'backflow')
    expect(first).toEqual(second)
    expect(first.hand[0].cardId).toBe('backflow')
    expect(first.hand.some((card) => card.cardId === 'seed' || card.cardId === 'rewrite')).toBe(true)
    expect(first.hand.some((card) => card.cardId === 'echo' || card.cardId === 'backflow')).toBe(true)
  })

  it('rewards switching timelines and lets future echoes rewrite the past', () => {
    const oneLane = resolvePlan(cards(['seed', 'witness', 'anchor']))
    const dualLine = resolvePlan(cards(['seed', 'backflow', 'rewrite']))
    expect(dualLine.events.some((event) => event.kind === 'relay')).toBe(true)
    expect(dualLine.events.some((event) => event.kind === 'echo')).toBe(true)
    expect(dualLine.impact).toBeGreaterThan(oneLane.impact)
  })

  it('finds the strongest ordered three-card plan automatically', () => {
    const hand = cards(['seed', 'echo', 'backflow', 'rewrite', 'anchor'])
    const suggestion = suggestPlan(hand, { echoes: 1, seeds: 1 })
    const suggestedImpact = resolvePlan(suggestion.map((uid) => hand.find((card) => card.uid === uid)!), { echoes: 1, seeds: 1 }).impact
    const naiveImpact = resolvePlan(hand.slice(0, 3), { echoes: 1, seeds: 1 }).impact
    expect(suggestion).toHaveLength(3)
    expect(suggestedImpact).toBeGreaterThanOrEqual(naiveImpact)
  })
})
