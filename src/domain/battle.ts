import { CARDS } from '../content/cards'
import { CHALLENGES, ENCOUNTERS, INCIDENTS } from '../content/gameContent'
import type {
  BattleState,
  CardInstance,
  EncounterId,
  Era,
  IncidentId,
  PlacedCard,
  RunState,
} from './types'
import { shuffleSeeded } from './random'

export type BattleOutcome = 'continue' | 'battle-won' | 'run-won' | 'run-lost'

export interface BattleResolution {
  run: RunState
  battle: BattleState
  outcome: BattleOutcome
  reason?: string
}

function drawCards(runInput: RunState, battleInput: BattleState, targetHandSize: number): { run: RunState; battle: BattleState } {
  let run = { ...runInput }
  const battle: BattleState = {
    ...battleInput,
    draw: [...battleInput.draw],
    discard: [...battleInput.discard],
    hand: [...battleInput.hand],
  }

  while (battle.hand.length < targetHandSize) {
    if (!battle.draw.length) {
      if (!battle.discard.length) break
      const shuffled = shuffleSeeded(battle.discard, run.rngState)
      battle.draw = shuffled.items
      battle.discard = []
      run.rngState = shuffled.state
    }
    const cardId = battle.draw.shift()
    if (!cardId) break
    const card: CardInstance = { cardId, uid: `${cardId}-${battle.nextCardUid}` }
    battle.nextCardUid += 1
    battle.hand.push(card)
  }

  return { run, battle }
}

export function startBattle(runInput: RunState, encounterId: EncounterId): { run: RunState; battle: BattleState } {
  const encounter = ENCOUNTERS[encounterId]
  let run = { ...runInput }
  if (run.relics.includes('crane')) {
    run.timeline = Math.min(run.maxTimeline, run.timeline + 2)
  }

  const incidentOrder =
    encounterId === 'boss'
      ? (() => {
          const middle = shuffleSeeded(encounter.incidents.slice(1, -1), run.rngState)
          run.rngState = middle.state
          return [encounter.incidents[0], ...middle.items, encounter.incidents.at(-1)!]
        })()
      : (() => {
          const shuffled = shuffleSeeded(encounter.incidents, run.rngState)
          run.rngState = shuffled.state
          return shuffled.items
        })()

  const deck = shuffleSeeded(run.deck, run.rngState)
  run.rngState = deck.state
  const battle: BattleState = {
    encounterId,
    encounterTarget: Math.ceil(encounter.target * CHALLENGES[run.mode].targetMultiplier),
    incidentOrder,
    round: 0,
    truth: 0,
    credibility: 0,
    witnessAlive: true,
    draw: deck.items,
    discard: [],
    hand: [],
    energy: 3,
    placed: [],
    nextCardUid: 0,
    log: [encounter.story],
  }
  return drawCards(run, battle, 5)
}

export function currentIncident(battle: BattleState) {
  const id = battle.incidentOrder[Math.min(battle.round, battle.incidentOrder.length - 1)]
  return INCIDENTS[id]
}

export function effectiveCost(run: RunState, battle: BattleState, card: CardInstance): number {
  return run.relics.includes('watch') && battle.placed.length === 0 ? 0 : CARDS[card.cardId].cost
}

export function selectCard(battle: BattleState, uid: string): BattleState {
  if (!battle.hand.some((card) => card.uid === uid)) return battle
  return { ...battle, selectedUid: battle.selectedUid === uid ? undefined : uid }
}

export function placeSelectedCard(run: RunState, battle: BattleState, era: Era): BattleState {
  const selected = battle.hand.find((card) => card.uid === battle.selectedUid)
  if (!selected || battle.placed.some((card) => card.uid === selected.uid)) return battle
  const cost = effectiveCost(run, battle, selected)
  if (cost > battle.energy) return battle
  const placed: PlacedCard = { ...selected, era, paid: cost }
  return {
    ...battle,
    energy: battle.energy - cost,
    placed: [...battle.placed, placed],
    selectedUid: undefined,
  }
}

