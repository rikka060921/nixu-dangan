import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import type { GameState, RunState } from './domain/types'
import { effectiveCost } from './domain/battle'
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
  const [tutorialStep, setTutorialStep] = useState(0)
  const [tutorialReplay, setTutorialReplay] = useState(false)
  const tutorialOpen = tutorialReplay || Boolean(!state.meta.tutorialDone && state.run && state.run.floor === 0 && state.screen.name === 'map')
  const screenFocusKey = state.screen.name === 'rest'
    ? `rest:${state.screen.removing}:${state.screen.upgrading}`
    : state.screen.name === 'shop'
      ? `shop:${state.screen.shop.removing}:${state.screen.shop.upgrading}:${state.screen.shop.bought.join(',')}`
      : state.screen.name === 'battle'
        ? `battle:${state.battle?.round ?? 0}`
        : state.screen.name
  const screenRef = useRef<HTMLDivElement>(null)
  const previousScreenFocusKey = useRef(screenFocusKey)
  const manualReturnFocus = useRef<HTMLElement | null>(null)
  const restoreManualFocus = useRef(false)

  const openManual = () => {
    manualReturnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setManualOpen(true)
  }

  const closeManual = () => {
    restoreManualFocus.current = true
    setManualOpen(false)
  }

  useLayoutEffect(() => {
    if (!manualOpen && restoreManualFocus.current) manualReturnFocus.current?.focus()
  }, [manualOpen])

  useEffect(() => {
    if (!state.notice) return
    const timer = window.setTimeout(() => dispatch({ type: 'clear-notice' }), 3200)
    return () => window.clearTimeout(timer)
  }, [dispatch, state.notice])

  useEffect(() => {
    const screenChanged = previousScreenFocusKey.current !== screenFocusKey
    previousScreenFocusKey.current = screenFocusKey
    if (restoreManualFocus.current) {
      restoreManualFocus.current = false
      return
    }
    if (!manualOpen && !tutorialOpen && (state.screen.name !== 'title' || screenChanged)) screenRef.current?.focus()
  }, [manualOpen, screenFocusKey, tutorialOpen])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (manualOpen) {
        if (event.key === 'Escape') closeManual()
        return
      }
      if (tutorialOpen) return
      if (event.key === '?') {
        event.preventDefault()
        openManual()
        return
      }
      if (target?.closest('button, a, [role="button"], [contenteditable="true"]')) return
      if (state.screen.name !== 'battle' || !state.battle) return

      const cardIndex = Number(event.key) - 1
      if (Number.isInteger(cardIndex) && cardIndex >= 0 && cardIndex < state.battle.hand.length) {
        const card = state.battle.hand[cardIndex]
        const used = state.battle.placed.some((placed) => placed.uid === card.uid)
        if (!state.run || used || effectiveCost(state.run, state.battle, card) > state.battle.energy) return
        event.preventDefault()
        dispatch({ type: 'select-card', uid: card.uid })
        return
      }
      const era = ({ q: 0, w: 1, e: 2 } as const)[event.key.toLowerCase() as 'q' | 'w' | 'e']
      if (era !== undefined && state.battle.selectedUid) {
        event.preventDefault()
        dispatch({ type: 'place-card', era })
        return
      }
      if (event.key === 'Backspace' && state.battle.placed.length) {
        event.preventDefault()
        dispatch({ type: 'remove-placed', uid: state.battle.placed.at(-1)!.uid })
        return
      }
      if (event.key === 'Enter' && state.battle.placed.length) {
        event.preventDefault()
        dispatch({ type: 'resolve-timeline' })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [dispatch, manualOpen, state.battle, state.run, state.screen.name, tutorialOpen])

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
      <main className="app-shell" aria-hidden={manualOpen || tutorialOpen ? true : undefined} inert={manualOpen || tutorialOpen}>
        <Header state={state} dispatch={dispatch} onOpenManual={openManual} />
        {state.run && state.screen.name !== 'ending' ? <Hud run={state.run} meta={state.meta} /> : null}
        <div ref={screenRef} className="screen-focus" role="region" aria-label={SCREEN_LABELS[state.screen.name]} tabIndex={-1}>{content}</div>
      </main>
      {manualOpen ? (
        <Manual
          onClose={closeManual}
          onReplayTutorial={() => {
            setManualOpen(false)
            setTutorialStep(0)
            setTutorialReplay(true)
          }}
        />
      ) : null}
      {tutorialOpen ? (
        <TutorialOverlay
          step={tutorialStep}
          onNext={() => setTutorialStep((current) => Math.min(TUTORIAL_STEPS.length - 1, current + 1))}
          onComplete={() => {
            setTutorialReplay(false)
            dispatch({ type: 'complete-tutorial' })
          }}
        />
      ) : null}
      {state.notice && !manualOpen && !tutorialOpen ? <div className="toast" role="status" aria-live="polite"><span>{state.notice}</span><button type="button" aria-label="关闭提示" onClick={() => dispatch({ type: 'clear-notice' })}>×</button></div> : null}
    </>
  )
}

