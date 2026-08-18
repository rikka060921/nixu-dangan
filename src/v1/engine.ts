import { CHAPTERS_V1, REWARD_POOL_V1, START_DECK_V1, V1_CARDS } from './content'
import type {
  CardInstanceV1,
  CaseRank,
  ChainEvent,
  ChainResolution,
  RouteBonus,
  RunStateV1,
  V1CardId,
} from './types'

const UINT32_MAX = 0x1_0000_0000

export function hashSeed(seed: string): number {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0 || 0x6d2b79f5
}

export function nextRandom(state: number): [number, number] {
  const next = (Math.imul(state, 1664525) + 1013904223) >>> 0
  return [next / UINT32_MAX, next]
}

export function randomSeed(): string {
  const date = new Date()
  const day = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `ECHO-${day}-${suffix}`
}

export function createRun(seed: string): RunStateV1 {
  const normalized = seed.trim() || randomSeed()
  return {
    seed: normalized,
    rngState: hashSeed(normalized),
    chapterIndex: 0,
    deck: [...START_DECK_V1],
    records: [],
    bestChain: 0,
    totalImpact: 0,
    rewinds: 0,
  }
}

export function mergeRouteBonuses(...bonuses: RouteBonus[]): RouteBonus {
  return bonuses.reduce<RouteBonus>((sum, bonus) => ({
    seeds: (sum.seeds ?? 0) + (bonus.seeds ?? 0),
    witnesses: (sum.witnesses ?? 0) + (bonus.witnesses ?? 0),
    anchors: (sum.anchors ?? 0) + (bonus.anchors ?? 0),
    echoes: (sum.echoes ?? 0) + (bonus.echoes ?? 0),
  }), {})
}

function pickCard(deck: V1CardId[], rngState: number): [V1CardId, number] {
  const [roll, nextState] = nextRandom(rngState)
  return [deck[Math.floor(roll * deck.length)] ?? 'seed', nextState]
}

export function drawHand(
  deck: V1CardId[],
  rngState: number,
  nextUid: number,
  openingCard?: V1CardId,
  size = 5,
): { hand: CardInstanceV1[]; rngState: number; nextUid: number } {
  const source = deck.length > 0 ? deck : START_DECK_V1
  const cardIds: V1CardId[] = []
  let state = rngState
  if (openingCard) cardIds.push(openingCard)
  while (cardIds.length < size) {
    const [cardId, nextState] = pickCard(source, state)
    cardIds.push(cardId)
    state = nextState
  }

  const hasPast = cardIds.some((cardId) => V1_CARDS[cardId].lane === 'past')
  const hasFuture = cardIds.some((cardId) => V1_CARDS[cardId].lane === 'future')
  if (!hasPast) cardIds[cardIds.length - 1] = source.find((cardId) => V1_CARDS[cardId].lane === 'past') ?? 'seed'
  if (!hasFuture) cardIds[cardIds.length - 1] = source.find((cardId) => V1_CARDS[cardId].lane === 'future') ?? 'echo'

  const hand = cardIds.map((cardId, index) => ({ uid: `c${nextUid + index}`, cardId }))
  return { hand, rngState: state, nextUid: nextUid + hand.length }
}

function addEvent(events: ChainEvent[], event: ChainEvent): number {
  events.push(event)
  return event.gain
}