export function removePlacedCard(battle: BattleState, uid: string): BattleState {
  const card = battle.placed.find((entry) => entry.uid === uid)
  if (!card) return battle
  return {
    ...battle,
    energy: battle.energy + card.paid,
    placed: battle.placed.filter((entry) => entry.uid !== uid),
  }
}

function applyIncident(
  incidentId: IncidentId,
  run: RunState,
  battle: BattleState,
  flags: { protectedNow: boolean; anchored: boolean; clarified: boolean },
  kinds: Set<string>,
  messages: string[],
): void {
  if (incidentId === 'fire') {
    if (flags.protectedNow) {
      battle.truth += 1
      messages.push('火灾被控制：真相 +1。')
    } else {
      run.timeline -= 4
      battle.witnessAlive = false
      messages.push('证人死于火灾：时间线 -4。')
    }
  }
  if (incidentId === 'interrogation') {
    if (battle.credibility >= 1) {
      battle.truth += 2
      messages.push('证词被采纳：真相 +2。')
    } else if (flags.protectedNow) {
      messages.push('防护生效：抵挡审讯造成的时间线损伤。')
    } else {
      run.timeline -= 3
      messages.push('审讯击穿叙事：时间线 -3。')
    }
  }
  if (incidentId === 'rumor') {
    if (flags.clarified) {
      battle.truth += 1
      messages.push('假报纸被揭穿：真相 +1。')
    } else {
      battle.credibility = 0
      run.paradox += 1
      messages.push('谣言覆盖证词：悖论 +1。')
    }
  }
  if (incidentId === 'mirror') {
    if (kinds.size >= 2) {
      battle.truth += 2
      messages.push('镜像无法复制组合：真相 +2。')
    } else if (flags.protectedNow) {
      messages.push('防护生效：抵挡镜像造成的时间线损伤。')
    } else {
      run.timeline -= 3
      messages.push('单一行动被镜像反制：时间线 -3。')
    }
  }
  if (incidentId === 'theft') {
    if (flags.protectedNow) {
      battle.truth += 1
      messages.push('证物保住了：真相 +1。')
    } else {
      run.timeline -= 3
      messages.push('证物被窃：时间线 -3。')
    }
  }
  if (incidentId === 'purge') {
    if (flags.anchored) messages.push('销毁无法触及被锚定的真相。')
    else {
      battle.truth = Math.max(0, battle.truth - 3)
      messages.push('档案销毁：真相 -3。')
    }
  }
  if (incidentId === 'rewrite') {
    if (flags.protectedNow) messages.push('防护生效：抵挡规则改写造成的时间线损伤。')
    else {
      run.timeline -= 2
      run.paradox += 1
      messages.push('规则被改写：时间线 -2，悖论 +1。')
    }
  }
  if (incidentId === 'collapse') {
    if (flags.anchored) {
      battle.truth += 2
      messages.push('你站在坍塌中固定历史：真相 +2。')
    } else if (flags.protectedNow) {
      messages.push('防护生效：抵挡零时坍塌造成的时间线损伤。')
    } else {
      run.timeline -= 6
      run.paradox += 1
      messages.push('零时坍塌：时间线 -6，悖论 +1。')
    }
  }
  if (incidentId === 'toll') {
    if (flags.anchored) {
      battle.truth += 2
      messages.push('钟声被固定：真相 +2。')
    } else if (flags.protectedNow) messages.push('防护生效：抵挡钟声造成的时间线损伤。')
    else {
      run.timeline -= 4
      messages.push('第十三声钟响：时间线 -4。')
    }
  }
  if (incidentId === 'silence') {
    if (kinds.has('证')) {
      battle.truth += 2
      messages.push('证据替全城开口：真相 +2。')
    } else if (flags.protectedNow) messages.push('防护生效：抵挡全城失语造成的时间线损伤。')
    else {
      run.timeline -= 4
      messages.push('全城失语：时间线 -4。')
    }
  }
  if (incidentId === 'inversion') {
    if (kinds.has('改')) {
      battle.truth += 2
      messages.push('你顺着倒置的因果找到入口：真相 +2。')
    } else {
      run.paradox += 2
      messages.push('因果倒置：悖论 +2。')
    }
  }
}

