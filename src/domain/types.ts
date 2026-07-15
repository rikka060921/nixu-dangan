export const ERAS = ['过去', '现在', '未来'] as const

export type Era = 0 | 1 | 2
export type CardKind = '因' | '证' | '改' | '锚' | '悖'
export type CardRarity = '普通' | '非凡' | '稀有'
export type CardTag = '真相' | '防护' | '可信度' | '改写' | '锚定' | '悖论' | '节奏' | '多样性' | '稳定'
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

export type RelicId =
  | 'watch'
  | 'crane'
  | 'redthread'
  | 'ash'
  | 'mirror'
  | 'ticket'
  | 'needle'
  | 'carbon'
  | 'bellshard'
  | 'lens'
  | 'key'
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
export type EncounterId =
  | 'fire'
  | 'mirror'
  | 'bell'
  | 'twins'
  | 'faceless'
  | 'curator'
  | 'station'
  | 'hospital'
  | 'press'
  | 'chorus-elite'
  | 'undertaker'
  | 'clockmaker'
  | 'vault'
  | 'tomorrow'
  | 'city'
  | 'double'
  | 'null'
  | 'boss'
export type ChallengeId = 'standard' | 'paradox' | 'zero'
export type NodeType = 'battle' | 'elite' | 'boss' | 'event' | 'rest' | 'shop'
export type EventId = 'telegram' | 'photo' | 'platform' | 'obituary' | 'unborn-letter' | 'zero-key'
export type ClueId = 'archive-origin' | 'zero-self' | 'future-city' | 'key-shape'

export interface CardDefinition {
  id: CardId
  name: string
  kind: CardKind
  rarity: CardRarity
  tags: CardTag[]
  cost: number
  text: string
  upgradeText: string
  flavor: string
}

export interface DeckCard {
  cardId: CardId
  upgraded: boolean
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
  rank: 'normal' | 'elite' | 'boss'
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

export interface EventEffect {
  timeline?: number
  maxTimeline?: number
  paradox?: number
  echoes?: number
  addCards?: CardId[]
  addRelic?: RelicId
  addClues?: ClueId[]
}

export interface EventChoiceDefinition {
  id: string
  icon: string
  title: string
  description: string
  result: string
  story: string
  effect: EventEffect
}

export interface EventDefinition {
  id: EventId
  title: string
  narrative: string
  choices: EventChoiceDefinition[]
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
  deck: DeckCard[]
  relics: RelicId[]
  floor: number
  cleared: ClearedNode[]
  story: string[]
  clues: ClueId[]
  currentNode?: string
  currentTitle: string
  mode: ChallengeId
  seed: string
  rngState: number
  layers: MapNode[][]
}

export interface CardInstance extends DeckCard {
  uid: string
}

export interface PlacedCard extends CardInstance {
  era: Era
  paid: number
  discount?: 'watch' | 'needle'
}

export interface BattleState {
  encounterId: EncounterId
  encounterTarget: number
  incidentOrder: IncidentId[]
  round: number
  truth: number
  credibility: number
  witnessAlive: boolean
  draw: DeckCard[]
  discard: DeckCard[]
  hand: CardInstance[]
  energy: number
  placed: PlacedCard[]
  watchAvailable: boolean
  selectedUid?: string
  nextCardUid: number
  log: string[]
}

export interface ShopState {
  cards: CardId[]
  relic: RelicId
  bought: string[]
  removing: boolean
  upgrading: boolean
}

export interface MetaState {
  runs: number
  wins: number
  ink: number
  tutorialDone: boolean
  soundEnabled: boolean
  lastMode: ChallengeId
}

export type ScreenState =
  | { name: 'title' }
  | { name: 'map' }
  | { name: 'battle' }
  | { name: 'event'; eventId: EventId }
  | { name: 'rest'; removing: boolean; upgrading: boolean }
  | { name: 'shop'; shop: ShopState }
  | { name: 'reward'; options: CardId[]; gain: number; relicGained?: RelicId }
  | { name: 'chapter'; act: 0 | 1 }
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