export function resolvePlan(cards: CardInstanceV1[], routeBonus: RouteBonus = {}): ChainResolution {
  let seeds = routeBonus.seeds ?? 0
  let witnesses = routeBonus.witnesses ?? 0
  let anchors = routeBonus.anchors ?? 0
  let echoes = routeBonus.echoes ?? 0
  let pastCharge = seeds * 2 + anchors
  let futureCharge = witnesses * 2 + echoes
  let chain = pastCharge + futureCharge
  let relays = 0
  let previousLane: 'past' | 'future' | undefined
  const events: ChainEvent[] = []

  if (chain > 0) {
    addEvent(events, {
      kind: 'surge',
      title: '路线加分',
      detail: '你刚才选择的过去和未来，已经提供了开局分数。',
      gain: chain,
    })
  }

  for (const instance of cards) {
    const card = V1_CARDS[instance.cardId]
    if (previousLane && previousLane !== card.lane) {
      relays += 1
      const relayGain = 2 + relays * 2
      chain += addEvent(events, {
        kind: 'relay',
        lane: card.lane,
        title: `第 ${relays} 次红蓝切换`,
        detail: `从${previousLane === 'past' ? '红色过去' : '蓝色未来'}换到${card.lane === 'past' ? '红色过去' : '蓝色未来'}，获得额外分数。`,
        gain: relayGain,
      })
    }

    let gain = card.power
    if (card.lane === 'past') pastCharge += card.power
    else futureCharge += card.power

    switch (card.effect) {
      case 'seed':
        seeds += 1
        gain += 2 + seeds
        break
      case 'witness':
        witnesses += 1
        gain += 2 + witnesses
        break
      case 'anchor':
        anchors += 1
        gain += anchors * 2
        pastCharge += anchors
        break
      case 'signal':
        gain += futureCharge + relays * 2
        break
      case 'echo':
        gain += pastCharge + seeds * 2
        echoes += 1
        break
      case 'testimony':
        gain += witnesses * 4
        break
      case 'resonance':
        gain += seeds * 4
        break
      case 'backflow':
        echoes += 2
        gain += 4 + relays
        break
      case 'rewrite':
        if (echoes > 0) {
          const echoGain = echoes * (pastCharge + 3)
          gain += echoGain
          addEvent(events, {
            kind: 'echo', lane: 'past', title: '未来回传',
            detail: `${echoes} 次回传让这张过去牌获得额外分数。`, gain: echoGain,
          })
          echoes = 0
        } else gain += anchors * 3
        break
      case 'cascade':
        gain += Math.floor((pastCharge + futureCharge + chain) / 2)
        break
      case 'paradox':
        gain += pastCharge + futureCharge + anchors * 3 + echoes * 4
        break
      case 'synchronize':
        gain += relays * 5 + futureCharge
        break
    }

    if (card.lane === 'past' && echoes > 0 && card.effect !== 'rewrite') {
      const echoGain = echoes * (card.power + seeds + 2)
      gain += echoGain
      addEvent(events, {
        kind: 'echo', lane: 'past', title: '未来回传',
        detail: `${echoes} 次回传让「${card.name}」再次加分。`, gain: echoGain,
      })
      echoes = 0
    }

    chain += addEvent(events, {
      kind: 'card', lane: card.lane, title: card.name,
      detail: card.lane === 'past' ? `过去积蓄 ${pastCharge}` : `未来积蓄 ${futureCharge}`,
      gain,
    })
    previousLane = card.lane
  }

  const closure = Math.floor((pastCharge + futureCharge) / 2) + anchors + relays * 2
  if (closure > 0) {
    chain += addEvent(events, {
      kind: 'surge', title: '三张牌结算', detail: '红色与蓝色牌的剩余能量转成最终分数。', gain: closure,
    })
  }

  const peakLabel = chain >= 70
    ? '超级爆发'
    : chain >= 45
      ? '大爆发'
      : chain >= 28
        ? '连锁爆发'
        : '连锁成功'

  return { chain, impact: chain, events, peakLabel }
}

function permutations<T>(items: T[], length: number): T[][] {
  if (length === 0) return [[]]
  const result: T[][] = []
  items.forEach((item, index) => {
    const remaining = [...items.slice(0, index), ...items.slice(index + 1)]
    for (const tail of permutations(remaining, length - 1)) result.push([item, ...tail])
  })
  return result
}

export function suggestPlan(hand: CardInstanceV1[], routeBonus: RouteBonus): string[] {
  const length = Math.min(3, hand.length)
  let best: CardInstanceV1[] = hand.slice(0, length)
  let bestImpact = -1
  for (const plan of permutations(hand, length)) {
    const impact = resolvePlan(plan, routeBonus).impact
    if (impact > bestImpact) {
      best = plan
      bestImpact = impact
    }
  }
  return best.map((card) => card.uid)
}

export function rewardOptions(rngState: number, count = 3): { options: V1CardId[]; rngState: number } {
  const pool = [...REWARD_POOL_V1]
  const options: V1CardId[] = []
  let state = rngState
  while (options.length < count && pool.length > 0) {
    const [roll, nextState] = nextRandom(state)
    state = nextState
    const index = Math.floor(roll * pool.length)
    options.push(pool.splice(index, 1)[0])
  }
  return { options, rngState: state }
}

export function rankCase(bestChain: number, target: number, emergencyRewind: boolean): CaseRank {
  if (!emergencyRewind && bestChain >= Math.ceil(target * 1.65)) return 'S'
  if (!emergencyRewind) return 'A'
  return 'B'
}

export function currentChapter(run: RunStateV1) {
  return CHAPTERS_V1[run.chapterIndex]
}
