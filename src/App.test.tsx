// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { App } from './App'

describe('application smoke flow', () => {
  beforeEach(() => localStorage.clear())

  it('starts a known seed, opens a battle and exposes placement previews', () => {
    render(<App />)
    fireEvent.change(screen.getByLabelText('调查种子'), { target: { value: '242713' } })
    fireEvent.click(screen.getByRole('button', { name: '进入灾难循环' }))
    expect(screen.getByRole('heading', { name: '选择下一份档案' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /逆行钟楼/ }))
    expect(screen.getByRole('heading', { name: '逆行钟楼' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /真实记忆/ }))
    expect(screen.getByRole('button', { name: /放到过去.*真相 \+4/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /放到未来.*真相 \+3/ })).toBeInTheDocument()
  })
})
