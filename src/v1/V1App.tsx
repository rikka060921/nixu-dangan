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

function Manual({ onContinue, onSkip, onClose }: { onContinue: () => void; onSkip: () => void; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="manual" role="dialog" aria-modal="true" aria-labelledby="manual-title">
        <button className="icon-button manual__close" onClick={onClose} aria-label="关闭玩法说明">×</button>
        <p className="eyebrow">新手教程 // 一分钟上手</p>
        <h2 id="manual-title">先做一件事，再看它造成什么结果</h2>
        <div className="manual__steps">
          <article><span>01 · 红色</span><strong>先选择过去</strong><p>就是“你先做什么”。选择后，下方能去的蓝色未来会改变。</p></article>
          <article><span>02 · 蓝色</span><strong>再选择结果</strong><p>就是“这件事后来变成什么”。每条路线都会给战斗加分。</p></article>
          <article><span>03 · 战斗</span><strong>点击一键推荐</strong><p>系统会自动选好最高分的三张牌，你只要点击“开始结算”。</p></article>
        </div>
        <div className="plain-glossary">
          <div><b>档案</b><span>只是故事里对“关卡记录”的叫法。</span></div>
          <div><b>未来回传</b><span>蓝色未来牌给下一张红色过去牌额外加分。</span></div>
          <div><b>红蓝切换</b><span>三张牌颜色来回变化，会自动获得额外分数。</span></div>
        </div>
        <div className="manual__rule"><b>只记住一句话</b><span>红色是准备，蓝色是收分；看不懂牌时直接点“一键推荐”。</span></div>
        <div className="manual__actions">
          <button className="primary-button" onClick={onContinue}>开始分步教程</button>
          <button className="text-button" onClick={onSkip}>跳过教程，直接玩</button>
        </div>
      </section>
    </div>
  )
}

