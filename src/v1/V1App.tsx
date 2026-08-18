import { useEffect, useMemo, useState } from 'react'

import { MAX_SOUND_VOLUME, MIN_SOUND_VOLUME } from '../game/audioSettings'
import { CHAPTERS_V1, V1_CARDS } from './content'
import { currentChapter, resolvePlan, suggestPlan } from './engine'
import type { CardInstanceV1, GameActionV1, GameStateV1, TimelineLane, V1CardId } from './types'
import { useArchiveV1 } from './useArchiveV1'

type Dispatch = (action: GameActionV1) => void

function TimelineMark({ lane }: { lane: TimelineLane }) {
  return <span className={`lane-mark lane-mark--${lane}`}>{lane === 'past' ? '过去' : '未来'}</span>
}

function CardFace({ cardId, compact = false }: { cardId: V1CardId; compact?: boolean }) {
  const card = V1_CARDS[cardId]
  return (
    <div className={`v1-card__face v1-card__face--${card.lane} ${compact ? 'v1-card__face--compact' : ''}`}>
      <div className="v1-card__top"><TimelineMark lane={card.lane} /><span>{card.rarity}</span></div>
      <span className="v1-card__glyph" aria-hidden="true">{card.glyph}</span>
      <strong>{card.name}</strong>
      {!compact && <><span className="v1-card__brief">{card.brief}</span><small>{card.link}</small></>}
    </div>
  )
}

function Manual({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="manual" role="dialog" aria-modal="true" aria-labelledby="manual-title">
        <button className="icon-button manual__close" onClick={onClose} aria-label="关闭玩法说明">×</button>
        <p className="eyebrow">1.X // 三分钟上手</p>
        <h2 id="manual-title">不用算，也能把时间线炸穿</h2>
        <div className="manual__steps">
          <article><span>01</span><strong>先改过去</strong><p>地图上点一个过去事件，它会换掉右侧可到达的未来。</p></article>
          <article><span>02</span><strong>再选未来</strong><p>路线自带伏笔、证人和回声，会直接进入下一场战斗。</p></article>
          <article><span>03</span><strong>一键爽打</strong><p>系统自动找出三张牌的最高连锁。想钻研时，再自己调整顺序。</p></article>
        </div>
        <div className="manual__rule"><b>最直观的规律</b><span>过去 → 未来 → 过去，来回换线就会不断加速。</span></div>
        <button className="primary-button" onClick={onClose}>接通双线</button>
      </section>
    </div>
  )
}

function Header({ state, dispatch, onManual }: { state: GameStateV1; dispatch: Dispatch; onManual: () => void }) {
  const location = state.screen.name === 'title'
    ? '接入终端'
    : state.screen.name === 'ending'
      ? '零时闭环'
      : state.run ? `档案 ${String(state.run.chapterIndex + 1).padStart(2, '0')} / 04` : '双线终端'
  return (
    <header className="v1-header">
      <button className="brand" onClick={() => dispatch({ type: 'return-title' })} aria-label="返回标题页">
        <span className="brand__sigil">逆</span>
        <span><b>逆序档案</b><small>REVERSE ARCHIVE 1.X</small></span>
      </button>
      <span className="header-location">{location}</span>
      <nav className="header-actions" aria-label="全局设置">
        <button className="text-button" onClick={onManual}>玩法</button>
        <details className="sound-control">
          <summary aria-label="打开音量设置">音量 {state.meta.soundVolume}%</summary>
          <div className="sound-panel">
            <div><b>全局音量</b><output>{state.meta.soundVolume}%</output></div>
            <input
              aria-label="全局音量"
              type="range"
              min={MIN_SOUND_VOLUME}
              max={MAX_SOUND_VOLUME}
              value={state.meta.soundVolume}
              onChange={(event) => dispatch({ type: 'set-sound-volume', volume: Number(event.target.value) })}
            />
            <button className="secondary-button" onClick={() => dispatch({ type: 'toggle-sound' })}>
              {state.meta.soundEnabled ? '音乐与音效：开' : '音乐与音效：关'}
            </button>
          </div>
        </details>
      </nav>
    </header>
  )
}

