import { CARDS } from '../content/cards'
import { CHALLENGES, ENCOUNTERS, RELICS } from '../content/gameContent'
import {
  placeSelectedCard,
  removePlacedCard,
  resolveTimeline,
  selectCard,
  startBattle,
} from '../domain/battle'
import {
  advanceNode,
  calculateInkGain,
  createRun,
  createShop,
  pickEliteRelic,
  pickRewardOptions,
} from '../domain/run'
import type { CardId, ChallengeId, Era, GameState, MetaState, RelicId, RunState } from '../domain/types'
import { loadMeta, loadSession } from './storage'

export type GameAction =
  | { type: 'set-mode'; mode: ChallengeId }
  | { type: 'set-seed'; seed: string }
  | { type: 'randomize-seed' }
  | { type: 'start-run' }
  | { type: 'resume-run' }
  | { type: 'return-title' }
  | { type: 'restart' }
  | { type: 'select-node'; nodeId: string }
  | { type: 'select-card'; uid: string }
  | { type: 'place-card'; era: Era }
  | { type: 'remove-placed'; uid: string }
  | { type: 'resolve-timeline' }
  | { type: 'choose-reward'; cardId: CardId }
  | { type: 'skip-reward' }
  | { type: 'choose-event'; choice: 'read' | 'burn' | 'keep' | 'cut' }
  | { type: 'choose-rest'; choice: 'heal' | 'calm' | 'remove' }
  | { type: 'remove-rest-card'; index: number }
  | { type: 'buy-shop-card'; index: number }
  | { type: 'buy-shop-relic' }
  | { type: 'buy-shop-heal' }
  | { type: 'open-shop-remove' }
  | { type: 'cancel-shop-remove' }
  | { type: 'remove-shop-card'; index: number }
  | { type: 'leave-shop' }
  | { type: 'clear-notice' }

