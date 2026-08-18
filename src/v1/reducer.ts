import { CHAPTERS_V1 } from './content'
import {
  createRun,
  currentChapter,
  drawHand,
  mergeRouteBonuses,
  randomSeed,
  rankCase,
  resolvePlan,
  rewardOptions,
  suggestPlan,
} from './engine'
import { loadMetaV1, loadSessionV1 } from './storage'
import type { BattleStateV1, GameActionV1, GameStateV1, RunStateV1, V1CardId } from './types'

function newRunState(state: GameStateV1): GameStateV1 {
  const run = createRun(state.seedInput)
  return {
    ...state,
    screen: { name: 'map' },
    meta: { ...state.meta, runs: state.meta.runs + 1 },
    run,
    battle: null,
    resumable: null,
    seedInput: run.seed,
    notice: '双线已接通：先改变过去，再选择被改写的未来。',
  }
}

export function createInitialGameStateV1(): GameStateV1 {
  const meta = loadMetaV1()
  const resumable = loadSessionV1(meta)
  return {
    screen: { name: 'title' },
    meta,
    run: null,
    battle: null,
    resumable,
    seedInput: resumable?.run?.seed ?? randomSeed(),
  }
}

function beginBattle(run: RunStateV1, pastId: string, futureId: string): { run: RunStateV1; battle: BattleStateV1 } | null {
  const chapter = currentChapter(run)
  const past = chapter?.pastChoices.find((choice) => choice.id === pastId)
  const future = past?.futures.find((choice) => choice.id === futureId)
  if (!past || !future) return null
  const drawn = drawHand(run.deck, run.rngState, 1, future.openingCard)
  return {
    run: { ...run, currentPastId: past.id, currentFutureId: future.id, rngState: drawn.rngState },
    battle: {
      chapterId: chapter.id,
      round: 1,
      target: chapter.target,
      impact: 0,
      bestChain: 0,
      hand: drawn.hand,
      stagedUids: [],
      nextUid: drawn.nextUid,
      routeBonus: mergeRouteBonuses(past.bonus, future.bonus),
      openingCard: future.openingCard,
      won: false,
      emergencyRewind: false,
    },
  }
}

function finishChapter(state: GameStateV1, reward?: V1CardId): GameStateV1 {
  if (!state.run || !state.battle || !state.run.currentPastId || !state.run.currentFutureId) return state
  const chapter = currentChapter(state.run)
  const rank = rankCase(state.battle.bestChain, state.battle.target, state.battle.emergencyRewind)
  const record = {
    chapterId: chapter.id,
    pastId: state.run.currentPastId,
    futureId: state.run.currentFutureId,
    rank,
    bestChain: state.battle.bestChain,
  }
  const isLast = state.run.chapterIndex >= CHAPTERS_V1.length - 1
  const run: RunStateV1 = {
    ...state.run,
    chapterIndex: isLast ? state.run.chapterIndex : state.run.chapterIndex + 1,
    deck: reward ? [...state.run.deck, reward] : state.run.deck,
    records: [...state.run.records, record],
    currentPastId: undefined,
    currentFutureId: undefined,
    bestChain: Math.max(state.run.bestChain, state.battle.bestChain),
    totalImpact: state.run.totalImpact + state.battle.impact,
    rewinds: state.run.rewinds + (state.battle.emergencyRewind ? 1 : 0),
  }
  if (isLast) {
    return {
      ...state,
      screen: { name: 'ending' },
      run,
      battle: null,
      resumable: null,
      meta: {
        ...state.meta,
        wins: state.meta.wins + 1,
        bestChain: Math.max(state.meta.bestChain, run.bestChain),
      },
      notice: undefined,
    }
  }
  return {
    ...state,
    screen: { name: 'map' },
    run,
    battle: null,
    notice: `档案 ${chapter.number} 已闭合，下一组因果正在显现。`,
  }
}

