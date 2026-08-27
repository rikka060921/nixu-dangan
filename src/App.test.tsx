// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { App } from './App'
import { V1_META_KEY, V1_SAVE_KEY } from './v1/storage'

function closeFirstRunManual() {
  const button = screen.queryByRole('button', { name: '跳过教程，直接玩' })
  if (button) fireEvent.click(button)
}

function enterFirstBattle() {
  closeFirstRunManual()
  fireEvent.click(screen.getByRole('button', { name: '开始新游戏' }))
  fireEvent.click(screen.getByRole('button', { name: /救下监察官/ }))
  fireEvent.click(screen.getByRole('button', { name: /活人法庭/ }))
}

describe('1.x application flow', () => {
  beforeEach(() => {
    cleanup()
    localStorage.clear()
  })

  it('guides a new player through every action in the first battle', () => {
    render(<App />)
    expect(screen.getByRole('dialog', { name: '先做一件事，再看它造成什么结果' })).toBeInTheDocument()
    expect(screen.getByText('先选择过去')).toBeInTheDocument()
    expect(screen.getByText('再选择结果')).toBeInTheDocument()
    expect(screen.getAllByText('时间回传').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: '开始分步教程' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '开始新游戏' }))
    expect(screen.getByRole('heading', { name: '先点一个红色选项' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /救下监察官/ }))
    expect(screen.getByRole('heading', { name: '再点一个蓝色结果' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /活人法庭/ }))
    expect(screen.getByRole('heading', { name: '先比较两种参考打法' })).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: '采用这个思路' })[0])
    expect(screen.getByRole('heading', { name: '确认理由和回传目标' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^开始结算/ }))
    expect(screen.getByRole('heading', { name: '这些记录只是在解释加分' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /过关！选择奖励/ }))
    expect(screen.getByRole('heading', { name: '教程完成！' })).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: /加入牌库/ })[0])
    expect(JSON.parse(localStorage.getItem(V1_META_KEY) ?? '{}').tutorialDone).toBe(true)
  })

  it('changes the available future after choosing a past route', () => {
    render(<App />)
    closeFirstRunManual()
    fireEvent.click(screen.getByRole('button', { name: '开始新游戏' }))

    expect(screen.getByText('先选择上方红色选项')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /偷走死亡报告/ }))
    expect(screen.getByRole('button', { name: /完整罪证/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /灰烬保险库/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /活人法庭/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /救下监察官/ }))
    expect(screen.getByRole('button', { name: /活人法庭/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /完整罪证/ })).not.toBeInTheDocument()
  })

  it('adopts an explained plan and resolves a visible causal chain', () => {
    render(<App />)
    enterFirstBattle()
    const hand = screen.getByRole('region', { name: '本轮手牌' })

    const plans = screen.getByRole('region', { name: '带理由的参考打法' })
    expect(within(plans).getAllByRole('listitem').length).toBeGreaterThanOrEqual(4)
    fireEvent.click(within(plans).getAllByRole('button', { name: '采用这个思路' })[0])
    expect(within(hand).getAllByRole('button', { pressed: true })).toHaveLength(3)
    expect(screen.getByText('预计得到').parentElement).not.toHaveTextContent('—')

    fireEvent.click(screen.getByRole('button', { name: /^开始结算/ }))
    expect(screen.getByText('本轮得分')).toBeInTheDocument()
    expect(screen.getAllByText(/红蓝切换|三张牌结算/).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /过关！选择奖励|继续下一轮/ })).toBeInTheDocument()
  })

  it('supports keyboard card selection and keeps the 300 percent global volume setting', () => {
    render(<App />)
    enterFirstBattle()
    const hand = screen.getByRole('region', { name: '本轮手牌' })

    fireEvent.keyDown(window, { key: '1' })
    fireEvent.keyDown(window, { key: '2' })
    fireEvent.keyDown(window, { key: '3' })
    expect(within(hand).getAllByRole('button', { pressed: true })).toHaveLength(3)
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.getByText('本轮得分')).toBeInTheDocument()

    fireEvent.change(screen.getByRole('slider', { name: '全局音量' }), { target: { value: '210' } })
    expect(screen.getByLabelText('打开音量设置')).toHaveTextContent('210%')
    fireEvent.click(screen.getByRole('button', { name: '音乐与音效：开' }))
    expect(JSON.parse(localStorage.getItem(V1_META_KEY) ?? '{}')).toMatchObject({ soundEnabled: false, soundVolume: 210 })
  })

  it('persists a route breakpoint and resumes it on reload', () => {
    render(<App />)
    closeFirstRunManual()
    fireEvent.click(screen.getByRole('button', { name: '开始新游戏' }))
    fireEvent.click(screen.getByRole('button', { name: /偷走死亡报告/ }))
    expect(localStorage.getItem(V1_SAVE_KEY)).toContain('steal-report')

    cleanup()
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '继续游戏' }))
    expect(screen.getByRole('button', { name: /完整罪证/ })).toBeInTheDocument()
    expect(screen.getByText('已从双线断点继续。')).toBeInTheDocument()
  })
})