function randomSeed(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export function createInitialGameState(): GameState {
  const meta = loadMeta()
  const resumable = loadSession(meta)
  return {
    screen: { name: 'title' },
    meta,
    selectedMode: meta.lastMode,
    seedInput: randomSeed(),
    run: null,
    battle: null,
    resumable,
  }
}

function withCurrentNode(run: RunState, nodeId: string): RunState | null {
  const node = run.layers[run.floor]?.find((candidate) => candidate.id === nodeId)
  if (!node) return null
  return { ...run, currentNode: node.id, currentTitle: node.title }
}

function advanceToMap(state: GameState, run: RunState): GameState {
  return { ...state, run: advanceNode(run), battle: null, screen: { name: 'map' } }
}

function finishRun(state: GameState, run: RunState, won: boolean, reason: string): GameState {
  const inkGain = calculateInkGain(run, won)
  const meta: MetaState = {
    ...state.meta,
    runs: state.meta.runs + 1,
    wins: state.meta.wins + (won ? 1 : 0),
    ink: state.meta.ink + inkGain,
  }
  const story = won ? [...run.story, '零时档案被改写，但第零号档案仍未开启。'] : run.story
  return {
    ...state,
    run: { ...run, story },
    battle: null,
    meta,
    resumable: null,
    screen: { name: 'ending', won, reason, inkGain },
  }
}

function updateShop(state: GameState, run: RunState, shop: Extract<GameState['screen'], { name: 'shop' }>['shop']): GameState {
  return { ...state, run, screen: { name: 'shop', shop } }
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  if (action.type === 'set-mode') {
    return { ...state, selectedMode: action.mode, meta: { ...state.meta, lastMode: action.mode } }
  }
  if (action.type === 'set-seed') return { ...state, seedInput: action.seed }
  if (action.type === 'randomize-seed') return { ...state, seedInput: randomSeed() }
  if (action.type === 'start-run') {
    const seed = state.seedInput.trim() || randomSeed()
    const meta = { ...state.meta, lastMode: state.selectedMode }
    return {
      ...state,
      meta,
      seedInput: seed,
      run: createRun(seed, state.selectedMode, meta),
      battle: null,
      resumable: null,
      screen: { name: 'map' },
      notice: undefined,
    }
  }
  if (action.type === 'resume-run' && state.resumable) {
    return { ...state.resumable, meta: { ...state.meta, ...state.resumable.meta }, resumable: null }
  }
  if (action.type === 'return-title') {
    const resumable = state.run && state.screen.name !== 'ending' ? { ...state, resumable: null } : state.resumable
    return { ...state, screen: { name: 'title' }, run: null, battle: null, resumable }
  }
  if (action.type === 'restart') {
    return { ...state, screen: { name: 'title' }, run: null, battle: null, resumable: null, notice: undefined }
  }
  if (action.type === 'clear-notice') return { ...state, notice: undefined }
  if (!state.run) return state

  if (action.type === 'select-node') {
    const run = withCurrentNode(state.run, action.nodeId)
    if (!run) return state
    const node = run.layers[run.floor].find((candidate) => candidate.id === action.nodeId)!
    if (node.type === 'battle' || node.type === 'elite' || node.type === 'boss') {
      const started = startBattle(run, node.id as Parameters<typeof startBattle>[1])
      return { ...state, run: started.run, battle: started.battle, screen: { name: 'battle' } }
    }
    if (node.type === 'event') return { ...state, run, battle: null, screen: { name: 'event', eventId: node.id === 'photo' ? 'photo' : 'telegram' } }
    if (node.type === 'rest') return { ...state, run, battle: null, screen: { name: 'rest', removing: false } }
    if (node.type === 'shop') {
      const created = createShop(run)
      return { ...state, run: created.run, battle: null, screen: { name: 'shop', shop: created.shop } }
    }
    return state
  }

  if (action.type === 'select-card' && state.battle) {
    return { ...state, battle: selectCard(state.battle, action.uid) }
  }
  if (action.type === 'place-card' && state.battle) {
    return { ...state, battle: placeSelectedCard(state.run, state.battle, action.era) }
  }
  if (action.type === 'remove-placed' && state.battle) {
    return { ...state, battle: removePlacedCard(state.battle, action.uid) }
  }
  if (action.type === 'resolve-timeline' && state.battle && state.battle.placed.length) {
    const result = resolveTimeline(state.run, state.battle)
    if (result.outcome === 'run-lost') return finishRun(state, result.run, false, result.reason ?? '这条历史无法成立。')
    if (result.outcome === 'run-won') return finishRun(state, result.run, true, '你阻止了零点火灾。')
    if (result.outcome === 'battle-won') {
      const elite = result.battle.encounterId === 'twins' || result.battle.encounterId === 'faceless'
      const gain = elite ? 18 : 12
      let run: RunState = {
        ...result.run,
        echoes: result.run.echoes + gain,
        story: [
          ...result.run.story,
          `${ENCOUNTERS[result.battle.encounterId].name}已结案，留下 ${result.battle.truth} 点真相与 ${gain} 枚回声。`,
        ],
      }
      let relicGained: RelicId | undefined
      if (elite) {
        const relicResult = pickEliteRelic(run)
        run = relicResult.run
        relicGained = relicResult.relic
        if (relicGained) run = { ...run, relics: [...run.relics, relicGained] }
      }
      const rewards = pickRewardOptions(run)
      return {
        ...state,
        run: rewards.run,
        battle: null,
        screen: { name: 'reward', options: rewards.options, gain, relicGained },
      }
    }
    return { ...state, run: result.run, battle: result.battle }
  }

  if (action.type === 'choose-reward' && state.screen.name === 'reward') {
    return advanceToMap(state, { ...state.run, deck: [...state.run.deck, action.cardId] })
  }
  if (action.type === 'skip-reward' && state.screen.name === 'reward') {
    return advanceToMap(state, {
      ...state.run,
      timeline: Math.min(state.run.maxTimeline, state.run.timeline + 3),
    })
  }
  if (action.type === 'choose-event' && state.screen.name === 'event') {
    let run = { ...state.run, deck: [...state.run.deck], story: [...state.run.story] }
    if (action.choice === 'read') {
      run.deck.push('annotation')
      run.paradox += 1
      run.story.push('无字电报证明：档案馆才是灾难起点。')
    }
    if (action.choice === 'burn') {
      run.timeline = Math.min(run.maxTimeline, run.timeline + 6)
      run.story.push('你烧掉未来的电报，只记住了纸灰的形状。')
    }
    if (action.choice === 'keep') {
      run.maxTimeline -= 3
      run.timeline = Math.min(run.timeline, run.maxTimeline)
      run.deck.push('anchor')
      run.story.push('合影里多出的自己，来自第零号时间线。')
    }
    if (action.choice === 'cut') {
      run.paradox = Math.max(0, run.paradox - 3)
      run.story.push('照片忘记了你，但镜子没有。')
    }
    return advanceToMap(state, run)
  }
  if (action.type === 'choose-rest' && state.screen.name === 'rest') {
    if (action.choice === 'remove') return { ...state, screen: { name: 'rest', removing: true } }
    const run = { ...state.run, story: [...state.run.story] }
    if (action.choice === 'heal') {
      run.timeline = Math.min(run.maxTimeline, run.timeline + 10)
      run.story.push('回声室让断裂的时间重新接合。')
    } else {
      run.paradox = Math.max(0, run.paradox - 3)
      run.story.push('你放弃了一段危险记忆。')
    }
    return advanceToMap(state, run)
  }
  if (action.type === 'remove-rest-card' && state.screen.name === 'rest' && state.screen.removing) {
    if (!state.run.deck[action.index]) return state
    const deck = [...state.run.deck]
    const [removed] = deck.splice(action.index, 1)
    return advanceToMap(state, {
      ...state.run,
      deck,
      story: [...state.run.story, `你在回声室烧掉了「${CARDS[removed].name}」。`],
    })
  }

  if (state.screen.name === 'shop') {
    const shop = { ...state.screen.shop, cards: [...state.screen.shop.cards], bought: [...state.screen.shop.bought] }
    if (action.type === 'buy-shop-card') {
      const key = `card-${action.index}`
      const cardId = shop.cards[action.index]
      if (!cardId || shop.bought.includes(key) || state.run.echoes < 12) return state
      shop.bought.push(key)
      return updateShop(state, { ...state.run, echoes: state.run.echoes - 12, deck: [...state.run.deck, cardId] }, shop)
    }
    if (action.type === 'buy-shop-relic') {
      if (shop.bought.includes('relic') || state.run.echoes < 25) return state
      shop.bought.push('relic')
      return updateShop(state, { ...state.run, echoes: state.run.echoes - 25, relics: [...state.run.relics, shop.relic] }, shop)
    }
    if (action.type === 'buy-shop-heal') {
      if (shop.bought.includes('heal') || state.run.echoes < 10) return state
      shop.bought.push('heal')
      return updateShop(
        state,
        { ...state.run, echoes: state.run.echoes - 10, timeline: Math.min(state.run.maxTimeline, state.run.timeline + 8) },
        shop,
      )
    }
    if (action.type === 'open-shop-remove') {
      if (shop.bought.includes('remove') || state.run.echoes < 15) return state
      return updateShop(state, state.run, { ...shop, removing: true })
    }
    if (action.type === 'cancel-shop-remove') return updateShop(state, state.run, { ...shop, removing: false })
    if (action.type === 'remove-shop-card') {
      const cardId = state.run.deck[action.index]
      if (!cardId || shop.bought.includes('remove') || state.run.echoes < 15) return state
      const deck = [...state.run.deck]
      deck.splice(action.index, 1)
      shop.bought.push('remove')
      return updateShop(
        { ...state, notice: `已删除「${CARDS[cardId].name}」。` },
        { ...state.run, echoes: state.run.echoes - 15, deck },
        { ...shop, removing: false },
      )
    }
    if (action.type === 'leave-shop') return advanceToMap(state, state.run)
  }

  return state
}

