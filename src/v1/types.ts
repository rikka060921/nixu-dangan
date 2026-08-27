export type TimelineLane = 'past' | 'future'

export type V1CardId =
  | 'seed'
  | 'witness'
  | 'anchor'
  | 'signal'
  | 'echo'
  | 'testimony'
  | 'resonance'
  | 'backflow'
  | 'rewrite'
  | 'cascade'
  | 'paradox'
  | 'synchronize'

export type CardEffect = V1CardId
export type CardRarity = '常规' | '闪光' | '失控'

export interface V1CardDefinition {
  id: V1CardId
  name: string
  glyph: string
  lane: TimelineLane
  effect: CardEffect
  power: number
  rarity: CardRarity
  brief: string
  link: string
}

export interface RouteBonus {
  seeds?: number
  witnesses?: number
  anchors?: number
  echoes?: number
}

export interface FutureChoice {
  id: string
  title: string
  glyph: string
  brief: string
  result: string
  bonus: RouteBonus
  openingCard: V1CardId
  dialogue?: { speaker: string; text: string }
  battleRule?: string
}

export interface PastChoice {
  id: string
  title: string
  glyph: string
  brief: string
  result: string
  bonus: RouteBonus
  futures: FutureChoice[]
}

export interface ChapterDefinition {
  id: string
  number: string
  title: string
  subtitle: string
  story: string
  opening?: { speaker: string; text: string }
  ending?: { speaker: string; text: string }
  target: number
  pastChoices: PastChoice[]
}

export interface RouteRecord {
  chapterId: string
  pastId: string
  futureId: string
  rank: CaseRank
  bestChain: number
}

export interface RunStateV1 {
  seed: string
  rngState: number
  chapterIndex: number
  deck: V1CardId[]
  records: RouteRecord[]
  currentPastId?: string
  currentFutureId?: string
  bestChain: number
  totalImpact: number
  rewinds: number
}

export interface CardInstanceV1 {
  uid: string
  cardId: V1CardId
}

export interface ChainEvent {
  kind: 'card' | 'relay' | 'echo' | 'surge' | 'rewind'
  lane?: TimelineLane
  title: string
  detail: string
  gain: number
}

export interface ChainResolution {
  chain: number
  impact: number
  events: ChainEvent[]
  peakLabel: string
}

export interface StrategyPlan {
  id: 'steady' | 'rewind' | 'alternate'
  label: string
  summary: string
  reasons: string[]
  uids: string[]
  rewindTargetUid?: string
  impact: number
}

export interface BattleStateV1 {
  chapterId: string
  round: number
  target: number
  impact: number
  bestChain: number
  hand: CardInstanceV1[]
  stagedUids: string[]
  rewindTargetUid?: string
  nextUid: number
  routeBonus: RouteBonus
  openingCard: V1CardId
  resolution?: ChainResolution
  won: boolean
  emergencyRewind: boolean
}

export type CaseRank = 'S' | 'A' | 'B'

export interface MetaStateV1 {
  runs: number
  wins: number
  bestChain: number
  tutorialDone: boolean
  soundEnabled: boolean
  soundVolume: number
}

export type ScreenStateV1 =
  | { name: 'title' }
  | { name: 'map' }
  | { name: 'battle' }
  | { name: 'reward'; options: V1CardId[]; rank: CaseRank }
  | { name: 'ending' }

export interface GameStateV1 {
  screen: ScreenStateV1
  meta: MetaStateV1
  run: RunStateV1 | null
  battle: BattleStateV1 | null
  resumable: GameStateV1 | null
  seedInput: string
  notice?: string
}

export type GameActionV1 =
  | { type: 'set-seed'; seed: string }
  | { type: 'randomize-seed' }
  | { type: 'start-run' }
  | { type: 'resume-run' }
  | { type: 'return-title' }
  | { type: 'restart' }
  | { type: 'choose-past'; choiceId: string }
  | { type: 'choose-future'; choiceId: string }
  | { type: 'toggle-stage'; uid: string }
  | { type: 'apply-strategy'; uids: string[]; rewindTargetUid?: string }
  | { type: 'set-rewind-target'; uid: string }
  | { type: 'clear-stage' }
  | { type: 'resolve-chain' }
  | { type: 'continue-after-chain' }
  | { type: 'choose-reward'; cardId: V1CardId }
  | { type: 'skip-reward' }
  | { type: 'complete-tutorial' }
  | { type: 'toggle-sound' }
  | { type: 'set-sound-volume'; volume: number }
  | { type: 'clear-notice' }
