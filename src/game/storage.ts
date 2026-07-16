import type {
  BattleState,
  CardId,
  ChallengeId,
  ClueId,
  DeckCard,
  GameState,
  MapNode,
  MetaState,
  RelicId,
  RunState,
  ScreenState,
} from '../domain/types'
import { CARDS, START_DECK } from '../content/cards'
import { CLUES, EVENTS } from '../content/events'
import { CHALLENGES, ENCOUNTERS, INCIDENTS, MAP_TEMPLATES, RELICS } from '../content/gameContent'
import { buildRandomLayers, MIN_DECK_SIZE } from '../domain/run'
import { seedHash } from '../domain/random'
import { DEFAULT_SOUND_VOLUME, normalizeSoundVolume } from './audioSettings'

export const SAVE_KEY = 'reverseArchiveSaveV5'
export const VERSION4_SAVE_KEY = 'reverseArchiveSaveV4'
export const VERSION3_SAVE_KEY = 'reverseArchiveSaveV3'
export const LEGACY_SAVE_KEY = 'reverseArchiveSaveV2'
export const META_KEY = 'reverseArchiveMeta'

const DEFAULT_META: MetaState = {
  runs: 0,
  wins: 0,
  ink: 0,
  tutorialDone: false,
  soundEnabled: true,
  soundVolume: DEFAULT_SOUND_VOLUME,
  lastMode: 'standard',
}

function getStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
      ? window.localStorage
      : null
  } catch {
    return null
  }
}

function isChallenge(value: unknown): value is ChallengeId {
  return value === 'standard' || value === 'paradox' || value === 'zero'
}

function hasOwn(record: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(record, key)
}

function normalizeMeta(value: unknown, fallback: MetaState = DEFAULT_META): MetaState {
  const meta = asRecord(value)
  return {
    runs: Math.max(0, Math.floor(finiteNumber(meta.runs, fallback.runs))),
    wins: Math.max(0, Math.floor(finiteNumber(meta.wins, fallback.wins))),
    ink: Math.max(0, Math.floor(finiteNumber(meta.ink, fallback.ink))),
    tutorialDone: typeof meta.tutorialDone === 'boolean' ? meta.tutorialDone : fallback.tutorialDone,
    soundEnabled: typeof meta.soundEnabled === 'boolean' ? meta.soundEnabled : fallback.soundEnabled,
    soundVolume: normalizeSoundVolume(meta.soundVolume, fallback.soundVolume),
    lastMode: isChallenge(meta.lastMode) ? meta.lastMode : fallback.lastMode,
  }
}

export function loadMeta(): MetaState {
  const storage = getStorage()
  if (!storage) return { ...DEFAULT_META }
  try {
    return normalizeMeta(JSON.parse(storage.getItem(META_KEY) ?? '{}'))
  } catch {
    return { ...DEFAULT_META }
  }
}

export function saveMeta(meta: MetaState): void {
  const storage = getStorage()
  if (!storage) return
  try {
    storage.setItem(META_KEY, JSON.stringify(meta))
  } catch {
    // Storage can be unavailable in private browsing or when the quota is full.
  }
}

export function saveSession(state: GameState): void {
  const storage = getStorage()
  if (!storage || !state.run || state.screen.name === 'ending') return
  const payload = {
    format: 'reverse-archive-save',
    version: 5,
    savedAt: new Date().toISOString(),
    state: { ...state, resumable: null, notice: undefined },
  }
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(payload))
  } catch {
    // The in-memory run remains playable even when persistence is unavailable.
  }
}

export function clearSession(): void {
  const storage = getStorage()
  if (!storage) return
  try {
    storage.removeItem(SAVE_KEY)
    storage.removeItem(VERSION4_SAVE_KEY)
    storage.removeItem(VERSION3_SAVE_KEY)
    storage.removeItem(LEGACY_SAVE_KEY)
  } catch {
    // Ignore unavailable storage during cleanup.
  }
}

function readVersion5(raw: string, fallbackMeta: MetaState): GameState | null {
  const payload = JSON.parse(raw) as { format?: string; version?: number; state?: unknown }
  if (payload.format !== 'reverse-archive-save' || payload.version !== 5) return null
  return repairState(payload.state, '调查存档已恢复。', fallbackMeta)
}

