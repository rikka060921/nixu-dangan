// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { App } from './App'
import { V1_META_KEY, V1_SAVE_KEY } from './v1/storage'

function closeFirstRunManual() {
  const button = screen.queryByRole('button', { name: '接通双线' })
  if (button) fireEvent.click(button)
}

function enterFirstBattle() {
  closeFirstRunManual()
  fireEvent.change(screen.getByLabelText('档案种子'), { target: { value: 'DUAL-LINE-TEST' } })
  fireEvent.click(screen.getByRole('button', { name: '新建双线档案' }))
  fireEvent.click(screen.getByRole('button', { name: /救下监察官/ }))
  fireEvent.click(screen.getByRole('button', { name: /活人法庭/ }))
}

describe('1.x application flow', () => {
  beforeEach(() => {
    cleanup()
    localStorage.clear()
  })

  it('teaches the three-action loop and remembers completion', () => {
    render(<App />)
    expect(screen.getByRole('dialog', { name: '不用算，也能把时间线炸穿' })).toBeInTheDocument()
    expect(screen.getByText('先改过去')).toBeInTheDocument()
    expect(screen.getByText('再选未来')).toBeInTheDocument()
    expect(screen.getByText('一键爽打')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '接通双线' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(V1_META_KEY) ?? '{}').tutorialDone).toBe(true)
  })

  it('changes the available future after choosing a past route', () => {
    render(<App />)
    closeFirstRunManual()
    fireEvent.click(screen.getByRole('button', { name: '新建双线档案' }))

    expect(screen.getByText('先改变过去')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /偷走死亡报告/ }))
    expect(screen.getByRole('button', { name: /完整罪证/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /灰烬保险库/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /活人法庭/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /救下监察官/ }))
    expect(screen.getByRole('button', { name: /活人法庭/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /完整罪证/ })).not.toBeInTheDocument()
  })

  it('auto-stages three cards and resolves a visible causal chain', () => {
    render(<App />)
    enterFirstBattle()
    const hand = screen.getByRole('region', { name: '本轮手牌' })

    fireEvent.click(screen.getByRole('button', { name: /一键爽打/ }))
    expect(within(hand).getAllByRole('button', { pressed: true })).toHaveLength(3)
    expect(screen.getByText('预计爆发').parentElement).not.toHaveTextContent('—')

    fireEvent.click(screen.getByRole('button', { name: /闭合双线/ }))
    expect(screen.getByText('本轮因果冲击')).toBeInTheDocument()
    expect(screen.getAllByText(/双线接力|时间线闭合/).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /领取闭环奖励|展开下一轮/ })).toBeInTheDocument()
  })

  it('supports keyboard auto-play and keeps the 300 percent global volume setting', () => {
    render(<App />)
    enterFirstBattle()
    const hand = screen.getByRole('region', { name: '本轮手牌' })

    fireEvent.keyDown(window, { key: 'a' })
    expect(within(hand).getAllByRole('button', { pressed: true })).toHaveLength(3)
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.getByText('本轮因果冲击')).toBeInTheDocument()

    fireEvent.change(screen.getByRole('slider', { name: '全局音量' }), { target: { value: '210' } })
    expect(screen.getByLabelText('打开音量设置')).toHaveTextContent('210%')
    fireEvent.click(screen.getByRole('button', { name: '音乐与音效：开' }))
    expect(JSON.parse(localStorage.getItem(V1_META_KEY) ?? '{}')).toMatchObject({ soundEnabled: false, soundVolume: 210 })
  })

  it('persists a route breakpoint and resumes it on reload', () => {
    render(<App />)
    closeFirstRunManual()
    fireEvent.click(screen.getByRole('button', { name: '新建双线档案' }))
    fireEvent.click(screen.getByRole('button', { name: /偷走死亡报告/ }))
    expect(localStorage.getItem(V1_SAVE_KEY)).toContain('steal-report')

    cleanup()
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '继续上次断点' }))
    expect(screen.getByRole('button', { name: /完整罪证/ })).toBeInTheDocument()
    expect(screen.getByText('已从双线断点继续。')).toBeInTheDocument()
  })
})
