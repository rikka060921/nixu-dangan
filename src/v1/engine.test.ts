import { describe, expect, it } from 'vitest'

import { drawHand, hashSeed, resolvePlan, strategyPlans } from './engine'
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

  it('rewards switching timelines and lets future rewind replay the past', () => {
    const oneLane = resolvePlan(cards(['seed', 'witness', 'anchor']))
    const dualLine = resolvePlan(cards(['seed', 'rewrite', 'backflow']), {}, 't0')
    expect(dualLine.events.some((event) => event.kind === 'relay')).toBe(true)
    expect(dualLine.events.some((event) => event.kind === 'rewind')).toBe(true)
    expect(dualLine.events.some((event) => event.title === '重放 · 留下线索')).toBe(true)
    expect(dualLine.impact).toBeGreaterThan(oneLane.impact)
  })

  it('changes the replay segment when the player chooses another past target', () => {
    const timeline = cards(['seed', 'anchor', 'backflow'])
    const fromFirst = resolvePlan(timeline, {}, 't0')
    const fromSecond = resolvePlan(timeline, {}, 't1')
    expect(fromFirst.events.filter((event) => event.title.startsWith('重放 ·'))).toHaveLength(2)
    expect(fromSecond.events.filter((event) => event.title.startsWith('重放 ·'))).toHaveLength(1)
    expect(fromFirst.impact).toBeGreaterThan(fromSecond.impact)
  })

  it('offers distinct plans with reasons instead of one unexplained answer', () => {
    const plans = strategyPlans(cards(['seed', 'anchor', 'echo', 'backflow', 'rewrite']), { seeds: 1 })
    expect(plans).toHaveLength(2)
    expect(plans.map((plan) => plan.id)).toContain('rewind')
    expect(plans.every((plan) => plan.reasons.length >= 2)).toBe(true)
    expect(plans.find((plan) => plan.id === 'rewind')?.rewindTargetUid).toBeTruthy()
  })

})