function TitleScreen({ state, dispatch }: { state: GameStateV1; dispatch: Dispatch }) {
  return (
    <main className="title-screen">
      <div className="title-orbit title-orbit--past" aria-hidden="true" />
      <div className="title-orbit title-orbit--future" aria-hidden="true" />
      <section className="title-copy">
        <p className="eyebrow">双时间线连锁卡牌爽游</p>
        <h1>过去制造事实。<br /><em>未来把答案送回来。</em></h1>
        <p className="title-lead">同时操纵过去与未来，让一个选择改变下一条路线，再用三张牌引爆整条因果链。</p>
        <div className="title-actions">
          <button className="primary-button primary-button--large" onClick={() => dispatch({ type: 'start-run' })}>新建双线档案</button>
          {state.resumable && <button className="secondary-button secondary-button--large" onClick={() => dispatch({ type: 'resume-run' })}>继续上次断点</button>}
        </div>
        <label className="seed-field">
          <span>档案种子</span>
          <input aria-label="档案种子" value={state.seedInput} onChange={(event) => dispatch({ type: 'set-seed', seed: event.target.value })} />
          <button onClick={() => dispatch({ type: 'randomize-seed' })}>换一组</button>
        </label>
      </section>
      <aside className="title-preview" aria-label="双时间线玩法预览">
        <div className="preview-lane preview-lane--past"><span>过去</span><b>埋下伏笔</b><i>01</i></div>
        <div className="preview-link"><span>改变路线</span><b>＋12</b></div>
        <div className="preview-lane preview-lane--future"><span>未来</span><b>答案回流</b><i>02</i></div>
        <div className="preview-burst"><small>因果闭环</small><strong>× 48</strong><span>双线爆发</span></div>
      </aside>
      <footer className="title-stats">
        <span><b>{state.meta.runs}</b> 已开启档案</span>
        <span><b>{state.meta.wins}</b> 已完成闭环</span>
        <span><b>{state.meta.bestChain}</b> 历史最高连锁</span>
      </footer>
    </main>
  )
}

function RouteNode({
  lane, title, glyph, brief, selected, disabled, onClick,
}: {
  lane: TimelineLane; title: string; glyph: string; brief: string; selected?: boolean; disabled?: boolean; onClick?: () => void
}) {
  return (
    <button
      className={`route-node route-node--${lane} ${selected ? 'is-selected' : ''}`}
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
    >
      <span className="route-node__glyph">{glyph}</span>
      <span><b>{title}</b><small>{brief}</small></span>
    </button>
  )
}