function Header({ state, dispatch, onManual }: { state: GameStateV1; dispatch: Dispatch; onManual: () => void }) {
  const location = state.screen.name === 'title'
    ? '接入终端'
    : state.screen.name === 'ending'
      ? '全部通关'
      : state.run ? `第 ${state.run.chapterIndex + 1} 关 / 共 4 关` : '游戏终端'
  return (
    <header className="v1-header">
      <button className="brand" onClick={() => dispatch({ type: 'return-title' })} aria-label="返回标题页">
        <span className="brand__sigil">逆</span>
        <span><b>逆序档案</b><small>REVERSE ARCHIVE 1.X</small></span>
      </button>
      <span className="header-location">{location}</span>
      <nav className="header-actions" aria-label="全局设置">
        <button className="text-button" onClick={onManual}>新手教程</button>
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
        <p className="title-lead">先选择过去做什么，再看看未来变成什么。进入战斗后选三张牌，轻松打出大数字。</p>
        <div className="title-actions">
          <button className="primary-button primary-button--large" onClick={() => dispatch({ type: 'start-run' })}>开始新游戏</button>
          {state.resumable && <button className="secondary-button secondary-button--large" onClick={() => dispatch({ type: 'resume-run' })}>继续游戏</button>}
        </div>
        <details className="advanced-settings">
          <summary>高级设置：固定随机种子</summary>
          <label className="seed-field">
            <span>随机种子</span>
            <input aria-label="随机种子" value={state.seedInput} onChange={(event) => dispatch({ type: 'set-seed', seed: event.target.value })} />
            <button onClick={() => dispatch({ type: 'randomize-seed' })}>换一组</button>
          </label>
        </details>
      </section>
      <aside className="title-preview" aria-label="双时间线玩法预览">
        <div className="preview-lane preview-lane--past"><span>过去</span><b>留下线索</b><i>01</i></div>
        <div className="preview-link"><span>改变路线</span><b>＋12</b></div>
        <div className="preview-lane preview-lane--future"><span>未来</span><b>未来回传</b><i>02</i></div>
        <div className="preview-burst"><small>本轮得分</small><strong>＋48</strong><span>连锁爆发</span></div>
      </aside>
      <footer className="title-stats">
        <span><b>{state.meta.runs}</b> 已开始游戏</span>
        <span><b>{state.meta.wins}</b> 已完成通关</span>
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
        <div><p className="eyebrow">路线图</p><h1>先选择过去，再选择未来结果</h1></div>
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
                <div className="causal-bridge"><span>{record ? `最高得分 ${record.bestChain}` : active && selectedPast ? '未来选项已改变' : '等待选择过去'}</span></div>
                <div className="route-column__future">
                  {record && selectedFuture
                    ? <RouteNode lane="future" {...selectedFuture} selected disabled />
                    : active && selectedPast
                      ? selectedPast.futures.map((choice) => <RouteNode key={choice.id} lane="future" {...choice} onClick={() => dispatch({ type: 'choose-future', choiceId: choice.id })} />)
                      : <div className="locked-node">{active ? '先选择上方红色选项' : '尚未到达'}</div>}
                </div>
              </article>
            )
          })}
        </section>
        <aside className="case-brief">
          <p className="eyebrow">第 {Number(chapter.number)} 关</p>
          <h2>{chapter.title}</h2>
          <p>{chapter.story}</p>
          <div className="case-target"><span>通关需要达到</span><b>{chapter.target} 分</b></div>
          {state.run.currentPastId ? (
            <div className="route-hint"><b>你的选择改变了未来</b><p>{chapter.pastChoices.find((choice) => choice.id === state.run?.currentPastId)?.result}</p><span>现在选择下方任意一个蓝色结果。</span></div>
          ) : (
            <div className="route-hint"><b>第一步：选择过去</b><p>在上方红色区域任选一件事。没有错误选项，选你喜欢的即可。</p></div>
          )}
          <dl className="run-numbers"><div><dt>拥有卡牌</dt><dd>{state.run.deck.length}</dd></div><div><dt>最高得分</dt><dd>{state.run.bestChain}</dd></div><div><dt>通关保护</dt><dd>{state.run.rewinds}</dd></div></dl>
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
        <div><p className="eyebrow">第 {Number(chapter.number)} 关 // 第 {battle.round} 轮</p><h1>{chapter.title}</h1></div>
        <div className="impact-meter">
          <div><span>本关得分 / 通关目标</span><b>{battle.impact} / {battle.target}</b></div>
          <div className="impact-meter__track"><i style={{ width: `${percent}%` }} /></div>
        </div>
      </header>

      <section className="chain-stage" aria-label="三张牌连锁区">
        <div className="lane-energy lane-energy--past"><TimelineMark lane="past" /><b>{(battle.routeBonus.seeds ?? 0) + (battle.routeBonus.anchors ?? 0)}</b><small>准备加成</small></div>
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
          <div className="chain-preview"><small>预计得到</small><b>{preview?.impact ?? '—'}</b><span>{preview ? '分' : '等待选牌'}</span></div>
        </div>
        <div className="lane-energy lane-energy--future"><TimelineMark lane="future" /><b>{(battle.routeBonus.witnesses ?? 0) + (battle.routeBonus.echoes ?? 0)}</b><small>收分加成</small></div>
      </section>

      {battle.resolution ? (
        <section className="resolution-panel" aria-live="polite">
          <div className="resolution-burst"><span>{battle.resolution.peakLabel}</span><strong>+{battle.resolution.chain}</strong><small>本轮得分</small></div>
          <div className="event-stream">
            {battle.resolution.events.map((event, index) => (
              <div className={`event event--${event.kind}`} key={`${event.title}-${index}`}>
                <i>{String(index + 1).padStart(2, '0')}</i><span><b>{event.title}</b><small>{event.detail}</small></span><strong>+{event.gain}</strong>
              </div>
            ))}
          </div>
          <button className="primary-button primary-button--large" onClick={() => dispatch({ type: 'continue-after-chain' })}>
            {battle.won ? '过关！选择奖励' : '继续下一轮'}
          </button>
        </section>
      ) : (
        <>
          <section className="battle-controls">
            <div><p><b>选择三张牌，然后开始结算。</b> 红蓝颜色交替得越多，分数通常越高。</p><span>看不懂就点右边“一键推荐” · 快捷键 A</span></div>
            <button className="secondary-button" onClick={() => dispatch({ type: 'clear-stage' })}>清空</button>
            <button className="auto-button" onClick={() => dispatch({ type: 'auto-stage' })}><span>系统自动选最高分</span><b>一键推荐</b><kbd>A</kbd></button>
            <button className="primary-button" disabled={stagedCards.length === 0} onClick={() => dispatch({ type: 'resolve-chain' })}>开始结算 <kbd>Enter</kbd></button>
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
        <p className="eyebrow">第 {Number(chapter.number)} 关已通过</p>
        <div className={`rank rank--${state.screen.rank}`}>{state.screen.rank}</div>
        <h1>{state.screen.rank === 'S' ? '超级爆发！' : state.screen.rank === 'A' ? '漂亮过关！' : '已启用新手通关保护'}</h1>
        <p>最高单轮得分 <b>{state.battle.bestChain}</b> · {state.battle.round} 轮完成</p>
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
        <p className="eyebrow">1.X // 首次通关</p>
        <h1>你没有选择唯一历史。<br /><em>你让两个自己同时抵达黎明。</em></h1>
        <p>零时档案已关闭，但每一个被你改变的过去，都还在生成新的未来。</p>
        <div className="ending-numbers"><span><b>{state.run.bestChain}</b>最高单轮得分</span><span><b>{state.run.totalImpact}</b>总得分</span><span><b>{state.run.rewinds}</b>通关保护次数</span></div>
        <div className="ending-actions"><button className="primary-button primary-button--large" onClick={() => dispatch({ type: 'restart' })}>开始新游戏</button><button className="secondary-button secondary-button--large" onClick={() => dispatch({ type: 'return-title' })}>返回首页</button></div>
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

interface BeginnerGuideStep {
  id: 'past' | 'future' | 'auto' | 'resolve' | 'score' | 'reward'
  count: string
  title: string
  body: string
  tip: string
}

function guideStepFor(state: GameStateV1): BeginnerGuideStep | null {
  if (state.screen.name === 'map' && !state.run?.currentPastId) {
    return { id: 'past', count: '1 / 5', title: '先点一个红色选项', body: '红色代表过去，也就是“你先做什么”。两个都能通关，选喜欢的即可。', tip: '选择后，蓝色未来会立刻改变。' }
  }
  if (state.screen.name === 'map' && state.run?.currentPastId) {
    return { id: 'future', count: '2 / 5', title: '再点一个蓝色结果', body: '蓝色代表未来，也就是“这件事后来造成什么结果”。', tip: '路线会自动给下一场战斗加分。' }
  }
  if (state.screen.name === 'battle' && !state.battle?.resolution && state.battle?.stagedUids.length === 0) {
    return { id: 'auto', count: '3 / 5', title: '第一次先用“一键推荐”', body: '系统会替你从五张牌中挑出最高分的三张，并排好顺序。', tip: '以后想研究时，再自己换牌即可。' }
  }
  if (state.screen.name === 'battle' && !state.battle?.resolution) {
    return { id: 'resolve', count: '4 / 5', title: '看看预计分数，然后结算', body: '中间显示这三张牌预计能得到多少分。点击“开始结算”就行。', tip: '牌的红蓝颜色切换越多，通常分数越高。' }
  }
  if (state.screen.name === 'battle' && state.battle?.resolution) {
    return { id: 'score', count: '5 / 5', title: '这些记录只是在解释加分', body: '右侧每一行都写着分数从哪里来。上方进度达到目标就能过关。', tip: '没达到也没关系，继续下一轮即可。' }
  }
  if (state.screen.name === 'reward') {
    return { id: 'reward', count: '完成', title: '教程完成！', body: '现在选一张看起来顺眼的牌。之后仍然可以一直使用“一键推荐”。', tip: '随时点击右上角“新手教程”重新查看。' }
  }
  return null
}

function BeginnerCoach({ step, onSkip }: { step: BeginnerGuideStep; onSkip: () => void }) {
  return (
    <aside className={`beginner-coach beginner-coach--${step.id}`} aria-live="polite">
      <div><span>新手教程 {step.count}</span><button onClick={onSkip}>跳过</button></div>
      <h2>{step.title}</h2>
      <p>{step.body}</p>
      <small>{step.tip}</small>
    </aside>
  )
}

export function ArchiveV1() {
  const { state, dispatch } = useArchiveV1()
  const [manualOpen, setManualOpen] = useState(!state.meta.tutorialDone)
  const [tutorialActive, setTutorialActive] = useState(!state.meta.tutorialDone)
  const guideStep = tutorialActive ? guideStepFor(state) : null

  const closeManual = () => {
    setManualOpen(false)
  }

  const continueTutorial = () => {
    setTutorialActive(true)
    setManualOpen(false)
  }

  const skipTutorial = () => {
    setTutorialActive(false)
    setManualOpen(false)
    if (!state.meta.tutorialDone) dispatch({ type: 'complete-tutorial' })
  }

  useEffect(() => {
    if (!manualOpen) return undefined
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setManualOpen(false)
    }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [manualOpen])

  useEffect(() => {
    if (!tutorialActive || !state.run || state.run.chapterIndex === 0) return
    setTutorialActive(false)
    if (!state.meta.tutorialDone) dispatch({ type: 'complete-tutorial' })
  }, [dispatch, state.meta.tutorialDone, state.run, tutorialActive])

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
    <div className={`archive-v1 screen--${state.screen.name} ${guideStep ? `tutorial-step--${guideStep.id}` : ''}`}>
      <Header state={state} dispatch={dispatch} onManual={() => setManualOpen(true)} />
      {state.screen.name === 'title' && <TitleScreen state={state} dispatch={dispatch} />}
      {state.screen.name === 'map' && <MapScreen state={state} dispatch={dispatch} />}
      {state.screen.name === 'battle' && <BattleScreen state={state} dispatch={dispatch} />}
      {state.screen.name === 'reward' && <RewardScreen state={state} dispatch={dispatch} />}
      {state.screen.name === 'ending' && <EndingScreen state={state} dispatch={dispatch} />}
      {state.notice && <button className="notice" onClick={() => dispatch({ type: 'clear-notice' })}>{state.notice}<span>×</span></button>}
      {guideStep && <BeginnerCoach step={guideStep} onSkip={skipTutorial} />}
      {manualOpen && <Manual onContinue={continueTutorial} onSkip={skipTutorial} onClose={closeManual} />}
    </div>
  )
}