function normalizeDeck(value: unknown): DeckCard[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (typeof entry === 'string') {
      return hasOwn(CARDS, entry) ? [{ cardId: entry as CardId, upgraded: false }] : []
    }
    const record = asRecord(entry)
    const cardId = String(record.cardId ?? record.id ?? '')
    if (!hasOwn(CARDS, cardId)) return []
    return {
      cardId: cardId as CardId,
      upgraded: Boolean(record.upgraded),
    }
  })
}

function normalizeBattle(value: unknown, run?: RunState): BattleState | null {
  const battle = asRecord(value)
  if (!Object.keys(battle).length) return null
  const encounterIdValue = String(battle.encounterId ?? battle.id ?? 'fire')
  const encounterId = hasOwn(ENCOUNTERS, encounterIdValue) ? encounterIdValue as BattleState['encounterId'] : 'fire'
  const normalizeInstances = (items: unknown, prefix: string) => Array.isArray(items)
    ? items.flatMap((value, index) => {
        const card = asRecord(value)
        const cardId = String(card.cardId ?? card.id ?? '')
        return hasOwn(CARDS, cardId) ? [{
          cardId: cardId as CardId,
          upgraded: Boolean(card.upgraded),
          uid: String(card.uid ?? `${prefix}-${index}`),
        }] : []
      })
    : []
  const hand = normalizeInstances(battle.hand, 'recovered-hand')
  let placed = Array.isArray(battle.placed)
    ? battle.placed.flatMap((value, index) => {
        const card = asRecord(value)
        const cardId = String(card.cardId ?? card.id ?? '')
        if (!hasOwn(CARDS, cardId)) return []
        const eraValue = Number(card.era)
        return [{
          cardId: cardId as CardId,
          upgraded: Boolean(card.upgraded),
          uid: String(card.uid ?? `recovered-placed-${index}`),
          era: (eraValue === 1 || eraValue === 2 ? eraValue : 0) as 0 | 1 | 2,
          paid: Math.max(0, finiteNumber(card.paid, 0)),
          discount: card.discount === 'watch' ? 'watch' as const : card.discount === 'needle' ? 'needle' as const : undefined,
        }]
      })
    : []
  const round = Math.max(0, Math.floor(finiteNumber(battle.round, 0)))
  const legacyWatchState = typeof battle.watchAvailable !== 'boolean'
  if (legacyWatchState && run?.relics.includes('watch') && round === 0 && placed[0]?.paid === 0 && !placed[0].discount) {
    placed = [{ ...placed[0], discount: 'watch' }, ...placed.slice(1)]
  }
  const rawIncidents = Array.isArray(battle.incidentOrder) ? battle.incidentOrder : battle.incidents
  const incidentOrder = Array.isArray(rawIncidents)
    ? rawIncidents.filter((id): id is BattleState['incidentOrder'][number] => typeof id === 'string' && hasOwn(INCIDENTS, id))
    : []
  return {
    encounterId,
    encounterTarget: Math.max(1, finiteNumber(battle.encounterTarget, ENCOUNTERS[encounterId].target)),
    incidentOrder: incidentOrder.length ? incidentOrder : [...ENCOUNTERS[encounterId].incidents],
    round,
    truth: Math.max(0, finiteNumber(battle.truth, 0)),
    credibility: Math.max(0, finiteNumber(battle.credibility ?? battle.cred, 0)),
    witnessAlive: battle.witnessAlive === undefined ? Boolean(battle.witness ?? true) : Boolean(battle.witnessAlive),
    draw: normalizeDeck(battle.draw),
    discard: normalizeDeck(battle.discard),
    hand,
    energy: Math.min(3, Math.max(0, finiteNumber(battle.energy, 3))),
    placed,
    watchAvailable: typeof battle.watchAvailable === 'boolean'
      ? battle.watchAvailable
      : round === 0 && placed.length === 0,
    selectedUid: typeof battle.selectedUid === 'string' && hand.some((card) => card.uid === battle.selectedUid) ? battle.selectedUid : undefined,
    nextCardUid: Math.max(hand.length + placed.length, Math.floor(finiteNumber(battle.nextCardUid, hand.length + placed.length))),
    log: Array.isArray(battle.log) ? battle.log.filter((line): line is string => typeof line === 'string') : [],
  }
}

