export const ERAS = ['过去', '现在', '未来'] as const

export type Era = 0 | 1 | 2
export type CardKind = '因' | '证' | '改' | '锚' | '悖'
export type CardId =
  | 'seal'
  | 'rescue'
  | 'ledger'
  | 'clarify'
  | 'memory'
  | 'anchor'
  | 'alibi'
  | 'blackout'
  | 'annotation'
  | 'echo'
  | 'testimony'
  | 'vow'
  | 'thread'
  | 'delay'
  | 'doorplate'
  | 'chorus'
  | 'rewind'
  | 'sealorder'
  | 'erase'
  | 'secondhand'

export type RelicId = 'watch' | 'crane' | 'redthread' | 'ash' | 'mirror'
export type IncidentId =
  | 'fire'
  | 'interrogation'
  | 'rumor'
  | 'mirror'
  | 'theft'
  | 'purge'
  | 'rewrite'
  | 'collapse'
  | 'toll'
  | 'silence'
  | 'inversion'
export type EncounterId = 'fire' | 'mirror' | 'bell' | 'twins' | 'faceless' | 'boss'
export type ChallengeId = 'standard' | 'paradox' | 'zero'
export type NodeType = 'battle' | 'elite' | 'boss' | 'event' | 'rest' | 'shop'

export interface CardDefinition {
  id: CardId
  name: string
  kind: CardKind
  cost: number
  text: string
  flavor: string
}

export interface RelicDefinition {
  id: RelicId
  name: string
  text: string
}

export interface IncidentDefinition {
  id: IncidentId
  name: string
  era: Era
  glyph: string
  intent: string
}

export interface EncounterDefinition {
  id: EncounterId
  name: string
  type: string
  target: number
  incidents: IncidentId[]
  story: string
}

export interface ChallengeDefinition {
  id: ChallengeId
  name: string
  timeline: number
  paradoxLimit: number
  targetMultiplier: number
  inkMultiplier: number
  text: string
}

export interface MapNode {
  type: NodeType
  id: string
  icon: string
  title: string
  sub: string
  description: string
}

export interface ClearedNode {
  floor: number
  id: string
}

export interface RunState {
  timeline: number
  maxTimeline: number
  paradox: number
  paradoxLimit: number
  echoes: number
  deck: CardId[]
  relics: RelicId[]
  floor: number
  cleared: ClearedNode[]
  story: string[]
  currentNode?: string
  currentTitle: string
  mode: ChallengeId
  seed: string
  rngState: number
  layers: MapNode[][]
}

export interface CardInstance {
  cardId: CardId
  uid: string
}

export interface PlacedCard extends CardInstance {
  era: Era
  paid: number
}

export interface BattleState {
  encounterId: EncounterId
  encounterTarget: number
  incidentOrder: IncidentId[]
  round: number
  truth: number
  credibility: number
  witnessAlive: boolean
  draw: CardId[]
  discard: CardId[]
  hand: CardInstance[]
  energy: number
  placed: PlacedCard[]
  selectedUid?: string
  nextCardUid: number
  log: string[]
}

export interface ShopState {
  cards: CardId[]
  relic: RelicId
  bought: string[]
  removing: boolean
}

export interface MetaState {
  runs: number
  wins: number
  ink: number
  tutorialDone: boolean
  lastMode: ChallengeId
}

export type ScreenState =
  | { name: 'title' }
  | { name: 'map' }
  | { name: 'battle' }
  | { name: 'event'; eventId: 'telegram' | 'photo' }
  | { name: 'rest'; removing: boolean }
  | { name: 'shop'; shop: ShopState }
  | { name: 'reward'; options: CardId[]; gain: number; relicGained?: RelicId }
  | { name: 'ending'; won: boolean; reason: string; inkGain: number }

export interface GameState {
  screen: ScreenState
  meta: MetaState
  selectedMode: ChallengeId
  seedInput: string
  run: RunState | null
  battle: BattleState | null
  resumable: GameState | null
  notice?: string
}

