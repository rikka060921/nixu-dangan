// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { App } from './App'
import { createRun } from './domain/run'
import type { GameState, MetaState } from './domain/types'
import { META_KEY, SAVE_KEY } from './game/storage'

const RESTORED_META: MetaState = {
  runs: 1,
  wins: 0,
  ink: 4,
  tutorialDone: true,
  soundEnabled: false,
  lastMode: 'standard',
}

function storeResumableRun(): void {
  const run = createRun('modal-focus', 'standard', RESTORED_META)
  const state: GameState = {
    screen: { name: 'map' },
    meta: RESTORED_META,
    selectedMode: 'standard',
    seedInput: run.seed,
    run,
    battle: null,
    resumable: null,
  }
  localStorage.setItem(META_KEY, JSON.stringify(RESTORED_META))
  localStorage.setItem(SAVE_KEY, JSON.stringify({ format: 'reverse-archive-save', version: 5, state }))
}

describe('application smoke flow', () => {
  beforeEach(() => {
    cleanup()
    localStorage.clear()
  })

  afterEach(() => vi.useRealTimers())

  it('starts a known seed, opens a battle and exposes placement previews', () => {
    render(<App />)
    fireEvent.change(screen.getByLabelText('调查种子'), { target: { value: '242713' } })
    fireEvent.click(screen.getByRole('button', { name: '进入灾难循环' }))
    fireEvent.click(screen.getByRole('button', { name: '跳过引导' }))
    expect(screen.getByRole('heading', { name: '选择下一份档案' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '调查路线' })).toHaveFocus()

    fireEvent.click(screen.getByRole('button', { name: /逆行钟楼/ }))
    expect(screen.getByRole('heading', { name: '逆行钟楼' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '案件战斗' })).toHaveFocus()

    fireEvent.click(screen.getByRole('button', { name: /真实记忆/ }))
    expect(screen.getByRole('button', { name: /放到过去.*真相 \+4/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /放到未来.*真相 \+3/ })).toBeInTheDocument()
  })

  it('persists the four-step first investigation briefing', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '进入灾难循环' }))
    expect(screen.getByRole('dialog', { name: '让真相达到案件目标' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '下一步' }))
    expect(screen.getByRole('dialog', { name: '路线就是长期代价' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '下一步' }))
    fireEvent.click(screen.getByRole('button', { name: '下一步' }))
    fireEvent.click(screen.getByRole('button', { name: '开始调查' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(META_KEY) ?? '{}').tutorialDone).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: '游戏说明' }))
    fireEvent.click(screen.getByRole('button', { name: '重看首次引导' }))
    expect(screen.getByRole('dialog', { name: '让真相达到案件目标' })).toBeInTheDocument()
  })

  it('supports battle placement shortcuts and the global manual shortcut', () => {
    render(<App />)
    fireEvent.change(screen.getByLabelText('调查种子'), { target: { value: '242713' } })
    fireEvent.click(screen.getByRole('button', { name: '进入灾难循环' }))
    fireEvent.click(screen.getByRole('button', { name: '跳过引导' }))
    fireEvent.click(screen.getByRole('button', { name: /逆行钟楼/ }))

    fireEvent.keyDown(window, { key: '1' })
    expect(within(screen.getByRole('group', { name: '本轮手牌' })).getAllByRole('button', { pressed: true })).toHaveLength(1)
    fireEvent.keyDown(window, { key: 'q' })
    expect(screen.getByRole('button', { name: /撤回/ })).toBeInTheDocument()

    const manualButton = screen.getByRole('button', { name: '游戏说明' })
    manualButton.focus()
    fireEvent.keyDown(manualButton, { key: 'Enter' })
    expect(screen.getByRole('button', { name: /撤回/ })).toBeInTheDocument()

    fireEvent.click(manualButton)
    expect(screen.getByRole('dialog', { name: '调查员说明书' })).toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(manualButton).toHaveFocus()

    const battleRegion = screen.getByRole('region', { name: '案件战斗' })
    battleRegion.focus()
    fireEvent.keyDown(battleRegion, { key: 'Backspace' })
    expect(screen.queryByRole('button', { name: /撤回/ })).not.toBeInTheDocument()

    fireEvent.keyDown(battleRegion, { key: '?' })
    expect(screen.getByRole('dialog', { name: '调查员说明书' })).toBeInTheDocument()
  })

  it('keeps restored notices outside dialogs without resetting dialog focus', () => {
    vi.useFakeTimers()
    storeResumableRun()
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '继续调查' }))
    expect(screen.getByRole('status')).toHaveTextContent('调查存档已恢复。')

    fireEvent.click(screen.getByRole('button', { name: '游戏说明' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    const replayButton = screen.getByRole('button', { name: '重看首次引导' })
    replayButton.focus()

    act(() => vi.advanceTimersByTime(3200))
    expect(replayButton).toHaveFocus()
  })

  it('focuses the title region after returning without stealing focus on first load', () => {
    render(<App />)
    expect(screen.getByRole('region', { name: '标题页' })).not.toHaveFocus()

    fireEvent.click(screen.getByRole('button', { name: '进入灾难循环' }))
    fireEvent.click(screen.getByRole('button', { name: '跳过引导' }))
    const returnButton = screen.getByRole('button', { name: '返回标题' })
    returnButton.focus()
    fireEvent.click(returnButton)

    expect(screen.getByRole('region', { name: '标题页' })).toHaveFocus()
  })
})
