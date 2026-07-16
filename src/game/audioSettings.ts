export const MIN_SOUND_VOLUME = 10
export const MAX_SOUND_VOLUME = 300
export const DEFAULT_SOUND_VOLUME = MAX_SOUND_VOLUME

export function normalizeSoundVolume(value: unknown, fallback = DEFAULT_SOUND_VOLUME): number {
  const normalizedFallback = typeof fallback === 'number' && Number.isFinite(fallback)
    ? Math.min(MAX_SOUND_VOLUME, Math.max(MIN_SOUND_VOLUME, Math.round(fallback)))
    : DEFAULT_SOUND_VOLUME
  if (typeof value !== 'number' || !Number.isFinite(value)) return normalizedFallback
  return Math.min(MAX_SOUND_VOLUME, Math.max(MIN_SOUND_VOLUME, Math.round(value)))
}
