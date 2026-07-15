import { CARDS } from '../content/cards'
import { EVENTS } from '../content/events'
import { currentIncident, effectiveCost } from '../domain/battle'
import type { CardId, ChallengeId, GameState, MetaState } from '../domain/types'
import { gameReducer } from '../game/reducer'

const META: MetaState = {
  runs: 0,
  wins: 0,
  ink: 0,
  tutorialDone: true,
  soundEnabled: false,
  lastMode: 'standard',
}

const CARD_PRIORITY: CardId[] = [
  'ledger',
  'chorus',
  'echo',
  'testimony',
  'thread',
  'doorplate',
  'delay',
  'seal',
  'clarify',
  'anchor',
  'annotation',
  'rescue',
  'sealorder',
  'secondhand',
  'memory',
  'blackout',
  'rewind',
  'vow',
  'alibi',
  'erase',
]

const REWARD_PRIORITY: CardId[] = [
  'thread',
  'doorplate',
  'delay',
  'chorus',
  'testimony',
  'echo',
  'sealorder',
  'annotation',
  'ledger',
  'anchor',
  'clarify',
  'secondhand',
  'blackout',
  'rewind',
  'memory',
  'vow',
  'erase',
  'alibi',
]

function createSimulationState(seed: string, mode: ChallengeId): GameState {
  return {
    screen: { name: 'title' },
    meta: META,
    selectedMode: mode,
    seedInput: seed,
    run: null,
    battle: null,
    resumable: null,
  }
}

function preferredEra(cardId: CardId): 0 | 1 | 2 {
  if (cardId === 'rescue' || cardId === 'thread') return 1
  if (cardId === 'annotation' || cardId === 'delay' || cardId === 'secondhand') return 2
  return 0
}

function playBattleTurn(input: GameState): GameState {
  let state = input
  if (!state.run || !state.battle) return state
  const incident = currentIncident(state.battle)
  const cards = [...state.battle.hand].sort(
    (left, right) => CARD_PRIORITY.indexOf(left.cardId) - CARD_PRIORITY.indexOf(right.cardId),
  )

  for (const original of cards) {
    if (!state.run || !state.battle) break
    const card = state.battle.hand.find((candidate) => candidate.uid === original.uid)
    if (!card || state.battle.placed.some((placed) => placed.uid === card.uid)) continue
    const cost = effectiveCost(state.run, state.battle, card)
    if (cost > state.battle.energy) continue
    const addsParadox = ['alibi', 'memory', 'blackout', 'rewind', 'erase'].includes(card.cardId)
      || (card.cardId === 'secondhand' && preferredEra(card.cardId) !== 2)
    if (addsParadox && state.run.paradox >= state.run.paradoxLimit - 2) continue

    state = gameReducer(state, { type: 'select-card', uid: card.uid })
    let era = preferredEra(card.cardId)
    if (card.cardId === 'anchor' || card.cardId === 'clarify' || card.cardId === 'seal') {
      era = Math.min(incident.era, 2) as 0 | 1 | 2
    }
    state = gameReducer(state, { type: 'place-card', era })
  }

  return gameReducer(state, { type: 'resolve-timeline' })
}

export interface SimulationResult {
  seed: string
  won: boolean
  terminal: boolean
  actions: number
  floor: number
  timeline: number
  paradox: number
  reason?: string
  mode: ChallengeId
}

export type SimulationPolicy = 'combat' | 'balanced'

export function chooseMapNode(state: GameState, policy: SimulationPolicy) {
  if (!state.run) return undefined
  const layer = state.run.layers[state.run.floor] ?? []
  const combat = layer.find((candidate) => ['battle', 'elite', 'boss'].includes(candidate.type)) ?? layer[0]
  if (policy === 'combat') return combat
  const rest = layer.find((candidate) => candidate.type === 'rest')
  if (rest) {
    const upgraded = state.run.deck.filter((card) => card.upgraded).length
    const act = Math.floor(state.run.floor / 6)
    if (state.run.paradox >= 2 || state.run.timeline <= state.run.maxTimeline - 4 || upgraded < act + 1) return rest
  }
  const shop = layer.find((candidate) => candidate.type === 'shop')
  if (shop && (state.run.echoes >= 12 || state.run.timeline <= state.run.maxTimeline - 6)) return shop
  const event = layer.find((candidate) => candidate.type === 'event')
  if (event && state.run.floor % 6 === 3) return event
  return combat
}

function preferredUpgradeIndex(state: GameState): number {
  if (!state.run) return -1
  let bestIndex = -1
  let bestPriority = Number.POSITIVE_INFINITY
  state.run.deck.forEach((card, index) => {
    if (card.upgraded) return
    const priority = REWARD_PRIORITY.indexOf(card.cardId)
    const normalized = priority < 0 ? REWARD_PRIORITY.length : priority
    if (normalized < bestPriority) {
      bestPriority = normalized
      bestIndex = index
    }
  })
  return bestIndex
}