function MapScreen({ state, dispatch }: { state: GameStateV1; dispatch: Dispatch }) {
  if (!state.run) return null
  const chapter = currentChapter(state.run)
  return (
    <main className="map-screen">
      <header className="screen-heading">
        <div><p className="eyebrow">双线案件地图</p><h1>改变过去，打开不同的未来</h1></div>
        <div className="map-legend"><TimelineMark lane="past" /><span>影响</span><TimelineMark lane="future" /></div>
      </header>
      <div className="map-layout">
        <section className="timeline-map" aria-label="四章双时间线路线">
          <div className="timeline-axis timeline-axis--past"><span>PAST</span></div>
          <div className="timeline-axis timeline-axis--future"><span>FUTURE</span></div>
          {CHAPTERS_V1.map((item, index) => {
            const record = state.run?.records.find((entry) => entry.chapterId === item.id)
            const active = index === state.run?.chapterIndex
            const locked = index > (state.run?.chapterIndex ?? 0)
            const selectedPastId = record?.pastId ?? (active ? state.run?.currentPastId : undefined)
            const selectedPast = item.pastChoices.find((choice) => choice.id === selectedPastId)
            const selectedFuture = selectedPast?.futures.find((choice) => choice.id === record?.futureId)
            return (
              <article className={`route-column ${active ? 'is-active' : ''} ${locked ? 'is-locked' : ''}`} key={item.id}>
                <header><span>{item.number}</span><b>{item.title}</b>{record && <i>{record.rank}</i>}</header>
                <div className="route-column__past">
                  {record && selectedPast
                    ? <RouteNode lane="past" {...selectedPast} selected disabled />
                    : active
                      ? item.pastChoices.map((choice) => <RouteNode key={choice.id} lane="past" {...choice} selected={choice.id === selectedPastId} onClick={() => dispatch({ type: 'choose-past', choiceId: choice.id })} />)
                      : <div className="locked-node">等待抵达</div>}
                </div>
                <div className="causal-bridge"><span>{record ? `连锁 ${record.bestChain}` : active && selectedPast ? '未来已改写' : '因果未写入'}</span></div>
                <div className="route-column__future">
                  {record && selectedFuture
                    ? <RouteNode lane="future" {...selectedFuture} selected disabled />
                    : active && selectedPast
                      ? selectedPast.futures.map((choice) => <RouteNode key={choice.id} lane="future" {...choice} onClick={() => dispatch({ type: 'choose-future', choiceId: choice.id })} />)
                      : <div className="locked-node">{active ? '先改变过去' : '未来不可见'}</div>}
                </div>
              </article>
            )
          })}
        </section>
        <aside className="case-brief">
          <p className="eyebrow">CASE {chapter.number}</p>
          <h2>{chapter.title}</h2>
          <p>{chapter.story}</p>
          <div className="case-target"><span>闭环目标</span><b>{chapter.target}</b></div>
          {state.run.currentPastId ? (
            <div className="route-hint"><b>过去已被改写</b><p>{chapter.pastChoices.find((choice) => choice.id === state.run?.currentPastId)?.result}</p><span>请在下方选择一个新未来。</span></div>
          ) : (
            <div className="route-hint"><b>第一步很简单</b><p>在红色过去线上任选一个事件。没有错误路线，只有不同的爆发方式。</p></div>
          )}
          <dl className="run-numbers"><div><dt>牌库</dt><dd>{state.run.deck.length}</dd></div><div><dt>最高连锁</dt><dd>{state.run.bestChain}</dd></div><div><dt>回溯</dt><dd>{state.run.rewinds}</dd></div></dl>
        </aside>
      </div>
    </main>
  )
}

