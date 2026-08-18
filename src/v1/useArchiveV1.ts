import { useCallback, useEffect, useReducer } from 'react'

import { playCue, setAudioPreferences, setMusicTheme, startAudio, type MusicTheme } from '../game/audio'
import { createInitialGameStateV1, gameReducerV1 } from './reducer'
import { clearSessionV1, saveMetaV1, saveSessionV1 } from './storage'
import type { GameActionV1 } from './types'

function cueFor(action: GameActionV1['type']) {
  if (action === 'toggle-stage') return 'place' as const
  if (action === 'auto-stage' || action === 'clear-stage') return 'select' as const
  if (action === 'resolve-chain') return 'resolve' as const
  if (action === 'choose-reward') return 'reward' as const
  if (action === 'toggle-sound') return 'toggle' as const
  if (['start-run', 'resume-run', 'choose-past', 'choose-future', 'continue-after-chain', 'skip-reward', 'restart'].includes(action)) return 'page' as const
  return null
}

export function useArchiveV1() {
  const [state, rawDispatch] = useReducer(gameReducerV1, undefined, createInitialGameStateV1)

  const dispatch = useCallback((action: GameActionV1) => {
    const cue = cueFor(action.type)
    if (cue) playCue(cue)
    rawDispatch(action)
  }, [])

  useEffect(() => {
    setAudioPreferences({ enabled: state.meta.soundEnabled, volume: state.meta.soundVolume })
    saveMetaV1(state.meta)
  }, [state.meta])

  useEffect(() => {
    if (state.screen.name === 'ending') clearSessionV1()
    else saveSessionV1(state)
  }, [state])

  useEffect(() => {
    const theme: MusicTheme = state.screen.name === 'battle'
      ? state.run?.chapterIndex === 3 ? 'boss' : 'battle'
      : state.screen.name === 'map'
        ? 'map'
        : state.screen.name === 'ending'
          ? 'ending'
          : 'story'
    setMusicTheme(theme)
  }, [state.screen.name, state.run?.chapterIndex])

  useEffect(() => {
    const unlock = () => startAudio()
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  return { state, dispatch }
}