function preferredEventChoice(state: GameState): string {
  if (!state.run || state.screen.name !== 'event') return ''
  const safeParadox = state.run.paradox <= state.run.paradoxLimit - 3
  const choices: Record<typeof state.screen.eventId, string> = {
    telegram: safeParadox ? 'read' : 'burn',
    photo: state.run.maxTimeline >= 26 ? 'keep' : 'cut',
    platform: state.run.timeline > 12 ? 'board' : 'wait',
    obituary: state.run.timeline <= state.run.maxTimeline - 5 ? 'redact' : 'sign',
    'unborn-letter': safeParadox ? 'answer' : 'seal',
    'zero-key': safeParadox ? 'take' : 'copy',
  }
  return choices[state.screen.eventId] ?? EVENTS[state.screen.eventId].choices[0].id
}

export function simulateRun(seed: string, actionLimit = 500, policy: SimulationPolicy = 'combat', mode: ChallengeId = 'standard'): SimulationResult {
  let state = gameReducer(createSimulationState(seed, mode), { type: 'start-run' })
  let actions = 1

  while (state.screen.name !== 'ending' && actions < actionLimit) {
    if (!state.run) break
    if (state.screen.name === 'map') {
      const node = chooseMapNode(state, policy)
      if (!node) break
      state = gameReducer(state, { type: 'select-node', nodeId: node.id })
    } else if (state.screen.name === 'battle') {
      state = playBattleTurn(state)
    } else if (state.screen.name === 'reward') {
      const option = [...state.screen.options].sort(
        (left, right) => REWARD_PRIORITY.indexOf(left) - REWARD_PRIORITY.indexOf(right),
      )[0]
      state = gameReducer(state, option ? { type: 'choose-reward', cardId: option } : { type: 'skip-reward' })
    } else if (state.screen.name === 'event') {
      const preferredChoice = policy === 'balanced'
        ? preferredEventChoice(state)
        : state.screen.eventId === 'telegram' ? 'burn' : state.screen.eventId === 'photo' ? 'cut' : EVENTS[state.screen.eventId].choices[0].id
      state = gameReducer(state, { type: 'choose-event', choiceId: preferredChoice })
    } else if (state.screen.name === 'rest') {
      if (state.screen.upgrading) {
        const index = preferredUpgradeIndex(state)
        state = index >= 0 ? gameReducer(state, { type: 'upgrade-rest-card', index }) : gameReducer(state, { type: 'cancel-rest-edit' })
      } else {
        state = gameReducer(state, {
          type: 'choose-rest',
          choice: state.run.paradox >= 2 ? 'calm' : state.run.timeline <= state.run.maxTimeline - 8 ? 'heal' : policy === 'balanced' ? 'upgrade' : 'heal',
        })
      }
    } else if (state.screen.name === 'shop') {
      if (policy === 'balanced' && state.screen.shop.upgrading) {
        const index = preferredUpgradeIndex(state)
        state = index >= 0 ? gameReducer(state, { type: 'upgrade-shop-card', index }) : gameReducer(state, { type: 'cancel-shop-upgrade' })
      } else if (policy === 'balanced' && state.run.timeline <= state.run.maxTimeline - 6 && state.run.echoes >= 10 && !state.screen.shop.bought.includes('heal')) {
        state = gameReducer(state, { type: 'buy-shop-heal' })
      } else if (policy === 'balanced' && state.run.echoes >= 25 && !state.screen.shop.bought.includes('relic') && !state.run.relics.includes(state.screen.shop.relic)) {
        state = gameReducer(state, { type: 'buy-shop-relic' })
      } else if (policy === 'balanced' && state.run.echoes >= 18 && !state.screen.shop.bought.includes('upgrade') && state.run.deck.some((card) => !card.upgraded)) {
        state = gameReducer(state, { type: 'open-shop-upgrade' })
      } else {
        state = gameReducer(state, { type: 'leave-shop' })
      }
    } else if (state.screen.name === 'chapter') {
      state = gameReducer(state, { type: 'continue-chapter' })
    }
    actions += 1
  }

  return {
    seed,
    won: state.screen.name === 'ending' && state.screen.won,
    terminal: state.screen.name === 'ending',
    actions,
    floor: state.run?.floor ?? 0,
    timeline: state.run?.timeline ?? 0,
    paradox: state.run?.paradox ?? 0,
    reason: state.screen.name === 'ending' ? state.screen.reason : undefined,
    mode,
  }
}

export function describeDeck(state: GameState): string[] {
  return state.run?.deck.map(({ cardId, upgraded }) => `${CARDS[cardId].name}${upgraded ? '+' : ''}`) ?? []
}
