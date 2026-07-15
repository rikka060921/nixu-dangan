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
    const deckCard = battle.draw.shift()
    if (!deckCard) break
    const card: CardInstance = { ...deckCard, uid: `${deckCard.cardId}-${battle.nextCardUid}` }
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
  if (run.relics.includes('key')) {
    run.paradox = Math.max(0, run.paradox - 1)
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
  const baseTarget = Math.ceil(encounter.target * CHALLENGES[run.mode].targetMultiplier)
  const actStart = Math.floor(run.floor / 6) * 6
  const clearedCombat = run.cleared.filter((entry) => {
    if (entry.floor < actStart || entry.floor >= actStart + 5) return false
    const node = run.layers[entry.floor]?.find((candidate) => candidate.id === entry.id)
    return node?.type === 'battle' || node?.type === 'elite'
  }).length
  const unresolvedCases = encounter.rank === 'boss' ? Math.max(0, 3 - clearedCombat) : 0
  const casePressure = unresolvedCases * 4
  const battle: BattleState = {
    encounterId,
    encounterTarget: baseTarget + casePressure,
    incidentOrder,
    round: 0,
    truth: 0,
    credibility: run.relics.includes('ticket') ? 1 : 0,
    witnessAlive: true,
    draw: deck.items,
    discard: [],
    hand: [],
    energy: 3,
    placed: [],
    watchAvailable: true,
    nextCardUid: 0,
    log: [encounter.story, ...(casePressure ? [`你跳过了 ${unresolvedCases} 份关键案件：首领真相目标 +${casePressure}。`] : [])],
  }
  return drawCards(run, battle, 5)
}

export function currentIncident(battle: BattleState) {
  const id = battle.incidentOrder[Math.min(battle.round, battle.incidentOrder.length - 1)]
  return INCIDENTS[id]
}

export function effectiveCost(run: RunState, battle: BattleState, card: CardInstance): number {
  if (discountSource(run, battle, card)) return 0
  return CARDS[card.cardId].cost
}

function discountSource(run: RunState, battle: BattleState, card: CardInstance): PlacedCard['discount'] {
  if (run.relics.includes('watch') && battle.watchAvailable) return 'watch'
  if (run.relics.includes('needle') && CARDS[card.cardId].kind === '改' && !battle.placed.some((placed) => CARDS[placed.cardId].kind === '改')) return 'needle'
  return undefined
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
  const discount = discountSource(run, battle, selected)
  const placed: PlacedCard = { ...selected, era, paid: cost, discount }
  return {
    ...battle,
    energy: battle.energy - cost,
    watchAvailable: discount === 'watch' ? false : battle.watchAvailable,
    placed: [...battle.placed, placed],
    selectedUid: undefined,
  }
}

