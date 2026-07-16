import type { GameAction } from './reducer'
import { DEFAULT_SOUND_VOLUME, MAX_SOUND_VOLUME, normalizeSoundVolume } from './audioSettings'

type Cue = 'select' | 'place' | 'resolve' | 'page' | 'reward' | 'toggle'

interface AudioGraph {
  context: AudioContext
  input: GainNode
  output: GainNode
  mute: GainNode
}

let graph: AudioGraph | null = null
let soundEnabled = true
let soundVolume = DEFAULT_SOUND_VOLUME

function audioGraph(): AudioGraph | null {
  if (typeof window === 'undefined') return null
  const AudioContextClass = window.AudioContext
  if (!AudioContextClass) return null
  if (!graph) {
    const context = new AudioContextClass()
    const input = context.createGain()
    const output = context.createGain()
    const limiter = context.createDynamicsCompressor()
    const mute = context.createGain()

    input.gain.value = 3
    output.gain.value = soundVolume / MAX_SOUND_VOLUME
    limiter.threshold.value = -3
    limiter.knee.value = 0
    limiter.ratio.value = 20
    limiter.attack.value = 0.003
    limiter.release.value = 0.1
    mute.gain.value = soundEnabled ? 1 : 0

    input.connect(output)
    output.connect(limiter)
    limiter.connect(mute)
    mute.connect(context.destination)
    graph = { context, input, output, mute }
  }
  if (graph.context.state === 'suspended') void graph.context.resume()
  return graph
}

function smoothGain(param: AudioParam, value: number, context: AudioContext): void {
  param.cancelScheduledValues(context.currentTime)
  param.setTargetAtTime(value, context.currentTime, 0.01)
}

export function setAudioPreferences(preferences: { enabled: boolean; volume: number }): void {
  soundEnabled = preferences.enabled
  soundVolume = normalizeSoundVolume(preferences.volume)
  if (!graph) return
  smoothGain(graph.output.gain, soundVolume / MAX_SOUND_VOLUME, graph.context)
  smoothGain(graph.mute.gain, soundEnabled ? 1 : 0, graph.context)
}

function tone(frequency: number, duration: number, volume: number, delay = 0, type: OscillatorType = 'sine'): void {
  const audio = audioGraph()
  if (!audio) return
  const start = audio.context.currentTime + delay
  const oscillator = audio.context.createOscillator()
  const gain = audio.context.createGain()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, start)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  oscillator.connect(gain)
  gain.connect(audio.input)
  oscillator.start(start)
  oscillator.stop(start + duration + 0.02)
}

export function playCue(cue: Cue): void {
  try {
    if (!soundEnabled) return
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
