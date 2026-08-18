import { DEFAULT_SOUND_VOLUME, MAX_SOUND_VOLUME, normalizeSoundVolume } from './audioSettings'

type Cue = 'select' | 'place' | 'resolve' | 'page' | 'reward' | 'toggle'
export type MusicTheme = 'story' | 'map' | 'battle' | 'boss' | 'ending'

interface AudioGraph {
  context: AudioContext
  input: GainNode
  output: GainNode
  mute: GainNode
  music: GainNode
  sfx: GainNode
  musicFilter: BiquadFilterNode
}

let graph: AudioGraph | null = null
let soundEnabled = true
let soundVolume = DEFAULT_SOUND_VOLUME
let musicTheme: MusicTheme = 'story'
let musicStep = 0
let musicTimer: number | null = null
let musicStarted = false

const MUSIC_TEMPOS: Record<MusicTheme, number> = {
  story: 2100,
  map: 1750,
  battle: 1350,
  boss: 980,
  ending: 2300,
}

const MUSIC_NOTES: Record<MusicTheme, number[]> = {
  story: [146.83, 164.81, 196, 220],
  map: [130.81, 146.83, 174.61, 196, 220],
  battle: [110, 130.81, 146.83, 164.81],
  boss: [82.41, 98, 110, 123.47],
  ending: [146.83, 196, 220, 293.66],
}

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
    const music = context.createGain()
    const sfx = context.createGain()
    const musicFilter = context.createBiquadFilter()

    input.gain.value = 3
    output.gain.value = soundVolume / MAX_SOUND_VOLUME
    limiter.threshold.value = -3
    limiter.knee.value = 0
    limiter.ratio.value = 20
    limiter.attack.value = 0.003
    limiter.release.value = 0.1
    mute.gain.value = soundEnabled ? 1 : 0
    music.gain.value = 1
    sfx.gain.value = 1
    musicFilter.type = 'lowpass'
    musicFilter.frequency.value = musicTheme === 'boss' ? 1250 : 1900

    music.connect(musicFilter)
    musicFilter.connect(input)
    sfx.connect(input)
    input.connect(output)
    output.connect(limiter)
    limiter.connect(mute)
    mute.connect(context.destination)
    graph = { context, input, output, mute, music, sfx, musicFilter }
  }
  if (graph.context.state === 'suspended') void graph.context.resume()
  return graph
}

function smoothGain(param: AudioParam, value: number, context: AudioContext): void {
  param.cancelScheduledValues(context.currentTime)
  param.setTargetAtTime(value, context.currentTime, 0.01)
}

export function setAudioPreferences(preferences: { enabled: boolean; volume: number }): void {
  const wasEnabled = soundEnabled
  soundEnabled = preferences.enabled
  soundVolume = normalizeSoundVolume(preferences.volume)
  if (!graph) return
  smoothGain(graph.output.gain, soundVolume / MAX_SOUND_VOLUME, graph.context)
  smoothGain(graph.mute.gain, soundEnabled ? 1 : 0, graph.context)
  if (!soundEnabled) stopMusic()
  else if (!wasEnabled) restartMusic()
}

function stopMusic(): void {
  if (musicTimer !== null && typeof window !== 'undefined') window.clearInterval(musicTimer)
  musicTimer = null
  musicStarted = false
}

function synthTone(
  audio: AudioGraph,
  destination: AudioNode,
  frequency: number,
  duration: number,
  volume: number,
  delay = 0,
  type: OscillatorType = 'sine',
  attack = 0.008,
): void {
  const start = audio.context.currentTime + delay
  const oscillator = audio.context.createOscillator()
  const gain = audio.context.createGain()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, start)
  oscillator.detune.setValueAtTime(((musicStep * 7) % 9) - 4, start)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(volume, start + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  oscillator.connect(gain)
  gain.connect(destination)
  oscillator.start(start)
  oscillator.stop(start + duration + 0.04)
}

function tone(frequency: number, duration: number, volume: number, delay = 0, type: OscillatorType = 'sine'): void {
  const audio = audioGraph()
  if (!audio) return
  synthTone(audio, audio.sfx, frequency, duration, volume, delay, type)
}

function musicPulse(): void {
  if (!soundEnabled || !musicStarted) return
  const audio = audioGraph()
  if (!audio) return
  const notes = MUSIC_NOTES[musicTheme]
  const frequency = notes[musicStep % notes.length]
  const isBoss = musicTheme === 'boss'

  synthTone(audio, audio.music, frequency, isBoss ? 1.6 : 3, 0.055, 0.03, isBoss ? 'sawtooth' : 'triangle', 0.035)
  if (musicStep % 2 === 0) {
    synthTone(audio, audio.music, notes[(musicStep + 2) % notes.length] * 2, 1.8, 0.022, 0.38, 'sine', 0.035)
  }
  if (musicStep % 4 === 0) {
    synthTone(audio, audio.music, notes[0] / 2, 4, 0.028, 0.03, 'sine', 0.035)
  }
  musicStep += 1
}

function restartMusic(): void {
  stopMusic()
  if (!soundEnabled || typeof window === 'undefined') return
  musicStarted = true
  musicPulse()
  musicTimer = window.setInterval(musicPulse, MUSIC_TEMPOS[musicTheme])
}

export function startAudio(): void {
  try {
    if (!soundEnabled) return
    const audio = audioGraph()
    if (!audio) return
    if (audio.context.state === 'suspended') void audio.context.resume()
    if (!musicStarted) restartMusic()
  } catch {
    // Browsers may reject audio startup until a real user gesture.
  }
}

export function setMusicTheme(theme: MusicTheme): void {
  if (musicTheme === theme) return
  musicTheme = theme
  musicStep = 0
  if (graph) graph.musicFilter.frequency.value = theme === 'boss' ? 1250 : 1900
  if (musicStarted) restartMusic()
}

export function playCue(cue: Cue): void {
  try {
    if (!soundEnabled) return
    startAudio()
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