export function removePlacedCard(battle: BattleState, uid: string): BattleState {
  const card = battle.placed.find((entry) => entry.uid === uid)
  if (!card) return battle
  const placed = battle.placed.filter((entry) => entry.uid !== uid)
  let energy = battle.energy + card.paid
  let watchAvailable = battle.watchAvailable
  if (card.discount === 'watch') {
    const next = placed[0]
    if (!next) {
      watchAvailable = true
    } else {
      energy += next.paid
      placed[0] = { ...next, paid: 0, discount: 'watch' }
      watchAvailable = false
    }
  }
  return {
    ...battle,
    energy,
    watchAvailable,
    placed,
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
  let firstUpgradedCard = true

  const ordered = battle.placed.map((card, index) => ({ card, index })).sort((a, b) => a.card.era - b.card.era || a.index - b.index)
  timelineResolution:
  for (const era of [0, 1, 2] as const) {
    for (const { card: placed } of ordered.filter((entry) => entry.card.era === era)) {
      const paradoxBeforeCard = run.paradox
    const card = CARDS[placed.cardId]
    const upgraded = placed.upgraded
    if (upgraded && firstUpgradedCard) {
      if (run.relics.includes('carbon')) {
        battle.truth += 1
        messages.push('复写黑纸：真相 +1。')
      }
      firstUpgradedCard = false
    }
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
      if (upgraded) battle.truth += 1
      messages.push(upgraded ? '仓库被封锁：真相 +1。' : '仓库被封锁。')
    }
    if (placed.cardId === 'rescue') {
      if (placed.era === 1) {
        const gain = upgraded ? 2 : 1
        battle.truth += gain
        battle.witnessAlive = true
        flags.protectedNow = true
        messages.push(`证人被及时疏散，真相 +${gain}。`)
      } else messages.push('疏散时机错误。')
    }
    if (placed.cardId === 'ledger') {
      const gain = (battle.witnessAlive ? 3 : 2) + (upgraded ? 1 : 0)
      battle.truth += gain
      messages.push(`账本残页：真相 +${gain}。`)
    }
    if (placed.cardId === 'clarify') {
      const credibilityGain = upgraded ? 2 : 1
      battle.credibility += credibilityGain
      if (before) flags.clarified = true
      if (before && upgraded) battle.truth += 1
      messages.push(`澄清谣言：可信度 +${credibilityGain}${before && upgraded ? '，真相 +1' : ''}。`)
    }
    if (placed.cardId === 'memory') {
      const gain = placed.era === 0 ? 4 : 3
      battle.truth += gain
      run.paradox += upgraded ? 1 : 2
      messages.push(`真实记忆：真相 +${gain}，悖论 +${upgraded ? 1 : 2}。`)
    }
    if (placed.cardId === 'anchor' && before) {
      flags.anchored = true
      const reduction = upgraded ? 2 : 1
      run.paradox = Math.max(0, run.paradox - reduction)
      messages.push(`真相已锚定，悖论 -${reduction}。`)
    }
    if (placed.cardId === 'alibi') {
      battle.credibility += 2
      const gain = upgraded ? 2 : 1
      battle.truth += gain
      run.paradox += 2
      messages.push(`伪造口供：真相 +${gain}，悖论 +2。`)
    }
    if (placed.cardId === 'blackout') {
      if (placed.era === 0) {
        flags.cancelled = true
        run.paradox += 2
        if (upgraded) run.timeline = Math.min(run.maxTimeline, run.timeline + 1)
        messages.push(upgraded ? '固定事件被提前停电取消：时间线 +1，悖论 +2。' : '固定事件被提前停电取消：悖论 +2。')
      } else messages.push('停电来得太晚。')
    }
    if (placed.cardId === 'annotation') {
      const gain = placed.era === 2 ? (upgraded ? 4 : 3) : (upgraded ? 2 : 1)
      battle.truth += gain
      messages.push(`逆序批注：真相 +${gain}。`)
    }
    if (placed.cardId === 'echo') {
      const gain = Math.max(1, kinds.size) + (upgraded ? 1 : 0)
      battle.truth += gain
      messages.push(`因果回响：真相 +${gain}。`)
    }
    if (placed.cardId === 'testimony') {
      if (battle.credibility > 0) {
        const gain = upgraded ? 3 : 2
        battle.truth += gain
        messages.push(`口供被封存：真相 +${gain}。`)
      }
      battle.credibility += 1
    }
    if (placed.cardId === 'vow') {
      let gain = upgraded ? 6 : 5
      if (run.paradox >= 4) {
        gain += upgraded ? 3 : 2
        run.timeline -= 2
      }
      battle.truth += gain
      messages.push(`以身作证：真相 +${gain}。`)
    }
    if (placed.cardId === 'thread') {
      const gain = upgraded ? 2 : 1
      battle.truth += gain
      if (placed.era === 1) battle.credibility += 1
      messages.push(`红线追迹：真相 +${gain}${placed.era === 1 ? '，可信度 +1' : ''}。`)
    }
    if (placed.cardId === 'delay') {
      flags.protectedNow = true
      const gain = placed.era === 2 ? (upgraded ? 2 : 1) : 0
      if (gain) battle.truth += gain
      messages.push(`固定事件被延迟${gain ? `：真相 +${gain}` : ''}。`)
    }
    if (placed.cardId === 'doorplate') {
      flags.protectedNow = true
      if (placed.era === 0) {
        const gain = upgraded ? 3 : 2
        battle.truth += gain
        messages.push(`燃烧的门牌：真相 +${gain}。`)
      }
    }
    if (placed.cardId === 'chorus') {
      const gain = battle.credibility >= 1 ? (upgraded ? 6 : 5) : (upgraded ? 4 : 3)
      battle.truth += gain
      messages.push(`双重证词：真相 +${gain}。`)
    }
    if (placed.cardId === 'rewind') {
      if (placed.era === 0) {
        flags.cancelled = true
        const repair = upgraded ? 4 : 2
        run.timeline = Math.min(run.maxTimeline, run.timeline + repair)
        run.paradox += 2
        messages.push(`回到案发前：事件取消，时间线 +${repair}，悖论 +2。`)
      } else messages.push('你没能回到足够早。')
    }
    if (placed.cardId === 'sealorder') {
      flags.anchored = true
      if (kinds.has('证')) {
        const gain = upgraded ? 3 : 2
        battle.truth += gain
        messages.push(`封存命令：真相 +${gain}。`)
      }
    }
    if (placed.cardId === 'erase') {
      battle.truth += upgraded ? 5 : 4
      battle.witnessAlive = false
      run.paradox += upgraded ? 1 : 2
      messages.push(`目击者被删除：真相 +${upgraded ? 5 : 4}，悖论 +${upgraded ? 1 : 2}。`)
    }
    if (placed.cardId === 'secondhand') {
      if (placed.era === 2) {
        const gain = upgraded ? 3 : 2
        battle.truth += gain
        messages.push(`借来的秒针：真相 +${gain}。`)
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
      const timelineBeforeIncident = run.timeline
      applyIncident(incident.id, run, battle, flags, kinds, messages)
      if (run.relics.includes('lens') && run.timeline < timelineBeforeIncident) {
        const restored = Math.min(2, timelineBeforeIncident - run.timeline)
        run.timeline += restored
        messages.push(`裂纹目镜：时间线 +${restored}。`)
      }
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
  if (!terminalReached && run.relics.includes('bellshard') && new Set(battle.placed.map((card) => card.era)).size === 3) {
    battle.truth += 2
    messages.push('逆钟碎片：真相 +2。')
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
    discard: [...battle.discard, ...battle.hand.map(({ cardId, upgraded }) => ({ cardId, upgraded }))],
    hand: [],
    placed: [],
    selectedUid: undefined,
    energy: 3,
    round: battle.round + 1,
  }
  const next = drawCards(run, nextBattle, 5)
  return { ...next, outcome: 'continue' }
}