export function resolveTimeline(runInput: RunState, battleInput: BattleState): BattleResolution {
  const run: RunState = { ...runInput, story: [...runInput.story] }
  let battle: BattleState = {
    ...battleInput,
    draw: [...battleInput.draw],
    discard: [...battleInput.discard],
    hand: [...battleInput.hand],
    placed: [...battleInput.placed],
    log: [...battleInput.log],
  }
  const incident = currentIncident(battle)
  const messages: string[] = []
  const kinds = new Set<string>()
  const flags = { protectedNow: false, anchored: false, clarified: false, cancelled: false }
  let firstEvidence = true
  let paradoxIncreased = false
  let terminalReached = false

  const ordered = battle.placed.map((card, index) => ({ card, index })).sort((a, b) => a.card.era - b.card.era || a.index - b.index)
  timelineResolution:
  for (const era of [0, 1, 2] as const) {
    for (const { card: placed } of ordered.filter((entry) => entry.card.era === era)) {
      const paradoxBeforeCard = run.paradox
    const card = CARDS[placed.cardId]
    const before = placed.era <= incident.era
    kinds.add(card.kind)
    if (card.kind === '证' && firstEvidence) {
      if (run.relics.includes('redthread')) {
        battle.truth += 1
        messages.push('朱砂红线：真相 +1。')
      }
      firstEvidence = false
    }

    if (placed.cardId === 'seal' && before) {
      flags.protectedNow = true
      messages.push('仓库被封锁。')
    }
    if (placed.cardId === 'rescue') {
      if (placed.era === 1) {
        battle.truth += 1
        battle.witnessAlive = true
        flags.protectedNow = true
        messages.push('证人被及时疏散，真相 +1。')
      } else messages.push('疏散时机错误。')
    }
    if (placed.cardId === 'ledger') {
      const gain = battle.witnessAlive ? 3 : 2
      battle.truth += gain
      messages.push(`账本残页：真相 +${gain}。`)
    }
    if (placed.cardId === 'clarify') {
      battle.credibility += 1
      if (before) flags.clarified = true
      messages.push('可信度 +1。')
    }
    if (placed.cardId === 'memory') {
      const gain = placed.era === 0 ? 4 : 3
      battle.truth += gain
      run.paradox += 2
      messages.push(`真实记忆：真相 +${gain}，悖论 +2。`)
    }
    if (placed.cardId === 'anchor' && before) {
      flags.anchored = true
      run.paradox = Math.max(0, run.paradox - 1)
      messages.push('真相已锚定，悖论 -1。')
    }
    if (placed.cardId === 'alibi') {
      battle.credibility += 2
      battle.truth += 1
      run.paradox += 2
      messages.push('伪造口供：真相 +1，悖论 +2。')
    }
    if (placed.cardId === 'blackout') {
      if (placed.era === 0) {
        flags.cancelled = true
        run.paradox += 2
        messages.push('固定事件被提前停电取消。')
      } else messages.push('停电来得太晚。')
    }
    if (placed.cardId === 'annotation') {
      const gain = placed.era === 2 ? 3 : 1
      battle.truth += gain
      messages.push(`逆序批注：真相 +${gain}。`)
    }
    if (placed.cardId === 'echo') {
      const gain = Math.max(1, kinds.size)
      battle.truth += gain
      messages.push(`因果回响：真相 +${gain}。`)
    }
    if (placed.cardId === 'testimony') {
      if (battle.credibility > 0) {
        battle.truth += 2
        messages.push('口供被封存：真相 +2。')
      }
      battle.credibility += 1
    }
    if (placed.cardId === 'vow') {
      let gain = 5
      if (run.paradox >= 4) {
        gain += 2
        run.timeline -= 2
      }
      battle.truth += gain
      messages.push(`以身作证：真相 +${gain}。`)
    }
    if (placed.cardId === 'thread') {
      battle.truth += 1
      if (placed.era === 1) battle.credibility += 1
      messages.push('红线追迹：真相 +1。')
    }
    if (placed.cardId === 'delay') {
      flags.protectedNow = true
      if (placed.era === 2) battle.truth += 1
      messages.push('固定事件被延迟。')
    }
    if (placed.cardId === 'doorplate') {
      flags.protectedNow = true
      if (placed.era === 0) {
        battle.truth += 2
        messages.push('燃烧的门牌：真相 +2。')
      }
    }
    if (placed.cardId === 'chorus') {
      const gain = battle.credibility >= 1 ? 5 : 3
      battle.truth += gain
      messages.push(`双重证词：真相 +${gain}。`)
    }
    if (placed.cardId === 'rewind') {
      if (placed.era === 0) {
        flags.cancelled = true
        run.timeline = Math.min(run.maxTimeline, run.timeline + 2)
        run.paradox += 2
        messages.push('回到案发前：事件取消，时间线 +2，悖论 +2。')
      } else messages.push('你没能回到足够早。')
    }
    if (placed.cardId === 'sealorder') {
      flags.anchored = true
      if (kinds.has('证')) {
        battle.truth += 2
        messages.push('封存命令：真相 +2。')
      }
    }
    if (placed.cardId === 'erase') {
      battle.truth += 4
      battle.witnessAlive = false
      run.paradox += 2
      messages.push('目击者被删除：真相 +4，悖论 +2。')
    }
    if (placed.cardId === 'secondhand') {
      if (placed.era === 2) {
        battle.truth += 2
        messages.push('借来的秒针：真相 +2。')
      } else {
        run.paradox += 1
        messages.push('秒针错位：悖论 +1。')
      }
    }
      if (run.paradox > paradoxBeforeCard) paradoxIncreased = true
      if (run.timeline <= 0 || run.paradox >= run.paradoxLimit) {
        terminalReached = true
        break timelineResolution
      }
    }

    if (era === incident.era && !flags.cancelled) {
      const paradoxBeforeIncident = run.paradox
      applyIncident(incident.id, run, battle, flags, kinds, messages)
      if (run.paradox > paradoxBeforeIncident) paradoxIncreased = true
      if (run.timeline <= 0 || run.paradox >= run.paradoxLimit) {
        terminalReached = true
        break timelineResolution
      }
    }
  }

  if (flags.cancelled && run.relics.includes('ash')) {
    run.timeline = Math.min(run.maxTimeline, run.timeline + 2)
    messages.push('灰烬印章：时间线 +2。')
  }
  if (paradoxIncreased && run.relics.includes('mirror')) {
    battle.truth += 1
    messages.push('镜面残片记录了矛盾：真相 +1。')
  }
  battle.log = messages

  if (terminalReached || run.timeline <= 0 || run.paradox >= run.paradoxLimit) {
    return {
      run,
      battle,
      outcome: 'run-lost',
      reason:
        run.paradox >= run.paradoxLimit
          ? '悖论互相否定，整条时间线从未存在过。'
          : '时间线彻底断裂，你再次在火灾前三分钟醒来。',
    }
  }
  if (battle.truth >= battle.encounterTarget) {
    return { run, battle, outcome: battle.encounterId === 'boss' ? 'run-won' : 'battle-won' }
  }

  const nextBattle: BattleState = {
    ...battle,
    discard: [...battle.discard, ...battle.hand.map((card) => card.cardId)],
    hand: [],
    placed: [],
    selectedUid: undefined,
    energy: 3,
    round: battle.round + 1,
  }
  const next = drawCards(run, nextBattle, 5)
  return { ...next, outcome: 'continue' }
}