export function gameReducerV1(state: GameStateV1, action: GameActionV1): GameStateV1 {
  switch (action.type) {
    case 'set-seed':
      return { ...state, seedInput: action.seed.slice(0, 36) }
    case 'randomize-seed':
      return { ...state, seedInput: randomSeed() }
    case 'start-run':
      return newRunState(state)
    case 'resume-run':
      return state.resumable
        ? { ...state.resumable, meta: state.meta, resumable: null, notice: '已从双线断点继续。' }
        : state
    case 'return-title': {
      const resumable = state.run && state.screen.name !== 'ending'
        ? { ...state, resumable: null, notice: undefined }
        : state.resumable
      return { ...state, screen: { name: 'title' }, run: null, battle: null, resumable, notice: undefined }
    }
    case 'restart':
      return newRunState({ ...state, seedInput: randomSeed() })
    case 'choose-past': {
      if (!state.run || state.screen.name !== 'map') return state
      const chapter = currentChapter(state.run)
      if (!chapter?.pastChoices.some((choice) => choice.id === action.choiceId)) return state
      return {
        ...state,
        run: { ...state.run, currentPastId: action.choiceId, currentFutureId: undefined },
        notice: '过去已经改变。现在选择它将抵达的未来。',
      }
    }
    case 'choose-future': {
      if (!state.run || !state.run.currentPastId || state.screen.name !== 'map') return state
      const begun = beginBattle(state.run, state.run.currentPastId, action.choiceId)
      if (!begun) return state
      return { ...state, ...begun, screen: { name: 'battle' }, notice: undefined }
    }
    case 'toggle-stage': {
      if (!state.battle || state.screen.name !== 'battle' || state.battle.resolution) return state
      if (!state.battle.hand.some((card) => card.uid === action.uid)) return state
      const staged = state.battle.stagedUids
      if (staged.includes(action.uid)) {
        return { ...state, battle: { ...state.battle, stagedUids: staged.filter((uid) => uid !== action.uid) } }
      }
      if (staged.length >= 3) return { ...state, notice: '一次最多闭合 3 张牌；再次点击可撤下。' }
      return { ...state, battle: { ...state.battle, stagedUids: [...staged, action.uid] }, notice: undefined }
    }
    case 'auto-stage':
      if (!state.battle || state.battle.resolution) return state
      return {
        ...state,
        battle: { ...state.battle, stagedUids: suggestPlan(state.battle.hand, state.battle.routeBonus) },
        notice: '已排好本轮最高爆发。你也可以换顺序试试。',
      }
    case 'clear-stage':
      return state.battle && !state.battle.resolution
        ? { ...state, battle: { ...state.battle, stagedUids: [] }, notice: undefined }
        : state
    case 'resolve-chain': {
      if (!state.battle || state.battle.resolution || state.battle.stagedUids.length === 0) {
        return state.battle ? { ...state, notice: '先放入至少 1 张牌，或者直接使用“一键爽打”。' } : state
      }
      const cards = state.battle.stagedUids
        .map((uid) => state.battle?.hand.find((card) => card.uid === uid))
        .filter((card): card is NonNullable<typeof card> => Boolean(card))
      let resolution = resolvePlan(cards, state.battle.routeBonus)
      const rawImpact = state.battle.impact + resolution.impact
      const emergencyRewind = state.battle.round >= 3 && rawImpact < state.battle.target
      if (emergencyRewind) {
        const missing = state.battle.target - rawImpact
        resolution = {
          ...resolution,
          impact: resolution.impact + missing,
          chain: resolution.chain + missing,
          peakLabel: '紧急回溯',
          events: [...resolution.events, {
            kind: 'rewind', title: '档案局紧急回溯',
            detail: '第三轮仍未闭合时，系统替你把关键动作送回过去。', gain: missing,
          }],
        }
      }
      const impact = state.battle.impact + resolution.impact
      const bestChain = Math.max(state.battle.bestChain, resolution.chain)
      const won = impact >= state.battle.target
      return {
        ...state,
        battle: { ...state.battle, impact, bestChain, resolution, won, emergencyRewind },
        notice: undefined,
      }
    }
    case 'continue-after-chain': {
      if (!state.battle?.resolution || !state.run) return state
      if (state.battle.won) {
        const reward = rewardOptions(state.run.rngState)
        return {
          ...state,
          screen: {
            name: 'reward',
            options: reward.options,
            rank: rankCase(state.battle.bestChain, state.battle.target, state.battle.emergencyRewind),
          },
          run: { ...state.run, rngState: reward.rngState },
          notice: undefined,
        }
      }
      const drawn = drawHand(state.run.deck, state.run.rngState, state.battle.nextUid)
      return {
        ...state,
        run: { ...state.run, rngState: drawn.rngState },
        battle: {
          ...state.battle,
          round: state.battle.round + 1,
          hand: drawn.hand,
          stagedUids: [],
          nextUid: drawn.nextUid,
          resolution: undefined,
        },
        notice: '新一轮已展开；路线余波会继续为你提供基础爆发。',
      }
    }
    case 'choose-reward':
      return state.screen.name === 'reward' && state.screen.options.includes(action.cardId)
        ? finishChapter(state, action.cardId)
        : state
    case 'skip-reward':
      return state.screen.name === 'reward' ? finishChapter(state) : state
    case 'complete-tutorial':
      return { ...state, meta: { ...state.meta, tutorialDone: true } }
    case 'toggle-sound':
      return { ...state, meta: { ...state.meta, soundEnabled: !state.meta.soundEnabled } }
    case 'set-sound-volume':
      return { ...state, meta: { ...state.meta, soundVolume: Math.max(10, Math.min(300, Math.round(action.volume))) } }
    case 'clear-notice':
      return { ...state, notice: undefined }
    default:
      return state
  }
}
