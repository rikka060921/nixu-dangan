import { describe, expect, it } from 'vitest'

import { MAP_TEMPLATES } from '../content/gameContent'
import { buildRandomLayers } from './run'
import { seedHash } from './random'

describe('campaign route generation', () => {
  it('builds three deterministic six-floor acts with fixed chapter bosses', () => {
    const first = buildRandomLayers(seedHash('three-acts')).layers
    const second = buildRandomLayers(seedHash('three-acts')).layers

    expect(first).toEqual(second)
    expect(first).toHaveLength(18)
    expect(first[5]).toEqual([MAP_TEMPLATES.curator])
    expect(first[11]).toEqual([MAP_TEMPLATES.clockmaker])
    expect(first[17]).toEqual([MAP_TEMPLATES.boss])
  })

  it('requires two normal cases while preserving event, shop, rest and elite choices', () => {
    const layers = buildRandomLayers(seedHash('route-constraints')).layers

    for (const act of [0, 1, 2]) {
      const actLayers = layers.slice(act * 6, act * 6 + 6)
      expect(actLayers[0].map((node) => node.type)).toEqual(['battle'])
      expect(actLayers[1].map((node) => node.type)).toEqual(['battle', 'event'])
      expect(actLayers[2].map((node) => node.type)).toEqual(['battle'])
      expect(actLayers[3].map((node) => node.type)).toEqual(['elite', 'event'])
      expect(actLayers[4].map((node) => node.type)).toEqual(['elite', 'shop', 'rest'])
      expect(actLayers[5].map((node) => node.type)).toEqual(['boss'])
    }
  })
})