function BattleCard({
  instance, index, stagedIndex, recommended, disabled, onClick,
}: {
  instance: CardInstanceV1; index: number; stagedIndex: number; recommended: boolean; disabled: boolean; onClick: () => void
}) {
  const selected = stagedIndex >= 0
  return (
    <button
      className={`v1-card ${selected ? 'is-staged' : ''} ${recommended && !selected ? 'is-recommended' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={`${index + 1}：${V1_CARDS[instance.cardId].name}${selected ? `，连锁第 ${stagedIndex + 1} 张` : ''}`}
    >
      {selected && <span className="stage-order">{stagedIndex + 1}</span>}
      {recommended && !selected && <span className="recommend-mark">推荐</span>}
      <CardFace cardId={instance.cardId} />
      <kbd>{index + 1}</kbd>
    </button>
  )
}

function BattleScreen({ state, dispatch }: { state: GameStateV1; dispatch: Dispatch }) {
  const battle = state.battle
  const run = state.run
  if (!battle || !run) return null
  const chapter = currentChapter(run)
  const stagedCards = battle.stagedUids
    .map((uid) => battle.hand.find((card) => card.uid === uid))
    .filter((card): card is CardInstanceV1 => Boolean(card))
  const suggestion = suggestPlan(battle.hand, battle.routeBonus)
  const preview = stagedCards.length > 0 ? resolvePlan(stagedCards, battle.routeBonus) : null
  const percent = Math.min(100, Math.round((battle.impact / battle.target) * 100))

  return (
    <main className={`battle-screen ${battle.resolution ? 'is-resolving' : ''}`}>
      <header className="battle-heading">
        <div><p className="eyebrow">CASE {chapter.number} // ROUND {battle.round}</p><h1>{chapter.title}</h1></div>
        <div className="impact-meter">
          <div><span>闭环进度</span><b>{battle.impact} / {battle.target}</b></div>
          <div className="impact-meter__track"><i style={{ width: `${percent}%` }} /></div>
        </div>
      </header>

      <section className="chain-stage" aria-label="三张牌连锁区">
        <div className="lane-energy lane-energy--past"><TimelineMark lane="past" /><b>{(battle.routeBonus.seeds ?? 0) + (battle.routeBonus.anchors ?? 0)}</b><small>起因能量</small></div>
        <div className="chain-slots">
          {[0, 1, 2].map((index) => {
            const instance = stagedCards[index]
            return (
              <div className={`chain-slot ${instance ? `chain-slot--${V1_CARDS[instance.cardId].lane}` : ''}`} key={index}>
                <span>{index + 1}</span>
                {instance ? <CardFace cardId={instance.cardId} compact /> : <small>选择手牌</small>}
              </div>
            )
          })}
          <div className="chain-preview"><small>预计爆发</small><b>{preview?.impact ?? '—'}</b><span>{preview?.peakLabel ?? '等待连锁'}</span></div>
        </div>
        <div className="lane-energy lane-energy--future"><TimelineMark lane="future" /><b>{(battle.routeBonus.witnesses ?? 0) + (battle.routeBonus.echoes ?? 0)}</b><small>结果能量</small></div>
      </section>

      {battle.resolution ? (
        <section className="resolution-panel" aria-live="polite">
          <div className="resolution-burst"><span>{battle.resolution.peakLabel}</span><strong>+{battle.resolution.chain}</strong><small>本轮因果冲击</small></div>
          <div className="event-stream">
            {battle.resolution.events.map((event, index) => (
              <div className={`event event--${event.kind}`} key={`${event.title}-${index}`}>
                <i>{String(index + 1).padStart(2, '0')}</i><span><b>{event.title}</b><small>{event.detail}</small></span><strong>+{event.gain}</strong>
              </div>
            ))}
          </div>
          <button className="primary-button primary-button--large" onClick={() => dispatch({ type: 'continue-after-chain' })}>
            {battle.won ? '领取闭环奖励' : '展开下一轮'}
          </button>
        </section>
      ) : (
        <>
          <section className="battle-controls">
            <div><p><b>点三张牌，按顺序闭合。</b> 来回切换红蓝时间线，连锁会自动变大。</p><span>快捷键：1—5 选牌 · A 一键爽打 · Enter 引爆</span></div>
            <button className="secondary-button" onClick={() => dispatch({ type: 'clear-stage' })}>清空</button>
            <button className="auto-button" onClick={() => dispatch({ type: 'auto-stage' })}><span>不想算？</span><b>一键爽打</b><kbd>A</kbd></button>
            <button className="primary-button" disabled={stagedCards.length === 0} onClick={() => dispatch({ type: 'resolve-chain' })}>闭合双线 <kbd>Enter</kbd></button>
          </section>
          <section className="hand" aria-label="本轮手牌">
            {battle.hand.map((instance, index) => (
              <BattleCard
                key={instance.uid}
                instance={instance}
                index={index}
                stagedIndex={battle.stagedUids.indexOf(instance.uid)}
                recommended={suggestion.includes(instance.uid)}
                disabled={false}
                onClick={() => dispatch({ type: 'toggle-stage', uid: instance.uid })}
              />
            ))}
          </section>
        </>
      )}
    </main>
  )
}

function RewardScreen({ state, dispatch }: { state: GameStateV1; dispatch: Dispatch }) {
  if (state.screen.name !== 'reward' || !state.run || !state.battle) return null
  const chapter = currentChapter(state.run)
  return (
    <main className="reward-screen">
      <section className="reward-summary">
        <p className="eyebrow">档案 {chapter.number} 已闭合</p>
        <div className={`rank rank--${state.screen.rank}`}>{state.screen.rank}</div>
        <h1>{state.screen.rank === 'S' ? '时间线被你彻底炸穿' : state.screen.rank === 'A' ? '漂亮的双线闭环' : '紧急回溯也算一种胜利'}</h1>
        <p>最高连锁 <b>{state.battle.bestChain}</b> · {state.battle.round} 轮完成</p>
      </section>
      <section className="reward-pick">
        <header><p className="eyebrow">选择一张加入牌库</p><h2>带走新的失控手段</h2></header>
        <div className="reward-cards">
          {state.screen.options.map((cardId) => (
            <button className="reward-card" key={cardId} onClick={() => dispatch({ type: 'choose-reward', cardId })}>
              <CardFace cardId={cardId} /><span>加入牌库</span>
            </button>
          ))}
        </div>
        <button className="text-button" onClick={() => dispatch({ type: 'skip-reward' })}>不拿牌，直接前往下一案</button>
      </section>
    </main>
  )
}

function EndingScreen({ state, dispatch }: { state: GameStateV1; dispatch: Dispatch }) {
  if (!state.run) return null
  return (
    <main className="ending-screen">
      <div className="ending-halo" aria-hidden="true" />
      <section className="ending-copy">
        <p className="eyebrow">1.X // 首次双线闭环</p>
        <h1>你没有选择唯一历史。<br /><em>你让两个自己同时抵达黎明。</em></h1>
        <p>零时档案已关闭，但每一个被你改变的过去，都还在生成新的未来。</p>
        <div className="ending-numbers"><span><b>{state.run.bestChain}</b>最高连锁</span><span><b>{state.run.totalImpact}</b>总因果冲击</span><span><b>{state.run.rewinds}</b>紧急回溯</span></div>
        <div className="ending-actions"><button className="primary-button primary-button--large" onClick={() => dispatch({ type: 'restart' })}>开启新档案</button><button className="secondary-button secondary-button--large" onClick={() => dispatch({ type: 'return-title' })}>返回终端</button></div>
      </section>
      <section className="ending-records" aria-label="本局路线记录">
        <p className="eyebrow">你的双线记录</p>
        {state.run.records.map((record, index) => {
          const chapter = CHAPTERS_V1.find((item) => item.id === record.chapterId)
          const past = chapter?.pastChoices.find((choice) => choice.id === record.pastId)
          const future = past?.futures.find((choice) => choice.id === record.futureId)
          return <article key={record.chapterId}><span>{String(index + 1).padStart(2, '0')}</span><div><b>{past?.title}</b><i>改变了</i><b>{future?.title}</b></div><strong>{record.rank}</strong></article>
        })}
      </section>
    </main>
  )
}

export function ArchiveV1() {
  const { state, dispatch } = useArchiveV1()
  const [manualOpen, setManualOpen] = useState(!state.meta.tutorialDone)

  const closeManual = () => {
    setManualOpen(false)
    if (!state.meta.tutorialDone) dispatch({ type: 'complete-tutorial' })
  }

  const battleKeys = useMemo(() => state.screen.name === 'battle' ? state.battle : null, [state.screen.name, state.battle])
  useEffect(() => {
    if (!battleKeys) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement) return
      if (event.key >= '1' && event.key <= '5' && !battleKeys.resolution) {
        const card = battleKeys.hand[Number(event.key) - 1]
        if (card) dispatch({ type: 'toggle-stage', uid: card.uid })
      }
      if (event.key.toLowerCase() === 'a' && !battleKeys.resolution) dispatch({ type: 'auto-stage' })
      if (event.key === 'Enter') dispatch({ type: battleKeys.resolution ? 'continue-after-chain' : 'resolve-chain' })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [battleKeys, dispatch])

  return (
    <div className={`archive-v1 screen--${state.screen.name}`}>
      <Header state={state} dispatch={dispatch} onManual={() => setManualOpen(true)} />
      {state.screen.name === 'title' && <TitleScreen state={state} dispatch={dispatch} />}
      {state.screen.name === 'map' && <MapScreen state={state} dispatch={dispatch} />}
      {state.screen.name === 'battle' && <BattleScreen state={state} dispatch={dispatch} />}
      {state.screen.name === 'reward' && <RewardScreen state={state} dispatch={dispatch} />}
      {state.screen.name === 'ending' && <EndingScreen state={state} dispatch={dispatch} />}
      {state.notice && <button className="notice" onClick={() => dispatch({ type: 'clear-notice' })}>{state.notice}<span>×</span></button>}
      {manualOpen && <Manual onClose={closeManual} />}
    </div>
  )
}
