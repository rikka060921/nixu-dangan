import { CARDS } from '../content/cards'
import { EVENTS } from '../content/events'
import { ACT_MISSIONS, ACT_NAMES, CHALLENGES, CHAPTER_ENDINGS, ENCOUNTERS, INCIDENTS, RELICS } from '../content/gameContent'
import { currentIncident } from '../domain/battle'
import { MIN_DECK_SIZE } from '../domain/run'
import { getPlacementHint } from '../domain/placementHint'
import { ERAS } from '../domain/types'
import type { CardInstance, ChallengeId, GameState, RunState } from '../domain/types'
import { CardButton, type GameDispatch, PrimaryButton, SideArchive } from './components'

export function TitleScreen({ state, dispatch }: { state: GameState; dispatch: GameDispatch }) {
  return (
    <section className="intro panel screen-enter">
      <div className="intro-copy">
        <span className="chapter">序章 · 第十八次火灾</span>
        <h1>明天已经毁灭。<br />你只有今晚。</h1>
        <p className="lead">白塔城在零点燃烧，而你每次都会在二十三点五十七分醒来。把行动放入过去、现在与未来，调查这场不肯结束的灾难。</p>
        {state.resumable?.run ? (
          <div className="continue-box">
            <span>发现未完成调查 · {CHALLENGES[state.resumable.run.mode].name} · 种子 {state.resumable.run.seed}</span>
            <button type="button" onClick={() => dispatch({ type: 'resume-run' })}>继续调查</button>
          </div>
        ) : null}
        <div className="mode-grid" role="group" aria-label="挑战模式">
          {(Object.keys(CHALLENGES) as ChallengeId[]).map((id) => {
            const mode = CHALLENGES[id]
            return (
              <button
                className={`mode-option ${state.selectedMode === id ? 'is-active' : ''}`}
                type="button"
                aria-pressed={state.selectedMode === id}
                key={id}
                onClick={() => dispatch({ type: 'set-mode', mode: id })}
              >
                <b>{mode.name}</b>
                <span>{mode.text}<br />墨痕倍率 ×{mode.inkMultiplier}</span>
              </button>
            )
          })}
        </div>
        <div className="seed-row">
          <label htmlFor="seed-input">调查种子</label>
          <input
            id="seed-input"
            maxLength={18}
            value={state.seedInput}
            onChange={(event) => dispatch({ type: 'set-seed', seed: event.target.value })}
          />
          <button type="button" onClick={() => dispatch({ type: 'randomize-seed' })}>随机种子</button>
        </div>
        <PrimaryButton onClick={() => dispatch({ type: 'start-run' })}>
          {state.meta.runs ? '开始新的循环' : '进入灾难循环'}
        </PrimaryButton>
      </div>
      <div className="intro-art">
        <div className="clock-face" aria-hidden="true"><span>零</span></div>
        <p>已经历 {state.meta.runs} 次循环 · 收集 {state.meta.ink} 枚墨痕</p>
      </div>
    </section>
  )
}

export function MapScreen({ state, dispatch }: { state: GameState & { run: RunState }; dispatch: GameDispatch }) {
  const { run } = state
  const act = Math.min(ACT_NAMES.length - 1, Math.floor(run.floor / 6))
  const actStart = act * 6
  const visibleLayers = run.layers.slice(actStart, actStart + 6)
  return (
    <section className="map-layout screen-enter">
      <div className="map-main panel">
        <header className="section-heading">
          <div><p className="eyebrow">ACT {act + 1} · {ACT_NAMES[act]}</p><h2>选择下一份档案</h2></div>
          <p><b>{ACT_MISSIONS[act].title}</b><span>{ACT_MISSIONS[act].text}</span></p>
        </header>
        <div className="route">
          {visibleLayers.map((layer, offset) => {
            const floor = actStart + offset
            return (
            <div className="route-layer" key={floor}>
              <span className="layer-number">{String(offset + 1).padStart(2, '0')}</span>
              {layer.map((node) => {
                const enabled = floor === run.floor
                const cleared = run.cleared.some((entry) => entry.floor === floor && entry.id === node.id)
                return (
                  <button
                    className={`route-node node-${node.type} ${enabled ? 'is-current' : ''} ${cleared ? 'is-cleared' : ''}`}
                    type="button"
                    disabled={!enabled}
                    key={node.id}
                    onClick={() => dispatch({ type: 'select-node', nodeId: node.id })}
                  >
                    <span className="node-icon">{node.icon}</span>
                    <span><small>{node.sub}</small><b>{node.title}</b><em>{node.description}</em></span>
                  </button>
                )
              })}
            </div>
          )})}
        </div>
      </div>
      <SideArchive run={run} />
    </section>
  )
}

