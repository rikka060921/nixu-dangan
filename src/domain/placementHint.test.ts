import { describe, expect, it } from 'vitest'

import { INCIDENTS } from '../content/gameContent'
import { getPlacementHint } from './placementHint'

describe('placement previews', () => {
  it('explains the unique present timing of emergency evacuation', () => {
    expect(getPlacementHint('rescue', 1, INCIDENTS.fire)).toContain('真相 +1，保护证人')
    expect(getPlacementHint('rescue', 0, INCIDENTS.fire)).toContain('疏散过早')
    expect(getPlacementHint('rescue', 2, INCIDENTS.fire)).toContain('疏散过晚')
  })

  it('makes same-era ordering explicit', () => {
    expect(getPlacementHint('clarify', 0, INCIDENTS.rumor)).toContain('行动先结算')
    expect(getPlacementHint('clarify', 0, INCIDENTS.rumor)).toContain('提前破解谣言')
  })

  it('warns when a conditional card happens after the fixed event', () => {
    expect(getPlacementHint('anchor', 2, INCIDENTS.rumor)).toContain('来不及锚定')
    expect(getPlacementHint('seal', 2, INCIDENTS.rumor)).toContain('来不及保护')
  })

  it('shows the future payoff and off-timing risk of a borrowed second hand', () => {
    expect(getPlacementHint('secondhand', 2, INCIDENTS.fire)).toContain('真相 +2')
    expect(getPlacementHint('secondhand', 0, INCIDENTS.fire)).toContain('悖论 +1')
  })

  it('shows upgraded values without losing era-specific failure warnings', () => {
    expect(getPlacementHint('rescue', 1, INCIDENTS.fire, true)).toContain('真相 +2')
    expect(getPlacementHint('rescue', 2, INCIDENTS.fire, true)).toContain('疏散过晚')
    expect(getPlacementHint('anchor', 0, INCIDENTS.rumor, true)).toContain('悖论 -2')
  })
})
