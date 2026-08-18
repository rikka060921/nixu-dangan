import { describe, expect, it } from 'vitest'

import { DEFAULT_META_V1 } from './storage'
import { gameReducerV1 } from './reducer'
import type { GameStateV1 } from './types'

describe('1.x reducer safety rails', () => {
  it('guarantees closure with an emergency rewind on the third round', () => {
    const state: GameStateV1 = {
      screen: { name: 'battle' },
      meta: DEFAULT_META_V1,
      seedInput: 'test',
      resumable: null,
      run: {
        seed: 'test', rngState: 1, chapterIndex: 0, deck: ['seed'], records: [],
        currentPastId: 'save-inspector', currentFutureId: 'living-court', bestChain: 0, totalImpact: 0, rewinds: 0,
      },
      battle: {
        chapterId: 'missing-murder', round: 3, target: 999, impact: 0, bestChain: 0,
        hand: [{ uid: 'c1', cardId: 'seed' }], stagedUids: ['c1'], nextUid: 2,
        routeBonus: {}, openingCard: 'seed', won: false, emergencyRewind: false,
      },
    }
    const next = gameReducerV1(state, { type: 'resolve-chain' })
    expect(next.battle?.won).toBe(true)
    expect(next.battle?.impact).toBe(999)
    expect(next.battle?.emergencyRewind).toBe(true)
    expect(next.battle?.resolution?.events.at(-1)?.kind).toBe('rewind')
  })

  it('can finish all four chapters using only the simple auto-play loop', () => {
    let state: GameStateV1 = {
      screen: { name: 'title' }, meta: DEFAULT_META_V1, seedInput: 'FULL-AUTO-RUN',
      resumable: null, run: null, battle: null,
    }
    state = gameReducerV1(state, { type: 'start-run' })
    let actions = 0
    while (state.screen.name !== 'ending' && actions < 80) {
      if (state.screen.name === 'map') {
        const chapter = state.run!.chapterIndex
        const pastId = ['save-inspector', 'stop-bell', 'print-cause', 'keep-both'][chapter]
        const futureId = ['living-court', 'still-street', 'cause-edition', 'double-dawn'][chapter]
        state = gameReducerV1(state, { type: 'choose-past', choiceId: pastId })
        state = gameReducerV1(state, { type: 'choose-future', choiceId: futureId })
      } else if (state.screen.name === 'battle') {
        if (!state.battle?.resolution) {
          state = gameReducerV1(state, { type: 'auto-stage' })
          state = gameReducerV1(state, { type: 'resolve-chain' })
        } else state = gameReducerV1(state, { type: 'continue-after-chain' })
      } else if (state.screen.name === 'reward') {
        state = gameReducerV1(state, { type: 'choose-reward', cardId: state.screen.options[0] })
      }
      actions += 1
    }
    expect(state.screen.name).toBe('ending')
    expect(state.run?.records).toHaveLength(4)
    expect(state.meta.wins).toBe(1)
  })
})
