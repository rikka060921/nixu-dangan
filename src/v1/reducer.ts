import { CHAPTERS_V1 } from './content'
import {
  createRun,
  currentChapter,
  drawHand,
  mergeRouteBonuses,
  randomSeed,
  rankCase,
  rewindCandidates,
  resolvePlan,
  rewardOptions,
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
    notice: '第一步：先在红色区域任选一件过去发生的事。',
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
      rewindTargetUid: undefined,
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
    notice: `第 ${Number(chapter.number)} 关已通过，下一关已经打开。`,
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
        notice: '很好！蓝色未来已经改变，现在从中选择一个结果。',
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
        const stagedUids = staged.filter((uid) => uid !== action.uid)
        return { ...state, battle: { ...state.battle, stagedUids, rewindTargetUid: stagedUids.includes(state.battle.rewindTargetUid ?? '') ? state.battle.rewindTargetUid : undefined } }
      }
      if (staged.length >= 3) return { ...state, notice: '一次只能使用 3 张牌；再次点击已选牌可以撤下。' }
      const selectedCard = state.battle.hand.find((card) => card.uid === action.uid)
      const stagedHasBackflow = staged.some((uid) => state.battle?.hand.find((card) => card.uid === uid)?.cardId === 'backflow')
      if (selectedCard?.cardId === 'backflow' && stagedHasBackflow) {
        return { ...state, notice: '一段三牌时间线只能使用一张「时间回传」。' }
      }
      return { ...state, battle: { ...state.battle, stagedUids: [...staged, action.uid] }, notice: undefined }
    }
    case 'apply-strategy': {
      if (!state.battle || state.battle.resolution) return state
      const available = new Set(state.battle.hand.map((card) => card.uid))
      const uids = action.uids.filter((uid, index) => available.has(uid) && action.uids.indexOf(uid) === index).slice(0, 3)
      if (uids.length !== 3) return state
      return {
        ...state,
        battle: { ...state.battle, stagedUids: uids, rewindTargetUid: action.rewindTargetUid },
        notice: '参考方案已经放入时间线。请阅读选择理由，也可以自己替换任意一张牌。',
      }
    }
    case 'set-rewind-target': {
      if (!state.battle || state.battle.resolution) return state
      const stagedCards = state.battle.stagedUids
        .map((uid) => state.battle?.hand.find((card) => card.uid === uid))
        .filter((card): card is NonNullable<typeof card> => Boolean(card))
      if (!rewindCandidates(stagedCards).some((card) => card.uid === action.uid)) return state
      return { ...state, battle: { ...state.battle, rewindTargetUid: action.uid }, notice: '回传目标已选择；结算时会从这张牌开始重放。' }
    }
    case 'clear-stage':
      return state.battle && !state.battle.resolution
        ? { ...state, battle: { ...state.battle, stagedUids: [], rewindTargetUid: undefined }, notice: undefined }
        : state
    case 'resolve-chain': {
      if (!state.battle || state.battle.resolution || state.battle.stagedUids.length !== 3) {
        return state.battle ? { ...state, notice: '需要按顺序放入 3 张牌。拿不准时，可以先查看下方的参考打法。' } : state
      }
      const cards = state.battle.stagedUids
        .map((uid) => state.battle?.hand.find((card) => card.uid === uid))
        .filter((card): card is NonNullable<typeof card> => Boolean(card))
      if (cards.filter((card) => card.cardId === 'backflow').length > 1) {
        return { ...state, notice: '一段三牌时间线只能使用一张「时间回传」。' }
      }
      const candidates = rewindCandidates(cards)
      if (cards.some((card) => card.cardId === 'backflow') && candidates.length === 0) {
        return { ...state, notice: '时间回传必须放在至少一张过去牌后面，否则没有可以返回的时刻。' }
      }
      if (candidates.length > 0 && !candidates.some((card) => card.uid === state.battle?.rewindTargetUid)) {
        return { ...state, notice: '时间回传需要一个目标：请选择它要返回的过去牌。' }
      }
      const resolution = resolvePlan(cards, state.battle.routeBonus, state.battle.rewindTargetUid)
      const impact = state.battle.impact + resolution.impact
      const bestChain = Math.max(state.battle.bestChain, resolution.chain)
      const won = impact >= state.battle.target
      return {
        ...state,
        battle: { ...state.battle, impact, bestChain, resolution, won },
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
      const reducedTarget = state.battle.round >= 3
        ? Math.max(state.battle.impact + 8, Math.floor(state.battle.target * 0.85))
        : state.battle.target
      const protectionUsed = reducedTarget < state.battle.target
      return {
        ...state,
        run: { ...state.run, rngState: drawn.rngState },
        battle: {
          ...state.battle,
          round: state.battle.round + 1,
          target: reducedTarget,
          hand: drawn.hand,
          stagedUids: [],
          rewindTargetUid: undefined,
          nextUid: drawn.nextUid,
          resolution: undefined,
          emergencyRewind: state.battle.emergencyRewind || protectionUsed,
        },
        notice: protectionUsed
          ? `没有自动补分；本关目标降低到 ${reducedTarget}。下一次仍需要你亲手完成组合。`
          : '新一轮开始。看看这次手牌能组成“稳妥得分”还是“时间回传”。',
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