export function BattleScreen({ state, dispatch }: { state: GameState & { run: RunState; battle: NonNullable<GameState['battle']> }; dispatch: GameDispatch }) {
  const { run, battle } = state
  const encounter = ENCOUNTERS[battle.encounterId]
  const incident = currentIncident(battle)
  const used = new Set(battle.placed.map((card) => card.uid))
  const selected = battle.hand.find((card) => card.uid === battle.selectedUid)
  const progress = Math.min(100, (battle.truth / battle.encounterTarget) * 100)
  const baseTarget = Math.ceil(encounter.target * CHALLENGES[run.mode].targetMultiplier)
  const casePressure = Math.max(0, battle.encounterTarget - baseTarget)

  return (
    <section className="battle-screen screen-enter">
      <header className="battle-heading">
        <div><p className="eyebrow">{encounter.type} · 回合 {battle.round + 1}</p><h2>{encounter.name}</h2><p>{encounter.story}</p></div>
        <div className="objective">
          <small>本案目标 · 真相</small><strong>{battle.truth} / {battle.encounterTarget}</strong>
          {casePressure ? <em className="boss-pressure">未结案件 · 目标 +{casePressure}</em> : null}
          <span className="progress" role="progressbar" aria-label="案件真相进度" aria-valuemin={0} aria-valuemax={battle.encounterTarget} aria-valuenow={battle.truth}><i style={{ width: `${progress}%` }} /></span>
          <span className="resource-row"><b>{battle.energy} / 3 能量</b><b>可信度 {battle.credibility}</b></span>
        </div>
      </header>

      <section className="incident" aria-label="当前固定事件">
        <span className="incident-glyph">{incident.glyph}</span>
        <div><small>固定事件 · 位于{ERAS[incident.era]}</small><h3>{incident.name.replace('固定事件：', '')}</h3></div>
        <strong>{incident.intent}</strong>
      </section>

      <div className="timeline" role="region" aria-label="因果时间轴">
        {ERAS.map((eraName, era) => {
          const placed = battle.placed.filter((card) => card.era === era)
          return (
            <section className={`era ${selected ? 'is-targeting' : ''}`} key={eraName}>
              <header><span>0{era + 1}</span><div><b>{eraName}</b><small>{['已发生', '正在发生', '尚可干预'][era]}</small></div></header>
              <button
                className="era-drop"
                data-testid={`era-${era}`}
                type="button"
                disabled={!selected}
                onClick={() => dispatch({ type: 'place-card', era: era as 0 | 1 | 2 })}
              >
                {selected ? (
                  <><b>放到{eraName}</b><small>{getPlacementHint(selected.cardId, era as 0 | 1 | 2, incident, selected.upgraded)}</small></>
                ) : '选择手牌后可放置'}
              </button>
              <div className="era-events">
                {placed.map((card) => (
                  <button className={`placed-card card-${CARDS[card.cardId].kind}`} type="button" key={card.uid} onClick={() => dispatch({ type: 'remove-placed', uid: card.uid })}>
                    <i>{CARDS[card.cardId].kind}</i><b>{CARDS[card.cardId].name}{card.upgraded ? ' +' : ''}</b><small>撤回</small>
                  </button>
                ))}
                {incident.era === era ? <div className="fixed-event"><small>不可移动</small><b>{incident.name.replace('固定事件：', '')}</b></div> : null}
              </div>
            </section>
          )
        })}
      </div>

      <header className="hand-heading"><div><p className="eyebrow">DRAW {battle.draw.length} · DISCARD {battle.discard.length}</p><h3>本轮手牌</h3></div><strong>1–5 选牌 · {battle.energy} / 3 能量</strong></header>
      <div className="hand" role="group" aria-label="本轮手牌">
        {battle.hand.map((card) => (
          <CardButton
            card={card}
            run={run}
            battle={battle}
            used={used.has(card.uid)}
            key={card.uid}
            onClick={() => dispatch({ type: 'select-card', uid: card.uid })}
          />
        ))}
      </div>
      <footer className="actionbar" aria-live="polite" aria-atomic="true">
        <p>{selected ? `已选择「${CARDS[selected.cardId].name}${selected.upgraded ? ' +' : ''}」——Q 过去 / W 现在 / E 未来。` : battle.placed.length ? `已编排 ${battle.placed.length} 个行动；Backspace 撤回，Enter 结算。` : '选择手牌，开始改写因果。'}</p>
        <PrimaryButton disabled={!battle.placed.length} onClick={() => dispatch({ type: 'resolve-timeline' })}>执行时间线</PrimaryButton>
      </footer>
      <div className="battle-log" aria-live="polite">{battle.log.map((line, index) => <span key={`${line}-${index}`}>{line}</span>)}</div>
    </section>
  )
}

