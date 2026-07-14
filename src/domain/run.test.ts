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

  it('offers a combat and a distinct utility choice before each boss', () => {
    const layers = buildRandomLayers(seedHash('route-constraints')).layers

    for (const act of [0, 1, 2]) {
      const actLayers = layers.slice(act * 6, act * 6 + 5)
      for (const layer of actLayers) {
        expect(layer).toHaveLength(2)
        expect(['battle', 'elite']).toContain(layer[0].type)
        expect(['event', 'rest', 'shop']).toContain(layer[1].type)
      }
    }
  })
})
