import { useEffect, useReducer } from 'react'

import { createInitialGameState, gameReducer } from './reducer'
import { clearSession, saveMeta, saveSession } from './storage'

export function useGame() {
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialGameState)

  useEffect(() => {
    saveMeta(state.meta)
    if (state.screen.name === 'ending') clearSession()
    else saveSession(state)
  }, [state])

  return { state, dispatch }
}

