import { REWARD_POOL, START_DECK } from '../content/cards'
import { CHALLENGES, MAP_TEMPLATES, RELICS } from '../content/gameContent'
import type {
  CardId,
  ChallengeId,
  EncounterId,
  MapNode,
  MetaState,
  RelicId,
  RunState,
  ShopState,
} from './types'
import { seedHash, shuffleSeeded } from './random'

function cloneNode(id: string): MapNode {
  return { ...MAP_TEMPLATES[id] }
}

export function buildRandomLayers(initialState: number): { layers: MapNode[][]; rngState: number } {
  const normal = shuffleSeeded<EncounterId>(['fire', 'mirror', 'bell'], initialState)
  const elite = shuffleSeeded<EncounterId>(['twins', 'faceless'], normal.state)
  const events = shuffleSeeded(['telegram', 'photo'] as const, elite.state)

  return {
    rngState: events.state,
    layers: [
      [cloneNode(normal.items[0]), cloneNode(events.items[0])],
      [cloneNode(normal.items[1]), cloneNode('rest')],
      [cloneNode(normal.items[2]), cloneNode('shop')],
      [cloneNode(elite.items[0]), cloneNode(events.items[1])],
      [cloneNode(elite.items[1]), cloneNode('rest2')],
      [cloneNode('boss')],
    ],
  }
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
  const shuffled = shuffleSeeded(REWARD_POOL, run.rngState)
  return { run: { ...run, rngState: shuffled.state }, options: shuffled.items.slice(0, count) }
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
  const base = won ? 3 : Math.max(1, run.floor)
  return Math.ceil(base * CHALLENGES[run.mode].inkMultiplier)
}

