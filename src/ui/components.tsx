import type { Dispatch, ReactNode } from 'react'

import { CARDS, KIND_NAMES } from '../content/cards'
import { ACT_NAMES, CHALLENGES, RELICS } from '../content/gameContent'
import { effectiveCost } from '../domain/battle'
import type { BattleState, CardInstance, GameState, RunState } from '../domain/types'
import type { GameAction } from '../game/reducer'

export type GameDispatch = Dispatch<GameAction>

export function Header({
  state,
  dispatch,
  onOpenManual,
}: {
  state: GameState
  dispatch: GameDispatch
  onOpenManual: () => void
}) {
  const title =
    state.screen.name === 'title'
      ? '档案馆 · 23:57'
      : state.screen.name === 'map'
        ? '白塔城 · 路线图'
        : state.screen.name === 'battle'
          ? '案件调查中'
          : state.screen.name === 'ending'
            ? '档案结算'
            : '灾难循环'

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-seal" aria-hidden="true">逆</span>
        <span className="brand-copy">
          <span className="eyebrow">CAUSAL ROGUELIKE</span>
          <strong>逆序档案</strong>
        </span>
      </div>
      <nav className="top-actions" aria-label="全局操作">
        <span className="top-location">{title}</span>
        <button className="text-button" type="button" onClick={onOpenManual}>游戏说明</button>
        {state.screen.name !== 'title' && state.screen.name !== 'ending' ? (
          <button className="text-button" type="button" onClick={() => dispatch({ type: 'return-title' })}>返回标题</button>
        ) : null}
      </nav>
    </header>
  )
}

export function Hud({ run, meta }: { run: RunState; meta: GameState['meta'] }) {
  const act = Math.min(ACT_NAMES.length - 1, Math.floor(run.floor / 6))
  const stats = [
    ['时间线', `${run.timeline}/${run.maxTimeline}`, 'timeline'],
    ['悖论', `${run.paradox}/${run.paradoxLimit}`, 'paradox'],
    ['牌组', String(run.deck.length), 'deck'],
    ['回声', String(run.echoes), 'echoes'],
    ['墨痕', String(meta.ink), 'ink'],
  ]
  return (
    <section className="hud" aria-label="调查状态">
      <p className="mission">
        <b>调查进度 {Math.min(run.floor + 1, run.layers.length)} / {run.layers.length}</b>
        <span>第{['一', '二', '三'][act]}幕「{ACT_NAMES[act]}」 · {run.currentTitle} · {CHALLENGES[run.mode].name} · 种子 {run.seed}</span>
      </p>
      <dl className="stat-grid">
        {stats.map(([label, value, className]) => (
          <div className={`stat stat-${className}`} key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export function PrimaryButton({ children, disabled, onClick }: { children: ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button className="primary-button" type="button" disabled={disabled} onClick={onClick}>
      <span>{children}</span><b aria-hidden="true">→</b>
    </button>
  )
}

export function CardButton({
  card,
  run,
  battle,
  used = false,
  reward = false,
  onClick,
}: {
  card: CardInstance
  run?: RunState
  battle?: BattleState
  used?: boolean
  reward?: boolean
  onClick: () => void
}) {
  const definition = CARDS[card.cardId]
  const cost = run && battle ? effectiveCost(run, battle, card) : definition.cost
  const disabled = !reward && Boolean(battle && (used || battle.energy < cost))
  return (
    <button
      className={`card card-${definition.kind} ${card.upgraded ? 'is-upgraded' : ''} ${battle?.selectedUid === card.uid ? 'is-selected' : ''} ${reward ? 'reward-card' : ''}`}
      data-testid={`card-${card.uid}`}
      type="button"
      disabled={disabled}
      aria-pressed={battle ? battle.selectedUid === card.uid : undefined}
      onClick={onClick}
    >
      <span className="card-topline">
        <b className="card-cost">{cost}</b>
        <span>{card.upgraded ? '已升级 · ' : ''}{definition.rarity} · {definition.kind} · {KIND_NAMES[definition.kind]}</span>
      </span>
      <span className="card-art" aria-hidden="true">{definition.name[0]}</span>
      <strong className="card-name">{definition.name}{card.upgraded ? ' +' : ''}</strong>
      <span className="card-rule">{card.upgraded ? definition.upgradeText : definition.text}</span>
      <em>{definition.flavor}</em>
    </button>
  )
}

export function SideArchive({ run }: { run: RunState }) {
  return (
    <aside className="archive-side panel">
      <section>
        <p className="eyebrow">RELICS</p>
        <h3>随身遗物 · {run.relics.length}</h3>
        <div className="compact-list">
          {run.relics.length ? run.relics.map((id) => (
            <p className="relic-line" key={id}><b>{RELICS[id].name}</b><span>{RELICS[id].text}</span></p>
          )) : <p className="relic-line"><b>断墨砚</b><span>记录每一次失败，但不替你承担结果。</span></p>}
        </div>
      </section>
      <section>
        <p className="eyebrow">DECK</p>
        <h3>当前牌组 · {run.deck.length} 张</h3>
        <div className="deck-mini">
          {run.deck.slice(0, 10).map((deckCard, index) => {
            const card = CARDS[deckCard.cardId]
            return <span className={`mini-card card-${card.kind} ${deckCard.upgraded ? 'is-upgraded' : ''}`} key={`${deckCard.cardId}-${index}`}>{card.kind} · {card.name}{deckCard.upgraded ? ' +' : ''}</span>
          })}
        </div>
      </section>
      <section>
        <p className="eyebrow">TRACES</p>
        <h3>追踪线索</h3>
        <ol className="story-log">
          {run.story.slice(-5).map((line, index) => <li key={`${line}-${index}`}>{line}</li>)}
        </ol>
      </section>
    </aside>
  )
}
