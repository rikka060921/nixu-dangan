import { useCallback, useEffect, useReducer } from 'react'

import { cueForAction, playCue } from './audio'
import { createInitialGameState, gameReducer } from './reducer'
import type { GameAction } from './reducer'
import { clearSession, saveMeta, saveSession } from './storage'

export function useGame() {
  const [state, rawDispatch] = useReducer(gameReducer, undefined, createInitialGameState)
  const dispatch = useCallback((action: GameAction) => {
    const cue = cueForAction(action.type)
    const shouldPlay = action.type === 'toggle-sound' ? !state.meta.soundEnabled : state.meta.soundEnabled
    if (cue && shouldPlay) playCue(cue)
    rawDispatch(action)
  }, [state.meta.soundEnabled])

  useEffect(() => {
    saveMeta(state.meta)
    if (state.screen.name === 'ending') clearSession()
    else saveSession(state)
  }, [state])

  return { state, dispatch }
}
