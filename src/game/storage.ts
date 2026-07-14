import type {
  BattleState,
  CardId,
  ChallengeId,
  GameState,
  MapNode,
  MetaState,
  RelicId,
  RunState,
  ScreenState,
} from '../domain/types'
import { buildRandomLayers } from '../domain/run'
import { seedHash } from '../domain/random'

export const SAVE_KEY = 'reverseArchiveSaveV4'
export const VERSION3_SAVE_KEY = 'reverseArchiveSaveV3'
export const LEGACY_SAVE_KEY = 'reverseArchiveSaveV2'
export const META_KEY = 'reverseArchiveMeta'

const DEFAULT_META: MetaState = {
  runs: 0,
  wins: 0,
  ink: 0,
  tutorialDone: false,
  lastMode: 'standard',
}

function hasStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function isChallenge(value: unknown): value is ChallengeId {
  return value === 'standard' || value === 'paradox' || value === 'zero'
}

export function loadMeta(): MetaState {
  if (!hasStorage()) return { ...DEFAULT_META }
  try {
    const parsed = JSON.parse(localStorage.getItem(META_KEY) ?? '{}') as Partial<MetaState>
    return {
      ...DEFAULT_META,
      ...parsed,
      lastMode: isChallenge(parsed.lastMode) ? parsed.lastMode : DEFAULT_META.lastMode,
    }
  } catch {
    return { ...DEFAULT_META }
  }
}

export function saveMeta(meta: MetaState): void {
  if (!hasStorage()) return
  localStorage.setItem(META_KEY, JSON.stringify(meta))
}

export function saveSession(state: GameState): void {
  if (!hasStorage() || !state.run || state.screen.name === 'ending') return
  const payload = {
    format: 'reverse-archive-save',
    version: 4,
    savedAt: new Date().toISOString(),
    state: { ...state, resumable: null, notice: undefined },
  }
  localStorage.setItem(SAVE_KEY, JSON.stringify(payload))
}

export function clearSession(): void {
  if (!hasStorage()) return
  localStorage.removeItem(SAVE_KEY)
  localStorage.removeItem(VERSION3_SAVE_KEY)
  localStorage.removeItem(LEGACY_SAVE_KEY)
}

function readVersion4(raw: string): GameState | null {
  const payload = JSON.parse(raw) as { format?: string; version?: number; state?: GameState }
  if (payload.format !== 'reverse-archive-save' || payload.version !== 4 || !payload.state?.run) return null
  return { ...payload.state, resumable: null, notice: '调查存档已恢复。' }
}

function migrateVersion3(raw: string): GameState | null {
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
    layers,
    currentNode: onFormerFinalBoss ? 'curator' : oldRun.currentNode,
    currentTitle: onFormerFinalBoss ? '封馆人' : oldRun.currentTitle,
  }
  const battle = onFormerFinalBoss && oldState.battle?.encounterId === 'boss'
    ? { ...oldState.battle, encounterId: 'curator' as const, encounterTarget: 18 }
    : oldState.battle

  return {
    ...oldState,
    run,
    battle,
    resumable: null,
    notice: legacyCampaign ? 'V3 存档已扩展为三幕战役。' : 'V3 存档已升级。',
  }
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
  const legacyLayers = Array.isArray(oldRun.layers)
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
    : generated.layers
  const run: RunState = {
    timeline: Number(oldRun.hp ?? 30),
    maxTimeline: Number(oldRun.maxHp ?? 30),
    paradox: Number(oldRun.paradox ?? 0),
    paradoxLimit: Number(oldRun.paradoxLimit ?? 8),
    echoes: Number(oldRun.echoes ?? 0),
    deck: (Array.isArray(oldRun.deck) ? oldRun.deck : []) as CardId[],
    relics: (Array.isArray(oldRun.relics) ? oldRun.relics : []) as RelicId[],
    floor: Number(oldRun.floor ?? 0),
    cleared: (Array.isArray(oldRun.cleared) ? oldRun.cleared : []) as RunState['cleared'],
    story: (Array.isArray(oldRun.story) ? oldRun.story : []) as string[],
    currentNode: typeof oldRun.currentNode === 'string' ? oldRun.currentNode : undefined,
    currentTitle: String(oldRun.currentTitle ?? '追查灾难的起点'),
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
        encounterId: String(oldBattle.id ?? 'fire') as BattleState['encounterId'],
        encounterTarget: Number(asRecord(oldBattle.enc).target ?? 7),
        incidentOrder: (Array.isArray(oldBattle.incidents) ? oldBattle.incidents : []) as BattleState['incidentOrder'],
        round: Number(oldBattle.round ?? 0),
        truth: Number(oldBattle.truth ?? 0),
        credibility: Number(oldBattle.cred ?? 0),
        witnessAlive: Boolean(oldBattle.witness ?? true),
        draw: (Array.isArray(oldBattle.draw) ? oldBattle.draw : []) as CardId[],
        discard: (Array.isArray(oldBattle.discard) ? oldBattle.discard : []) as CardId[],
        hand: oldHand.map((card, index) => ({
          cardId: String(card.id ?? 'seal') as CardId,
          uid: String(card.uid ?? `legacy-${index}`),
        })),
        energy: Number(oldBattle.energy ?? 3),
        placed: oldPlaced.map((card, index) => ({
          cardId: String(card.id ?? 'seal') as CardId,
          uid: String(card.uid ?? `legacy-placed-${index}`),
          era: Number(card.era ?? 0) as 0 | 1 | 2,
          paid: Number(card.paid ?? 0),
        })),
        selectedUid: typeof asRecord(oldBattle.selected).uid === 'string' ? String(asRecord(oldBattle.selected).uid) : undefined,
        nextCardUid: oldHand.length + oldPlaced.length + 1,
        log: (Array.isArray(oldBattle.log) ? oldBattle.log : []) as string[],
      }
    : null

  const oldScreen = String(oldState.screen ?? 'map')
  let screen: ScreenState = { name: 'map' }
  if (oldScreen === 'battle' && battle) screen = { name: 'battle' }
  if (oldScreen === 'event') screen = { name: 'event', eventId: oldState.id === 'photo' ? 'photo' : 'telegram' }
  if (oldScreen === 'rest') screen = { name: 'rest', removing: Boolean(oldState.removing) }
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
      },
    }
  }

  const legacyMeta = { ...fallbackMeta, ...asRecord(payload.meta), lastMode: mode } as MetaState
  return {
    screen,
    meta: legacyMeta,
    selectedMode: mode,
    seedInput: seed,
    run,
    battle,
    resumable: null,
    notice: '旧版 V2 存档已迁移。',
  }
}

export function loadSession(meta = loadMeta()): GameState | null {
  if (!hasStorage()) return null
  try {
    const current = localStorage.getItem(SAVE_KEY)
    if (current) return readVersion4(current)
    const version3 = localStorage.getItem(VERSION3_SAVE_KEY)
    if (version3) return migrateVersion3(version3)
    const legacy = localStorage.getItem(LEGACY_SAVE_KEY)
    if (legacy) return migrateLegacy(legacy, meta)
    return null
  } catch {
    return null
  }
}