export function EventScreen({ state, dispatch }: { state: GameState & { run: RunState; screen: Extract<GameState['screen'], { name: 'event' }> }; dispatch: GameDispatch }) {
  const event = EVENTS[state.screen.eventId]
  return (
    <StoryPanel eyebrow="ANOMALOUS RECORD" chapter={state.run.currentTitle} title={event.title}>
      <p className="narrative">{event.narrative}</p>
      <div className="choices">
        {event.choices.map((choice) => (
          <Choice
            icon={choice.icon}
            title={choice.title}
            description={choice.description}
            result={choice.result}
            onClick={() => dispatch({ type: 'choose-event', choiceId: choice.id })}
            key={choice.id}
          />
        ))}
      </div>
    </StoryPanel>
  )
}

export function RestScreen({ state, dispatch }: { state: GameState & { run: RunState; screen: Extract<GameState['screen'], { name: 'rest' }> }; dispatch: GameDispatch }) {
  if (state.screen.upgrading) {
    return (
      <StoryPanel eyebrow="ANNOTATE A POSSIBILITY" title="校注一张仍可改变的牌">
        <p className="narrative">升级只影响这一个副本。金色文字是它从下一份档案开始采用的新规则。</p>
        <UpgradeGrid run={state.run} onUpgrade={(index) => dispatch({ type: 'upgrade-rest-card', index })} />
        <button className="text-button" type="button" onClick={() => dispatch({ type: 'cancel-rest-edit' })}>返回休整选项</button>
      </StoryPanel>
    )
  }
  if (state.screen.removing) {
    return (
      <StoryPanel eyebrow="REMOVE A MEMORY" title="烧掉一段多余的因果">
        <p className="narrative">被烧掉的牌不会在本局再次出现。越薄的牌组越容易找到关键行动，但至少要保留 {MIN_DECK_SIZE} 张。</p>
        <div className="remove-grid">{state.run.deck.map((deckCard, index) => <button className={`remove-card card-${CARDS[deckCard.cardId].kind}`} type="button" disabled={state.run.deck.length <= MIN_DECK_SIZE} key={`${deckCard.cardId}-${index}`} onClick={() => dispatch({ type: 'remove-rest-card', index })}>{CARDS[deckCard.cardId].kind} · {CARDS[deckCard.cardId].name}{deckCard.upgraded ? ' +' : ''}</button>)}</div>
        <button className="text-button" type="button" onClick={() => dispatch({ type: 'cancel-rest-edit' })}>返回休整选项</button>
      </StoryPanel>
    )
  }
  return (
    <StoryPanel eyebrow="SAFE RECORD" chapter="回声室" title="这里听不见零点的钟声">
      <p className="narrative">墙上密密麻麻写着你前十七次留下的警告。大多数互相矛盾，只有一句被反复圈起：“牌越少，越接近真相。”</p>
      <div className="choices">
        <Choice icon="补" title="缝合时间线" description="休息片刻，修复事故留下的裂口。" result="回复 10" onClick={() => dispatch({ type: 'choose-rest', choice: 'heal' })} />
        <Choice icon="静" title="静默校准" description="放弃追索一段危险记忆。" result="悖论 -3" onClick={() => dispatch({ type: 'choose-rest', choice: 'calm' })} />
        <Choice icon="校" title="校注一张牌" description="选择一个未升级副本，永久强化其规则。" result="升级一张牌" onClick={() => dispatch({ type: 'choose-rest', choice: 'upgrade' })} />
        <Choice icon="焚" title="烧掉一张牌" description="永久移除本局牌组中的一张牌。" result="精简牌组" onClick={() => dispatch({ type: 'choose-rest', choice: 'remove' })} />
      </div>
    </StoryPanel>
  )
}