function normalizeScreen(value: unknown): ScreenState {
  const screen = asRecord(value)
  const name = String(screen.name ?? screen.screen ?? 'map')
  if (name === 'title' || name === 'map' || name === 'battle') return { name }
  if (name === 'event') {
    const eventId = String(screen.eventId ?? screen.id ?? 'telegram')
    return { name: 'event', eventId: hasOwn(EVENTS, eventId) ? eventId as Extract<ScreenState, { name: 'event' }>['eventId'] : 'telegram' }
  }
  if (name === 'rest') return { name: 'rest', removing: Boolean(screen.removing), upgrading: Boolean(screen.upgrading) }
  if (name === 'shop') {
    const rawShop = asRecord(screen.shop)
    const cards = Array.isArray(rawShop.cards)
      ? rawShop.cards.filter((id): id is CardId => typeof id === 'string' && hasOwn(CARDS, id)).slice(0, 3)
      : []
    const relicValue = String(rawShop.relic ?? 'crane')
    return {
      name: 'shop',
      shop: { cards, relic: hasOwn(RELICS, relicValue) ? relicValue as RelicId : 'crane', bought: Array.isArray(rawShop.bought) ? rawShop.bought.map(String) : [], removing: Boolean(rawShop.removing), upgrading: Boolean(rawShop.upgrading) },
    }
  }
  if (name === 'reward') {
    return { name: 'reward', options: Array.isArray(screen.options) ? screen.options.filter((id): id is CardId => typeof id === 'string' && hasOwn(CARDS, id)) : [], gain: Math.max(0, finiteNumber(screen.gain, 0)), relicGained: typeof screen.relicGained === 'string' && hasOwn(RELICS, screen.relicGained) ? screen.relicGained as RelicId : undefined }
  }
  if (name === 'chapter') return { name: 'chapter', act: Number(screen.act) === 1 ? 1 : 0 }
  return { name: 'map' }
}