function Manual({ onClose, onReplayTutorial }: { onClose: () => void; onReplayTutorial: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  useDialogFocus(dialogRef, closeRef, onClose)
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={dialogRef} className="manual panel" role="dialog" aria-modal="true" aria-labelledby="manual-title">
        <header><p className="eyebrow">PLAYER MANUAL</p><h2 id="manual-title">调查员说明书</h2><button ref={closeRef} className="text-button" type="button" onClick={onClose}>关闭</button></header>
        <div className="manual-grid">
          <article><span>01</span><h3>目标</h3><p>案件中累积真相并达到目标。时间线降到 0，或悖论达到上限时，整局立即失败。</p></article>
          <article><span>02</span><h3>编排</h3><p>每回合有 3 点能量。选择手牌，再把它放到过去、现在或未来；位置会改变牌效与能否赶在固定事件之前。</p></article>
          <article><span>03</span><h3>结算</h3><p>确认后严格从过去走向未来。执行前可以撤回已经放置的牌，并获得对应能量退款。</p></article>
          <article><span>04</span><h3>构筑</h3><p>「证」积累真相，「因」保护时间线，「改」扭转事件，「锚」固定历史，「悖」以风险换取爆发。</p></article>
          <article><span>05</span><h3>路线</h3><p>案件给卡牌与回声；精英额外给遗物；事件、休整和商店用于修正资源与牌组。</p></article>
          <article><span>06</span><h3>输入、声音与存档</h3><p>战斗中用 1–5 选牌、Q/W/E 选择时代、Backspace 撤回、Enter 结算。按 ? 打开本说明；声音可在顶部关闭，每次操作都会自动保存。</p></article>
        </div>
        <footer className="manual-footer"><button className="text-button" type="button" onClick={onReplayTutorial}>重看首次引导</button></footer>
      </section>
    </div>
  )
}

const TUTORIAL_STEPS = [
  { mark: '01', title: '让真相达到案件目标', body: '你不需要击倒敌人。每份案件都要求积累真相；时间线降到 0 或悖论达到上限，整次调查立即失败。' },
  { mark: '02', title: '路线就是长期代价', body: '每层在案件与事件、休整或商店之间选择。案件提供卡牌和回声；非战斗节点用于修复、降悖论、删牌与升级。' },
  { mark: '03', title: '先编排，再从过去结算', body: '战斗中先选择手牌，再放到过去、现在或未来。确认后严格按时代前进，同一时代里你的行动先于固定事件。' },
  { mark: '04', title: '读懂事件，而不是猜答案', body: '固定事件会明确写出威胁。卡牌预览会说明每个时代的真实结果；你可以在结算前撤回，并收回对应能量。' },
] as const

function TutorialOverlay({ step, onNext, onComplete }: { step: number; onNext: () => void; onComplete: () => void }) {
  const primaryRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const page = TUTORIAL_STEPS[step]
  const last = step === TUTORIAL_STEPS.length - 1
  useDialogFocus(dialogRef, primaryRef, onComplete)
  useEffect(() => primaryRef.current?.focus(), [step])
  return (
    <div className="modal-backdrop tutorial-backdrop">
      <section ref={dialogRef} className="tutorial-card panel" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
        <div className="tutorial-progress" role="progressbar" aria-label="首次引导进度" aria-valuemin={1} aria-valuemax={TUTORIAL_STEPS.length} aria-valuenow={step + 1}>
          {TUTORIAL_STEPS.map((_, index) => <i className={index <= step ? 'is-active' : ''} key={index} />)}
        </div>
        <span className="tutorial-mark" aria-hidden="true">{page.mark}</span>
        <p className="eyebrow">FIRST INVESTIGATION · {step + 1}/{TUTORIAL_STEPS.length}</p>
        <h2 id="tutorial-title">{page.title}</h2>
        <p>{page.body}</p>
        <footer>
          <button className="text-button" type="button" onClick={onComplete}>跳过引导</button>
          <button ref={primaryRef} className="tutorial-next" type="button" onClick={last ? onComplete : onNext}>{last ? '开始调查' : '下一步'}</button>
        </footer>
      </section>
    </div>
  )
}

const SCREEN_LABELS: Record<GameState['screen']['name'], string> = {
  title: '标题页',
  map: '调查路线',
  battle: '案件战斗',
  event: '异常事件',
  rest: '休整',
  shop: '商店',
  reward: '案件奖励',
  chapter: '章节结案',
  ending: '调查结局',
}

function useDialogFocus(
  containerRef: { current: HTMLElement | null },
  initialRef: { current: HTMLElement | null },
  onEscape: () => void,
) {
  const onEscapeRef = useRef(onEscape)
  useLayoutEffect(() => {
    onEscapeRef.current = onEscape
  }, [onEscape])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    initialRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onEscapeRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = [...container.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex="-1"])')]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable.at(-1)!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    container.addEventListener('keydown', onKeyDown)
    return () => container.removeEventListener('keydown', onKeyDown)
  }, [containerRef, initialRef])
}