export function RewardScreen({ state, dispatch }: { state: GameState & { run: RunState; screen: Extract<GameState['screen'], { name: 'reward' }> }; dispatch: GameDispatch }) {
  return (
    <section className="reward panel story-panel screen-enter">
      <p className="eyebrow">ADD A POSSIBILITY</p><h2>带走一种新的可能</h2>
      <p className="lead">本案获得 {state.screen.gain} 枚回声。选择一张牌加入本局牌组；它会从下一份档案开始出现。</p>
      {state.screen.relicGained ? <p className="reward-relic"><b>精英遗物 · {RELICS[state.screen.relicGained].name}</b><span>{RELICS[state.screen.relicGained].text}</span></p> : null}
      <div className="reward-grid">{state.screen.options.map((cardId, index) => {
        const instance: CardInstance = { cardId, upgraded: false, uid: `reward-${index}` }
        return <CardButton card={instance} reward key={instance.uid} onClick={() => dispatch({ type: 'choose-reward', cardId })} />
      })}</div>
      <button className="text-button reward-skip" type="button" onClick={() => dispatch({ type: 'skip-reward' })}>跳过奖励 · 修复 3 点时间线</button>
    </section>
  )
}

export function ChapterScreen({ state, dispatch }: { state: GameState & { run: RunState; screen: Extract<GameState['screen'], { name: 'chapter' }> }; dispatch: GameDispatch }) {
  const chapter = CHAPTER_ENDINGS[state.screen.act]
  return (
    <section className="chapter-ending panel screen-enter">
      <div className="chapter-mark" aria-hidden="true">{state.screen.act + 1}</div>
      <div>
        <p className="eyebrow">{chapter.eyebrow}</p>
        <span className="chapter">第{state.screen.act === 0 ? '一' : '二'}幕结案</span>
        <h1>{chapter.title}</h1>
        <p className="narrative">{chapter.narrative}</p>
        <blockquote>{chapter.reveal}</blockquote>
        <p className="chapter-recovery">章节校准 · 时间线 +6 · 悖论 -3</p>
        <PrimaryButton onClick={() => dispatch({ type: 'continue-chapter' })}>{chapter.next}</PrimaryButton>
      </div>
    </section>
  )
}

