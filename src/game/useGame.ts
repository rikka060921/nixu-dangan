import { useCallback, useEffect, useReducer } from 'react'

import { ENCOUNTERS } from '../content/gameContent'
import { cueForAction, playCue, setAudioPreferences, setMusicTheme, startAudio } from './audio'
import type { MusicTheme } from './audio'
import { normalizeSoundVolume } from './audioSettings'
import { createInitialGameState, gameReducer } from './reducer'
import type { GameAction } from './reducer'
import { clearSession, saveMeta, saveSession } from './storage'

export function useGame() {
  const [state, rawDispatch] = useReducer(gameReducer, undefined, createInitialGameState)
  const musicTheme: MusicTheme = state.screen.name === 'map'
    ? 'map'
    : state.screen.name === 'battle'
      ? ENCOUNTERS[state.battle?.encounterId ?? 'fire'].rank === 'boss' ? 'boss' : 'battle'
      : state.screen.name === 'ending'
        ? 'ending'
        : 'story'
  const dispatch = useCallback((action: GameAction) => {
    const cue = cueForAction(action.type)
    const enabled = action.type === 'toggle-sound' ? !state.meta.soundEnabled : state.meta.soundEnabled
    const volume = action.type === 'set-sound-volume'
      ? normalizeSoundVolume(action.volume, state.meta.soundVolume)
      : state.meta.soundVolume
    setAudioPreferences({ enabled, volume })
    if (cue) playCue(cue)
    rawDispatch(action)
  }, [state.meta.soundEnabled, state.meta.soundVolume])

  useEffect(() => {
    setAudioPreferences({ enabled: state.meta.soundEnabled, volume: state.meta.soundVolume })
  }, [state.meta.soundEnabled, state.meta.soundVolume])

  useEffect(() => {
    setMusicTheme(musicTheme)
  }, [musicTheme])

  useEffect(() => {
    const beginAudio = () => startAudio()
    window.addEventListener('pointerdown', beginAudio, { once: true })
    window.addEventListener('keydown', beginAudio, { once: true })
    return () => {
      window.removeEventListener('pointerdown', beginAudio)
      window.removeEventListener('keydown', beginAudio)
    }
  }, [])

  useEffect(() => {
    saveMeta(state.meta)
    if (state.screen.name === 'ending') clearSession()
    else saveSession(state)
  }, [state])

  return { state, dispatch }
}
