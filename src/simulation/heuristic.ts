import { CARDS } from '../content/cards'
import { EVENTS } from '../content/events'
import { currentIncident, effectiveCost } from '../domain/battle'
import type { CardId, GameState, MetaState } from '../domain/types'
import { gameReducer } from '../game/reducer'

const META: MetaState = {
  runs: 0,
  wins: 0,
  ink: 0,
  tutorialDone: true,
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

function createSimulationState(seed: string): GameState {
  return {
    screen: { name: 'title' },
    meta: META,
    selectedMode: 'standard',
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
}

export function simulateRun(seed: string, actionLimit = 500): SimulationResult {
  let state = gameReducer(createSimulationState(seed), { type: 'start-run' })
  let actions = 1

  while (state.screen.name !== 'ending' && actions < actionLimit) {
    if (!state.run) break
    if (state.screen.name === 'map') {
      const layer = state.run.layers[state.run.floor] ?? []
      const node = layer.find((candidate) => ['battle', 'elite', 'boss'].includes(candidate.type)) ?? layer[0]
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
      const preferredChoice = state.screen.eventId === 'telegram' ? 'burn' : state.screen.eventId === 'photo' ? 'cut' : EVENTS[state.screen.eventId].choices[0].id
      state = gameReducer(state, { type: 'choose-event', choiceId: preferredChoice })
    } else if (state.screen.name === 'rest') {
      state = gameReducer(state, {
        type: 'choose-rest',
        choice: state.run.paradox >= 3 ? 'calm' : 'heal',
      })
    } else if (state.screen.name === 'shop') {
      state = gameReducer(state, { type: 'leave-shop' })
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
  }
}

export function describeDeck(state: GameState): string[] {
  return state.run?.deck.map((cardId) => CARDS[cardId].name) ?? []
}
