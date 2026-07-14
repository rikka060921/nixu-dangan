import { useEffect, useState } from 'react'

import type { GameState, RunState } from './domain/types'
import { useGame } from './game/useGame'
import { Header, Hud } from './ui/components'
import {
  BattleScreen,
  ChapterScreen,
  EndingScreen,
  EventScreen,
  MapScreen,
  RestScreen,
  RewardScreen,
  ShopScreen,
  TitleScreen,
} from './ui/screens'

export function App() {
  const { state, dispatch } = useGame()
  const [manualOpen, setManualOpen] = useState(false)

  useEffect(() => {
    if (!state.notice) return
    const timer = window.setTimeout(() => dispatch({ type: 'clear-notice' }), 3200)
    return () => window.clearTimeout(timer)
  }, [dispatch, state.notice])

  let content = <TitleScreen state={state} dispatch={dispatch} />
  if (state.screen.name !== 'title' && state.run) {
    const activeState = state as GameState & { run: RunState }
    if (state.screen.name === 'map') content = <MapScreen state={activeState} dispatch={dispatch} />
    if (state.screen.name === 'battle' && state.battle) {
      content = <BattleScreen state={state as GameState & { run: RunState; battle: NonNullable<GameState['battle']> }} dispatch={dispatch} />
    }
    if (state.screen.name === 'event') {
      content = <EventScreen state={state as GameState & { run: RunState; screen: Extract<GameState['screen'], { name: 'event' }> }} dispatch={dispatch} />
    }
    if (state.screen.name === 'rest') {
      content = <RestScreen state={state as GameState & { run: RunState; screen: Extract<GameState['screen'], { name: 'rest' }> }} dispatch={dispatch} />
    }
    if (state.screen.name === 'shop') {
      content = <ShopScreen state={state as GameState & { run: RunState; screen: Extract<GameState['screen'], { name: 'shop' }> }} dispatch={dispatch} />
    }
    if (state.screen.name === 'reward') {
      content = <RewardScreen state={state as GameState & { run: RunState; screen: Extract<GameState['screen'], { name: 'reward' }> }} dispatch={dispatch} />
    }
    if (state.screen.name === 'chapter') {
      content = <ChapterScreen state={state as GameState & { run: RunState; screen: Extract<GameState['screen'], { name: 'chapter' }> }} dispatch={dispatch} />
    }
    if (state.screen.name === 'ending') {
      content = <EndingScreen state={state as GameState & { run: RunState; screen: Extract<GameState['screen'], { name: 'ending' }> }} dispatch={dispatch} />
    }
  }

  return (
    <>
      <div className="noise" aria-hidden="true" />
      <main className="app-shell">
        <Header state={state} dispatch={dispatch} onOpenManual={() => setManualOpen(true)} />
        {state.run && state.screen.name !== 'ending' ? <Hud run={state.run} meta={state.meta} /> : null}
        {content}
      </main>
      {manualOpen ? <Manual onClose={() => setManualOpen(false)} /> : null}
      {state.notice ? <button className="toast" type="button" role="status" onClick={() => dispatch({ type: 'clear-notice' })}>{state.notice}</button> : null}
    </>
  )
}

function Manual({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="manual panel" role="dialog" aria-modal="true" aria-labelledby="manual-title">
        <header><p className="eyebrow">PLAYER MANUAL</p><h2 id="manual-title">调查员说明书</h2><button className="text-button" type="button" onClick={onClose}>关闭</button></header>
        <div className="manual-grid">
          <article><span>01</span><h3>目标</h3><p>案件中累积真相并达到目标。时间线降到 0，或悖论达到上限时，整局立即失败。</p></article>
          <article><span>02</span><h3>编排</h3><p>每回合有 3 点能量。选择手牌，再把它放到过去、现在或未来；位置会改变牌效与能否赶在固定事件之前。</p></article>
          <article><span>03</span><h3>结算</h3><p>确认后严格从过去走向未来。执行前可以撤回已经放置的牌，并获得对应能量退款。</p></article>
          <article><span>04</span><h3>构筑</h3><p>「证」积累真相，「因」保护时间线，「改」扭转事件，「锚」固定历史，「悖」以风险换取爆发。</p></article>
          <article><span>05</span><h3>路线</h3><p>案件给卡牌与回声；精英额外给遗物；事件、休整和商店用于修正资源与牌组。</p></article>
          <article><span>06</span><h3>存档</h3><p>每次操作都会自动保存。相同调查种子和相同选择会复现同一条初始路线。</p></article>
        </div>
      </section>
    </div>
  )
}
