import { DEFAULT_SOUND_VOLUME, normalizeSoundVolume } from '../game/audioSettings'
import { V1_CARDS } from './content'
import type { GameStateV1, MetaStateV1, ScreenStateV1, V1CardId } from './types'

export const V1_META_KEY = 'reverseArchiveV1Meta'
export const V1_SAVE_KEY = 'reverseArchiveV1Save'

export const DEFAULT_META_V1: MetaStateV1 = {
  runs: 0,
  wins: 0,
  bestChain: 0,
  tutorialDone: false,
  soundEnabled: true,
  soundVolume: DEFAULT_SOUND_VOLUME,
}

function getStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null
  } catch {
    return null
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0
}

export function normalizeMetaV1(value: unknown): MetaStateV1 {
  const source = record(value) ?? {}
  return {
    runs: count(source.runs),
    wins: count(source.wins),
    bestChain: count(source.bestChain),
    tutorialDone: source.tutorialDone === true,
    soundEnabled: source.soundEnabled !== false,
    soundVolume: normalizeSoundVolume(source.soundVolume),
  }
}

export function loadMetaV1(): MetaStateV1 {
  const storage = getStorage()
  if (!storage) return { ...DEFAULT_META_V1 }
  try {
    return normalizeMetaV1(JSON.parse(storage.getItem(V1_META_KEY) ?? '{}'))
  } catch {
    return { ...DEFAULT_META_V1 }
  }
}

export function saveMetaV1(meta: MetaStateV1): void {
  try {
    getStorage()?.setItem(V1_META_KEY, JSON.stringify(normalizeMetaV1(meta)))
  } catch {
    // Saving is optional when storage is unavailable.
  }
}

function validScreen(value: unknown): value is ScreenStateV1 {
  const source = record(value)
  return Boolean(source && ['map', 'battle', 'reward'].includes(String(source.name)))
}

function validCardId(value: unknown): value is V1CardId {
  return typeof value === 'string' && value in V1_CARDS
}

function validSession(value: unknown): value is GameStateV1 {
  const source = record(value)
  const run = record(source?.run)
  const screen = source?.screen
  if (!source || !run || !validScreen(screen)) return false
  if (typeof run.seed !== 'string' || !Array.isArray(run.deck) || !run.deck.every(validCardId)) return false
  if (!Number.isInteger(run.chapterIndex) || Number(run.chapterIndex) < 0 || Number(run.chapterIndex) > 3) return false
  if (record(screen)?.name === 'battle' && !record(source.battle)) return false
  return true
}

export function loadSessionV1(meta: MetaStateV1): GameStateV1 | null {
  const storage = getStorage()
  if (!storage) return null
  try {
    const payload = record(JSON.parse(storage.getItem(V1_SAVE_KEY) ?? 'null'))
    if (!payload || payload.format !== 'reverse-archive-v1-save' || payload.version !== 1 || !validSession(payload.state)) return null
    return { ...payload.state, meta, resumable: null, notice: undefined }
  } catch {
    return null
  }
}

export function saveSessionV1(state: GameStateV1): void {
  if (!state.run || state.screen.name === 'title' || state.screen.name === 'ending') return
  try {
    const stored = {
      ...state,
      meta: DEFAULT_META_V1,
      resumable: null,
      notice: undefined,
    }
    getStorage()?.setItem(V1_SAVE_KEY, JSON.stringify({
      format: 'reverse-archive-v1-save',
      version: 1,
      state: stored,
    }))
  } catch {
    // A full storage quota should not interrupt play.
  }
}

export function clearSessionV1(): void {
  try {
    getStorage()?.removeItem(V1_SAVE_KEY)
  } catch {
    // Ignore storage cleanup failures.
  }
}
