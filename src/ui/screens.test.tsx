// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createRun } from '../domain/run'
import type { GameState, MetaState } from '../domain/types'
import { EndingScreen, ShopScreen } from './screens'

const META: MetaState = {
  runs: 1,
  wins: 1,
  ink: 8,
  tutorialDone: true,
  soundEnabled: false,
  lastMode: 'standard',
}

afterEach(cleanup)

describe('screen semantics and narrative closure', () => {
  it('names each shop purchase button by the item it buys', () => {
    const run = { ...createRun('shop-labels', 'standard', META), echoes: 50 }
    const state: GameState & { run: NonNullable<GameState['run']>; screen: Extract<GameState['screen'], { name: 'shop' }> } = {
      screen: { name: 'shop', shop: { cards: ['thread', 'echo', 'delay'], relic: 'ash', bought: [], removing: false, upgrading: false } },
      meta: META,
      selectedMode: 'standard',
      seedInput: run.seed,
      run,
      battle: null,
      resumable: null,
    }
    render(<ShopScreen state={state} dispatch={vi.fn()} />)

    expect(screen.getByRole('button', { name: '购买：证 · 红线追迹' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '购买：灰烬印章' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '购买：校注一张牌' })).toBeInTheDocument()
  })

  it('explains the final identity, motive and evidence-dependent proof', () => {
    const run = {
      ...createRun('ending-proof', 'standard', META),
      clues: ['archive-origin', 'zero-self', 'future-city', 'key-shape'] as NonNullable<GameState['run']>['clues'],
      relics: ['key'] as NonNullable<GameState['run']>['relics'],
    }
    const state: GameState & { run: NonNullable<GameState['run']>; screen: Extract<GameState['screen'], { name: 'ending' }> } = {
      screen: { name: 'ending', won: true, reason: 'sealed', inkGain: 8 },
      meta: META,
      selectedMode: 'standard',
      seedInput: run.seed,
      run,
      battle: null,
      resumable: null,
    }
    render(<EndingScreen state={state} dispatch={vi.fn()} />)

    expect(screen.getByRole('heading', { name: '你封存了第零号历史' })).toBeInTheDocument()
    expect(screen.getByText(/档案管理员摘下面具，那张脸正是未来的你/)).toBeInTheDocument()
    expect(screen.getByText(/未出生者曾从一座被救下的城市寄来回信/)).toBeInTheDocument()
    expect(screen.getByText(/证据彼此吻合/)).toBeInTheDocument()
    expect(screen.getByText(/第零号钥匙留在你手中/)).toBeInTheDocument()
  })

  it('cites only the concrete clues collected during the run', () => {
    const run = {
      ...createRun('ending-specific-proof', 'standard', META),
      clues: ['archive-origin', 'future-city', 'key-shape'] as NonNullable<GameState['run']>['clues'],
    }
    const state: GameState & { run: NonNullable<GameState['run']>; screen: Extract<GameState['screen'], { name: 'ending' }> } = {
      screen: { name: 'ending', won: true, reason: 'sealed', inkGain: 8 },
      meta: META,
      selectedMode: 'standard',
      seedInput: run.seed,
      run,
      battle: null,
      resumable: null,
    }
    render(<EndingScreen state={state} dispatch={vi.fn()} />)

    const proof = screen.getByText(/3 项证据彼此吻合/)
    expect(proof).toHaveTextContent('档案馆才是灾难的起点')
    expect(proof).toHaveTextContent('一座被救下的白塔城仍在未来留下回信')
    expect(proof).toHaveTextContent('地下那扇门确实为你留下了入口')
    expect(proof).not.toHaveTextContent('第零号历史中的你早已参与这场灾难')
  })
})
