import { CARDS, REWARD_POOL, START_DECK } from '../content/cards'
import { CHALLENGES, MAP_TEMPLATES, RELICS } from '../content/gameContent'
import type {
  CardId,
  ChallengeId,
  EncounterId,
  EventId,
  MapNode,
  MetaState,
  RelicId,
  RunState,
  ShopState,
} from './types'
import { sampleWeighted, seedHash, shuffleSeeded } from './random'

function cloneNode(id: string): MapNode {
  return { ...MAP_TEMPLATES[id] }
}

export function buildRandomLayers(initialState: number): { layers: MapNode[][]; rngState: number } {
  const configs: Array<{
    normal: EncounterId[]
    elite: EncounterId[]
    events: EventId[]
    rest: [string, string]
    shop: string
    boss: EncounterId
  }> = [
    { normal: ['fire', 'mirror', 'bell'], elite: ['twins', 'faceless'], events: ['telegram', 'photo'], rest: ['rest', 'rest2'], shop: 'shop', boss: 'curator' },
    { normal: ['station', 'hospital', 'press'], elite: ['chorus-elite', 'undertaker'], events: ['platform', 'obituary'], rest: ['rest3', 'rest4'], shop: 'shop2', boss: 'clockmaker' },
    { normal: ['vault', 'tomorrow', 'city'], elite: ['double', 'null'], events: ['unborn-letter', 'zero-key'], rest: ['rest5', 'rest6'], shop: 'shop3', boss: 'boss' },
  ]

  const layers: MapNode[][] = []
  let rngState = initialState
  for (const config of configs) {
    const normal = shuffleSeeded(config.normal, rngState)
    const elite = shuffleSeeded(config.elite, normal.state)
    const events = shuffleSeeded(config.events, elite.state)
    rngState = events.state
    layers.push(
      [cloneNode(normal.items[0]), cloneNode(events.items[0])],
      [cloneNode(normal.items[1]), cloneNode(config.rest[0])],
      [cloneNode(normal.items[2]), cloneNode(config.shop)],
      [cloneNode(elite.items[0]), cloneNode(events.items[1])],
      [cloneNode(elite.items[1]), cloneNode(config.rest[1])],
      [cloneNode(config.boss)],
    )
  }
  return { rngState, layers }
}

export function createRun(seed: string, modeId: ChallengeId, meta: MetaState): RunState {
  const mode = CHALLENGES[modeId]
  const generated = buildRandomLayers(seedHash(seed))
  const deck = [...START_DECK]
  if (modeId === 'zero') deck.push('alibi')
  if (meta.wins > 0) deck.push('annotation')

  return {
    timeline: mode.timeline,
    maxTimeline: mode.timeline,
    paradox: 0,
    paradoxLimit: mode.paradoxLimit,
    echoes: 10,
    deck,
    relics: meta.ink >= 3 ? ['watch'] : [],
    floor: 0,
    cleared: [],
    story: [`你在第十八次火灾前醒来。调查种子：${seed}。`],
    currentTitle: '追查灾难的起点',
    mode: modeId,
    seed,
    rngState: generated.rngState,
    layers: generated.layers,
  }
}

export function advanceNode(run: RunState): RunState {
  if (!run.currentNode) return run
  return {
    ...run,
    floor: run.floor + 1,
    cleared: [...run.cleared, { floor: run.floor, id: run.currentNode }],
  }
}

export function pickRewardOptions(run: RunState, count = 3): { run: RunState; options: CardId[] } {
  const kindCounts = new Map<string, number>()
  const tagCounts = new Map<string, number>()
  const cardCounts = new Map<CardId, number>()
  for (const cardId of run.deck) {
    const card = CARDS[cardId]
    kindCounts.set(card.kind, (kindCounts.get(card.kind) ?? 0) + 1)
    cardCounts.set(cardId, (cardCounts.get(cardId) ?? 0) + 1)
    for (const tag of card.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
  }

  const rarityWeight = { 普通: 1, 非凡: 0.58, 稀有: 0.2 } as const
  const sampled = sampleWeighted(
    REWARD_POOL,
    (cardId) => {
      const card = CARDS[cardId]
      const duplicatePenalty = 1 / (1 + (cardCounts.get(cardId) ?? 0) * 0.8)
      const missingKindBonus = (kindCounts.get(card.kind) ?? 0) < 2 ? 1.35 : 1
      const protectionGapBonus = card.tags.includes('防护') && (tagCounts.get('防护') ?? 0) < 3 ? 1.45 : 1
      const synergyBonus = card.tags.some((tag) => (tagCounts.get(tag) ?? 0) >= 3) ? 1.18 : 1
      return rarityWeight[card.rarity] * duplicatePenalty * missingKindBonus * protectionGapBonus * synergyBonus
    },
    count,
    run.rngState,
  )
  return { run: { ...run, rngState: sampled.state }, options: sampled.items }
}

export function pickEliteRelic(run: RunState): { run: RunState; relic?: RelicId } {
  const pool = (Object.keys(RELICS) as RelicId[]).filter((id) => !run.relics.includes(id))
  if (!pool.length) return { run }
  const shuffled = shuffleSeeded(pool, run.rngState)
  return { run: { ...run, rngState: shuffled.state }, relic: shuffled.items[0] }
}

export function createShop(run: RunState): { run: RunState; shop: ShopState } {
  const cards = shuffleSeeded(REWARD_POOL, run.rngState)
  const relicPool = (Object.keys(RELICS) as RelicId[]).filter((id) => !run.relics.includes(id))
  const relics = shuffleSeeded(relicPool.length ? relicPool : (['crane'] as RelicId[]), cards.state)
  return {
    run: { ...run, rngState: relics.state },
    shop: {
      cards: cards.items.slice(0, 3),
      relic: relics.items[0],
      bought: [],
      removing: false,
    },
  }
}

export function calculateInkGain(run: RunState, won: boolean): number {
  const base = won ? 8 : Math.max(1, Math.ceil((run.floor + 1) / 3))
  return Math.ceil(base * CHALLENGES[run.mode].inkMultiplier)
}