export function ShopScreen({ state, dispatch }: { state: GameState & { run: RunState; screen: Extract<GameState['screen'], { name: 'shop' }> }; dispatch: GameDispatch }) {
  const { shop } = state.screen
  if (shop.upgrading) {
    return (
      <StoryPanel eyebrow="ANNOTATE A CARD · 18 回声" title="选择一段要重新定稿的因果">
        <p className="narrative">摊主只改一份原件，而且拒绝在同一张纸上收两次钱。</p>
        <UpgradeGrid run={state.run} onUpgrade={(index) => dispatch({ type: 'upgrade-shop-card', index })} />
        <button className="text-button" type="button" onClick={() => dispatch({ type: 'cancel-shop-upgrade' })}>取消</button>
      </StoryPanel>
    )
  }
  if (shop.removing) {
    return (
      <StoryPanel eyebrow="ERASE A CARD · 15 回声" title="选择一段要卖掉的记忆">
        <p className="narrative">书摊主人不会问它来自谁。牌会从当前牌组永久移除，但至少要保留 {MIN_DECK_SIZE} 张。</p>
        <div className="remove-grid">{state.run.deck.map((deckCard, index) => <button className={`remove-card card-${CARDS[deckCard.cardId].kind}`} type="button" disabled={state.run.deck.length <= MIN_DECK_SIZE} key={`${deckCard.cardId}-${index}`} onClick={() => dispatch({ type: 'remove-shop-card', index })}>{CARDS[deckCard.cardId].kind} · {CARDS[deckCard.cardId].name}{deckCard.upgraded ? ' +' : ''}</button>)}</div>
        <button className="text-button" type="button" onClick={() => dispatch({ type: 'cancel-shop-remove' })}>取消</button>
      </StoryPanel>
    )
  }
  return (
    <StoryPanel eyebrow="THE UPSIDE-DOWN BOOKSTALL" chapter="倒悬书摊" title="这里出售没有发生过的可能">
      <p className="narrative">摊主倒挂在天花板上，只收你在案件里留下的“回声”。当前持有 {state.run.echoes} 枚。</p>
      <div className="shop-grid">
        {shop.cards.map((cardId, index) => {
          const sold = shop.bought.includes(`card-${index}`)
          return <ShopItem label="CARD" title={`${CARDS[cardId].kind} · ${CARDS[cardId].name}`} description={CARDS[cardId].text} price="12 回声" sold={sold} disabled={state.run.echoes < 12} onClick={() => dispatch({ type: 'buy-shop-card', index })} key={`${cardId}-${index}`} />
        })}
        <ShopItem label="RELIC" title={RELICS[shop.relic].name} description={RELICS[shop.relic].text} price="25 回声" sold={shop.bought.includes('relic')} disabled={state.run.echoes < 25} onClick={() => dispatch({ type: 'buy-shop-relic' })} />
        <ShopItem label="SERVICE" title="缝合时间线" description="立即修复 8 点时间线。" price="10 回声" sold={shop.bought.includes('heal')} disabled={state.run.echoes < 10} onClick={() => dispatch({ type: 'buy-shop-heal' })} />
        <ShopItem label="SERVICE" title="删除一张牌" description={`从本局牌组永久移除一张牌；至少保留 ${MIN_DECK_SIZE} 张。`} price="15 回声" sold={shop.bought.includes('remove')} disabled={state.run.echoes < 15 || state.run.deck.length <= MIN_DECK_SIZE} onClick={() => dispatch({ type: 'open-shop-remove' })} />
        <ShopItem label="SERVICE" title="校注一张牌" description="选择一个未升级副本，永久采用强化规则。" price="18 回声" sold={shop.bought.includes('upgrade')} disabled={state.run.echoes < 18} onClick={() => dispatch({ type: 'open-shop-upgrade' })} />
      </div>
      <PrimaryButton onClick={() => dispatch({ type: 'leave-shop' })}>离开书摊</PrimaryButton>
    </StoryPanel>
  )
}

