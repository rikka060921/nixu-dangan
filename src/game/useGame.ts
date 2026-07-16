import { useCallback, useEffect, useReducer } from 'react'

import { cueForAction, playCue, setAudioPreferences } from './audio'
import { normalizeSoundVolume } from './audioSettings'
import { createInitialGameState, gameReducer } from './reducer'
import type { GameAction } from './reducer'
import { clearSession, saveMeta, saveSession } from './storage'

export function useGame() {
  const [state, rawDispatch] = useReducer(gameReducer, undefined, createInitialGameState)
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
    saveMeta(state.meta)
    if (state.screen.name === 'ending') clearSession()
    else saveSession(state)
  }, [state])

  return { state, dispatch }
}
