import type { GameAction } from './reducer'

type Cue = 'select' | 'place' | 'resolve' | 'page' | 'reward' | 'toggle'

let context: AudioContext | null = null

function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AudioContextClass = window.AudioContext
  if (!AudioContextClass) return null
  context ??= new AudioContextClass()
  if (context.state === 'suspended') void context.resume()
  return context
}

function tone(frequency: number, duration: number, volume: number, delay = 0, type: OscillatorType = 'sine'): void {
  const audio = audioContext()
  if (!audio) return
  const start = audio.currentTime + delay
  const oscillator = audio.createOscillator()
  const gain = audio.createGain()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, start)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  oscillator.connect(gain)
  gain.connect(audio.destination)
  oscillator.start(start)
  oscillator.stop(start + duration + 0.02)
}

export function playCue(cue: Cue): void {
  try {
    if (cue === 'select') tone(420, 0.07, 0.025, 0, 'triangle')
    if (cue === 'place') {
      tone(310, 0.09, 0.03, 0, 'triangle')
      tone(465, 0.08, 0.022, 0.045, 'sine')
    }
    if (cue === 'resolve') {
      tone(180, 0.18, 0.035, 0, 'sawtooth')
      tone(270, 0.22, 0.03, 0.07, 'triangle')
      tone(405, 0.28, 0.025, 0.14, 'sine')
    }
    if (cue === 'page') tone(240, 0.11, 0.025, 0, 'triangle')
    if (cue === 'reward') {
      tone(440, 0.12, 0.025)
      tone(660, 0.18, 0.025, 0.08)
    }
    if (cue === 'toggle') tone(520, 0.1, 0.025, 0, 'sine')
  } catch {
    // Audio feedback is optional and must never interrupt the run.
  }
}

export function cueForAction(action: GameAction['type']): Cue | null {
  if (action === 'select-card' || action === 'remove-placed') return 'select'
  if (action === 'place-card') return 'place'
  if (action === 'resolve-timeline') return 'resolve'
  if (action === 'choose-reward' || action === 'buy-shop-relic' || action === 'upgrade-rest-card' || action === 'upgrade-shop-card') return 'reward'
  if (action === 'toggle-sound') return 'toggle'
  if (['start-run', 'select-node', 'choose-event', 'choose-rest', 'continue-chapter', 'leave-shop'].includes(action)) return 'page'
  return null
}