export function EndingScreen({ state, dispatch }: { state: GameState & { run: RunState; screen: Extract<GameState['screen'], { name: 'ending' }> }; dispatch: GameDispatch }) {
  const { won, reason, inkGain } = state.screen
  const motive = state.run.clues.includes('future-city')
    ? '你签下订单，是因为未出生者曾从一座被救下的城市寄来回信；那条未来值得被保留。'
    : '你签下订单，是为了让白塔城保留一条没有在零点燃烧的可能。'
  const proofFacts: string[] = []
  if (state.run.clues.includes('archive-origin')) proofFacts.push('档案馆才是灾难的起点')
  if (state.run.clues.includes('zero-self')) proofFacts.push('第零号历史中的你早已参与这场灾难')
  if (state.run.clues.includes('future-city')) proofFacts.push('一座被救下的白塔城仍在未来留下回信')
  if (state.run.clues.includes('key-shape')) proofFacts.push('地下那扇门确实为你留下了入口')
  const proof = proofFacts.length > 1
    ? `你保留下来的 ${proofFacts.length} 项证据彼此吻合：${proofFacts.join('；')}。`
    : proofFacts.length === 1
      ? `你只保留下一项关键证据：${proofFacts[0]}。它足以指明方向，却无法独自证明全部原始记录。`
      : '你停止了循环，却烧掉或避开了所有关键证据；没有人能证明是谁写下第一行。'
  const keyResult = state.run.clues.includes('key-shape')
    ? state.run.relics.includes('key')
      ? '第零号钥匙留在你手中，成为封存完成的凭证。'
      : '你没有得到钥匙，只留下它的齿痕——足够证明那扇门确实存在。'
    : '门在档案封存后消失，只在空白页上留下一圈钥匙形压痕。'
  return (
    <section className={`ending panel ${won ? '' : 'is-loss'} screen-enter`}>
      <div>
        <p className="eyebrow">{won ? 'VOLUME I CLOSED · ZERO HISTORY SEALED' : 'TIMELINE COLLAPSED · TRY AGAIN'}</p>
        <span className="ending-seal">{won ? '零' : '悖'}</span>
        <h1>{won ? '你封存了第零号历史' : '这条历史无法成立'}</h1>
        <p className="narrative">{won ? `零时档案只是循环的外壳；第零号历史才是你写给三天前自己的“重来”命令。档案管理员摘下面具，那张脸正是未来的你。你划掉订单上的签名，零点终于只发生一次。${motive}` : reason}</p>
        {won ? <div className="ending-proof"><p>{proof}</p><p>{keyResult}</p></div> : null}
        <p className="ending-gain">本次带回 {inkGain} 枚墨痕 · 累计 {state.meta.ink} 枚</p>
        <PrimaryButton onClick={() => dispatch({ type: 'restart' })}>{won ? '封存档案，回到档案馆' : '记住失败，再试一次'}</PrimaryButton>
      </div>
    </section>
  )
}

function StoryPanel({ eyebrow, chapter, title, children }: { eyebrow: string; chapter?: string; title: string; children: React.ReactNode }) {
  return <section className="story-panel panel screen-enter"><p className="eyebrow">{eyebrow}</p>{chapter ? <span className="chapter">{chapter}</span> : null}<h2>{title}</h2>{children}</section>
}

function Choice({ icon, title, description, result, onClick }: { icon: string; title: string; description: string; result: string; onClick: () => void }) {
  return <button className="choice" type="button" onClick={onClick}><span className="choice-icon">{icon}</span><span><b>{title}</b><small>{description}</small></span><em>{result}</em></button>
}

function ShopItem({ label, title, description, price, sold, disabled, onClick }: { label: string; title: string; description: string; price: string; sold: boolean; disabled: boolean; onClick: () => void }) {
  return <article className={`shop-item ${sold ? 'is-sold' : ''}`}><p className="eyebrow">{label}</p><h3>{title}</h3><p>{description}</p><footer><span>{price}</span><button type="button" aria-label={sold ? `已售：${title}` : `购买：${title}`} disabled={sold || disabled} onClick={onClick}>{sold ? '已售' : '购买'}</button></footer></article>
}

function UpgradeGrid({ run, onUpgrade }: { run: RunState; onUpgrade: (index: number) => void }) {
  const available = run.deck.some((card) => !card.upgraded)
  if (!available) return <p className="empty-state">当前牌组中的每个副本都已完成校注。</p>
  return (
    <div className="upgrade-grid">
      {run.deck.map((deckCard, index) => {
        if (deckCard.upgraded) return null
        const card = CARDS[deckCard.cardId]
        return (
          <button className={`upgrade-card card-${card.kind}`} type="button" key={`${deckCard.cardId}-${index}`} onClick={() => onUpgrade(index)}>
            <span>{card.kind} · {card.name}</span>
            <small>{card.text}</small>
            <b>{card.upgradeText}</b>
          </button>
        )
      })}
    </div>
  )
}