function finiteNumber(value: unknown, fallback: number): number {
  if (value === null || value === undefined || value === '') return fallback
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function normalizeLayers(value: unknown, fallback: MapNode[][]): MapNode[][] {
  if (!Array.isArray(value) || value.length !== 18) return fallback
  const layers: MapNode[][] = []
  for (const rawLayer of value) {
    if (!Array.isArray(rawLayer) || !rawLayer.length) return fallback
    const layer: MapNode[] = []
    for (const value of rawLayer) {
      const node = asRecord(value)
      const id = typeof node.id === 'string' ? node.id : ''
      if (!hasOwn(MAP_TEMPLATES, id)) return fallback
      const template = MAP_TEMPLATES[id]
      const legacyDescription = typeof node.description === 'string'
        ? node.description
        : typeof node.desc === 'string'
          ? node.desc
          : template.description
      layer.push({ ...template, description: legacyDescription })
    }
    layers.push(layer)
  }
  return layers
}

function normalizeRun(value: unknown): RunState | null {
  const run = asRecord(value)
  if (!Object.keys(run).length) return null
  const seed = String(run.seed ?? 'recovered')
  const mode = isChallenge(run.mode) ? run.mode : 'standard'
  const challenge = CHALLENGES[mode]
  const generated = buildRandomLayers(seedHash(seed))
  const layers = normalizeLayers(run.layers, generated.layers)
  const deck = normalizeDeck(run.deck)
  for (const cardId of START_DECK) {
    if (deck.length >= MIN_DECK_SIZE) break
    deck.push({ cardId, upgraded: false })
  }
  const relics = Array.isArray(run.relics)
    ? [...new Set(run.relics.filter((id): id is RelicId => typeof id === 'string' && hasOwn(RELICS, id)))]
    : []
  const floor = Math.max(0, Math.min(17, Math.floor(finiteNumber(run.floor, 0))))
  const maxTimeline = Math.min(challenge.timeline, Math.max(1, finiteNumber(run.maxTimeline ?? run.maxHp, challenge.timeline)))
  const currentNodeValue = typeof run.currentNode === 'string' && hasOwn(MAP_TEMPLATES, run.currentNode) ? run.currentNode : undefined
  const cleared = Array.isArray(run.cleared)
    ? run.cleared.flatMap((value) => {
        const entry = asRecord(value)
        const id = typeof entry.id === 'string' ? entry.id : ''
        if (!hasOwn(MAP_TEMPLATES, id)) return []
        return [{ floor: Math.max(0, Math.min(17, Math.floor(finiteNumber(entry.floor, 0)))), id }]
      })
    : []
  return {
    timeline: Math.min(maxTimeline, Math.max(1, finiteNumber(run.timeline ?? run.hp, maxTimeline))),
    maxTimeline,
    paradox: Math.min(challenge.paradoxLimit - 1, Math.max(0, finiteNumber(run.paradox, 0))),
    paradoxLimit: challenge.paradoxLimit,
    echoes: Math.max(0, finiteNumber(run.echoes, 0)),
    deck,
    relics,
    floor,
    cleared,
    story: Array.isArray(run.story) ? run.story.filter((line): line is string => typeof line === 'string') : [],
    clues: Array.isArray(run.clues) ? [...new Set(run.clues.filter((id): id is ClueId => typeof id === 'string' && hasOwn(CLUES, id)))] : [],
    currentNode: currentNodeValue,
    currentTitle: String(run.currentTitle ?? '追查灾难的起点'),
    mode,
    seed,
    rngState: finiteNumber(run.rngState, generated.rngState),
    layers,
  }
}

function isPlayableBattle(battle: BattleState, run: RunState): boolean {
  const activeNode = run.layers[run.floor]?.find((node) => node.id === run.currentNode)
  if (!activeNode || (activeNode.type !== 'battle' && activeNode.type !== 'elite' && activeNode.type !== 'boss')) return false
  if (activeNode.id !== battle.encounterId || !battle.hand.length) return false
  if (battle.hand.length + battle.draw.length + battle.discard.length < MIN_DECK_SIZE) return false
  const handUids = new Set(battle.hand.map((card) => card.uid))
  if (handUids.size !== battle.hand.length) return false
  const placedUids = new Set<string>()
  return battle.placed.every((card) => {
    if (placedUids.has(card.uid)) return false
    placedUids.add(card.uid)
    return battle.hand.some((handCard) => handCard.uid === card.uid && handCard.cardId === card.cardId && handCard.upgraded === card.upgraded)
  })
}

function repairState(value: unknown, notice: string, fallbackMeta: MetaState = DEFAULT_META): GameState | null {
  const state = asRecord(value)
  const run = normalizeRun(state.run)
  if (!run) return null
  let battle = normalizeBattle(state.battle, run)
  let screen = normalizeScreen(state.screen)
  if (screen.name === 'title') screen = { name: 'map' }
  if (screen.name === 'battle') {
    if (!battle || !isPlayableBattle(battle, run)) {
      screen = { name: 'map' }
      battle = null
    }
  } else {
    battle = null
  }
  if (screen.name === 'reward' && !screen.options.length) screen = { name: 'map' }
  const meta = normalizeMeta(state.meta, { ...fallbackMeta, lastMode: run.mode })
  return { screen, meta, selectedMode: isChallenge(state.selectedMode) ? state.selectedMode : run.mode, seedInput: String(state.seedInput ?? run.seed), run, battle, resumable: null, notice }
}

function migrateVersion4(raw: string, fallbackMeta: MetaState): GameState | null {
  const payload = JSON.parse(raw) as { format?: string; version?: number; state?: GameState }
  if (payload.format !== 'reverse-archive-save' || payload.version !== 4 || !payload.state?.run) return null
  const oldState = payload.state
  const oldRun = oldState.run as RunState
  return repairState({
    ...oldState,
    screen: normalizeScreen(oldState.screen),
    run: { ...oldRun, deck: normalizeDeck(oldRun.deck) },
    battle: oldState.battle,
    resumable: null,
  }, 'V4 存档已升级，卡牌升级系统现已启用。', fallbackMeta)
}

function migrateVersion3(raw: string, fallbackMeta: MetaState): GameState | null {
  const payload = JSON.parse(raw) as { format?: string; version?: number; state?: GameState }
  if (payload.format !== 'reverse-archive-save' || payload.version !== 3 || !payload.state?.run) return null

  const oldState = payload.state as GameState
  const oldRun = oldState.run as RunState
  const generated = buildRandomLayers(seedHash(oldRun.seed))
  const legacyCampaign = oldRun.layers.length < 18
  const layers = legacyCampaign
    ? generated.layers.map((layer, index) => index < 5 && oldRun.layers[index]?.length ? oldRun.layers[index] : layer)
    : oldRun.layers
  const onFormerFinalBoss = legacyCampaign && oldRun.floor === 5 && oldRun.currentNode === 'boss'
  const run: RunState = {
    ...oldRun,
    deck: normalizeDeck(oldRun.deck),
    layers,
    currentNode: onFormerFinalBoss ? 'curator' : oldRun.currentNode,
    currentTitle: onFormerFinalBoss ? '封馆人' : oldRun.currentTitle,
  }
  const legacyMode = isChallenge(oldRun.mode) ? oldRun.mode : 'standard'
  const legacyBattle = onFormerFinalBoss && oldState.battle?.encounterId === 'boss'
    ? { ...oldState.battle, encounterId: 'curator' as const, encounterTarget: Math.ceil(ENCOUNTERS.curator.target * CHALLENGES[legacyMode].targetMultiplier) }
    : oldState.battle
  return repairState({
    ...oldState,
    screen: normalizeScreen(oldState.screen),
    run,
    battle: legacyBattle,
    resumable: null,
  }, legacyCampaign ? 'V3 存档已扩展为三幕战役。' : 'V3 存档已升级。', fallbackMeta)
}

type LegacyRecord = Record<string, unknown>

function asRecord(value: unknown): LegacyRecord {
  return value && typeof value === 'object' ? (value as LegacyRecord) : {}
}

function migrateLegacy(raw: string, fallbackMeta: MetaState): GameState | null {
  const payload = asRecord(JSON.parse(raw))
  if (payload.format !== 'reverse-archive-save') return null
  const oldRun = asRecord(payload.run)
  if (!Object.keys(oldRun).length) return null
  const oldState = asRecord(payload.state)
  const seed = String(oldRun.seed ?? 'legacy')
  const mode = isChallenge(oldRun.mode) ? oldRun.mode : 'standard'
  const generated = buildRandomLayers(seedHash(seed))
  const parsedLegacyLayers = Array.isArray(oldRun.layers)
    ? oldRun.layers.map((layer) =>
        Array.isArray(layer)
          ? layer.map((value) => {
              const node = asRecord(value)
              return {
                type: String(node.type ?? 'event'),
                id: String(node.id ?? 'unknown'),
                icon: String(node.icon ?? '档'),
                title: String(node.title ?? '未知档案'),
                sub: String(node.sub ?? '异常记录'),
                description: String(node.description ?? node.desc ?? ''),
              } as MapNode
            })
          : [],
      )
    : []
  const legacyLayers = generated.layers.map((layer, index) =>
    index < 5 && parsedLegacyLayers[index]?.length ? parsedLegacyLayers[index] : layer,
  )
  const legacyFloor = Number(oldRun.floor ?? 0)
  const onFormerFinalBoss = legacyFloor === 5 && oldRun.currentNode === 'boss'
  const run: RunState = {
    timeline: Number(oldRun.hp ?? 30),
    maxTimeline: Number(oldRun.maxHp ?? 30),
    paradox: Number(oldRun.paradox ?? 0),
    paradoxLimit: Number(oldRun.paradoxLimit ?? 8),
    echoes: Number(oldRun.echoes ?? 0),
    deck: normalizeDeck(oldRun.deck),
    relics: (Array.isArray(oldRun.relics) ? oldRun.relics : []) as RelicId[],
    floor: legacyFloor,
    cleared: (Array.isArray(oldRun.cleared) ? oldRun.cleared : []) as RunState['cleared'],
    story: (Array.isArray(oldRun.story) ? oldRun.story : []) as string[],
    clues: [],
    currentNode: onFormerFinalBoss ? 'curator' : typeof oldRun.currentNode === 'string' ? oldRun.currentNode : undefined,
    currentTitle: onFormerFinalBoss ? '封馆人' : String(oldRun.currentTitle ?? '追查灾难的起点'),
    mode,
    seed,
    rngState: Number(oldRun.rngState ?? generated.rngState),
    layers: legacyLayers,
  }

  const oldBattle = asRecord(payload.battle)
  const oldHand = Array.isArray(oldBattle.hand) ? oldBattle.hand.map(asRecord) : []
  const oldPlaced = Array.isArray(oldBattle.placed) ? oldBattle.placed.map(asRecord) : []
  const battle: BattleState | null = Object.keys(oldBattle).length
    ? {
        encounterId: (onFormerFinalBoss ? 'curator' : String(oldBattle.id ?? 'fire')) as BattleState['encounterId'],
        encounterTarget: onFormerFinalBoss ? Math.ceil(ENCOUNTERS.curator.target * CHALLENGES[mode].targetMultiplier) : Number(asRecord(oldBattle.enc).target ?? 7),
        incidentOrder: (Array.isArray(oldBattle.incidents) ? oldBattle.incidents : []) as BattleState['incidentOrder'],
        round: Number(oldBattle.round ?? 0),
        truth: Number(oldBattle.truth ?? 0),
        credibility: Number(oldBattle.cred ?? 0),
        witnessAlive: Boolean(oldBattle.witness ?? true),
        draw: normalizeDeck(oldBattle.draw),
        discard: normalizeDeck(oldBattle.discard),
        hand: oldHand.map((card, index) => ({
          cardId: String(card.id ?? 'seal') as CardId,
          upgraded: false,
          uid: String(card.uid ?? `legacy-${index}`),
        })),
        energy: Number(oldBattle.energy ?? 3),
        placed: oldPlaced.map((card, index) => ({
          cardId: String(card.id ?? 'seal') as CardId,
          upgraded: false,
          uid: String(card.uid ?? `legacy-placed-${index}`),
          era: Number(card.era ?? 0) as 0 | 1 | 2,
          paid: Number(card.paid ?? 0),
          discount: index === 0 && Number(oldBattle.round ?? 0) === 0 && run.relics.includes('watch') && Number(card.paid ?? 0) === 0
            ? 'watch' as const
            : undefined,
        })),
        watchAvailable: Number(oldBattle.round ?? 0) === 0 && oldPlaced.length === 0,
        selectedUid: typeof asRecord(oldBattle.selected).uid === 'string' ? String(asRecord(oldBattle.selected).uid) : undefined,
        nextCardUid: oldHand.length + oldPlaced.length + 1,
        log: (Array.isArray(oldBattle.log) ? oldBattle.log : []) as string[],
      }
    : null

  const oldScreen = String(oldState.screen ?? 'map')
  let screen: ScreenState = { name: 'map' }
  if (oldScreen === 'battle' && battle) screen = { name: 'battle' }
  if (oldScreen === 'event') screen = { name: 'event', eventId: oldState.id === 'photo' ? 'photo' : 'telegram' }
  if (oldScreen === 'rest') screen = { name: 'rest', removing: Boolean(oldState.removing), upgrading: false }
  if (oldScreen === 'reward') {
    screen = {
      name: 'reward',
      options: (Array.isArray(payload.rewardOptions) ? payload.rewardOptions : []) as CardId[],
      gain: Number(oldState.gain ?? 12),
      relicGained: typeof oldState.relicGained === 'string' ? (oldState.relicGained as RelicId) : undefined,
    }
  }
  if (oldScreen === 'shop') {
    const oldShop = asRecord(oldState.shop)
    screen = {
      name: 'shop',
      shop: {
        cards: (Array.isArray(oldShop.cards) ? oldShop.cards : []) as CardId[],
        relic: String(oldShop.relic ?? 'crane') as RelicId,
        bought: (Array.isArray(oldShop.bought) ? oldShop.bought : []).map((key) =>
          String(key).replace(/^c(\d+)$/, 'card-$1'),
        ),
        removing: Boolean(oldShop.removing),
        upgrading: false,
      },
    }
  }

  const legacyMeta = { ...fallbackMeta, ...asRecord(payload.meta), lastMode: mode } as MetaState
  return repairState({
    screen,
    meta: legacyMeta,
    selectedMode: mode,
    seedInput: seed,
    run,
    battle,
    resumable: null,
  }, '旧版 V2 存档已迁移。', fallbackMeta)
}

export function loadSession(meta = loadMeta()): GameState | null {
  const storage = getStorage()
  if (!storage) return null
  const candidates: Array<[string, (raw: string) => GameState | null]> = [
    [SAVE_KEY, (raw) => readVersion5(raw, meta)],
    [VERSION4_SAVE_KEY, (raw) => migrateVersion4(raw, meta)],
    [VERSION3_SAVE_KEY, (raw) => migrateVersion3(raw, meta)],
    [LEGACY_SAVE_KEY, (raw) => migrateLegacy(raw, meta)],
  ]
  for (const [key, reader] of candidates) {
    try {
      const raw = storage.getItem(key)
      if (!raw) continue
      const loaded = reader(raw)
      if (loaded) return loaded
    } catch {
      // Try the next older save when a newer payload is corrupted.
    }
  }
  return null
}
