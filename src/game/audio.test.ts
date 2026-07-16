// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'

import { normalizeSoundVolume } from './audioSettings'

function audioParam(initial = 0) {
  return {
    value: initial,
    cancelScheduledValues: vi.fn(),
    setTargetAtTime: vi.fn(),
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('audio preferences', () => {
  it('normalizes the supported 10% to 300% range', () => {
    expect(normalizeSoundVolume(undefined)).toBe(300)
    expect(normalizeSoundVolume(-20)).toBe(10)
    expect(normalizeSoundVolume(174.6)).toBe(175)
    expect(normalizeSoundVolume(900)).toBe(300)
    expect(normalizeSoundVolume('loud', 180)).toBe(180)
  })

  it('builds one boosted, limited master bus and updates it without recreating the context', async () => {
    vi.resetModules()
    const gains: Array<{ gain: ReturnType<typeof audioParam>; connect: ReturnType<typeof vi.fn> }> = []
    const oscillators: Array<{
      type: OscillatorType
      frequency: ReturnType<typeof audioParam>
      connect: ReturnType<typeof vi.fn>
      start: ReturnType<typeof vi.fn>
      stop: ReturnType<typeof vi.fn>
    }> = []
    const limiter = {
      threshold: audioParam(),
      knee: audioParam(),
      ratio: audioParam(),
      attack: audioParam(),
      release: audioParam(),
      connect: vi.fn(),
    }
    const destination = {}
    const context = {
      currentTime: 2,
      state: 'running',
      destination,
      resume: vi.fn(),
      createGain: vi.fn(() => {
        const node = { gain: audioParam(), connect: vi.fn() }
        gains.push(node)
        return node
      }),
      createDynamicsCompressor: vi.fn(() => limiter),
      createOscillator: vi.fn(() => {
        const oscillator = { type: 'sine' as OscillatorType, frequency: audioParam(), connect: vi.fn(), start: vi.fn(), stop: vi.fn() }
        oscillators.push(oscillator)
        return oscillator
      }),
    }
    const AudioContextMock = vi.fn(function AudioContextMockImplementation() {
      return context
    })
    vi.stubGlobal('AudioContext', AudioContextMock)

    const { playCue, setAudioPreferences } = await import('./audio')
    setAudioPreferences({ enabled: true, volume: 300 })
    expect(AudioContextMock).not.toHaveBeenCalled()

    playCue('select')
    expect(AudioContextMock).toHaveBeenCalledTimes(1)
    expect(gains[0].gain.value).toBe(3)
    expect(gains[1].gain.value).toBe(1)
    expect(gains[2].gain.value).toBe(1)
    expect(limiter.threshold.value).toBe(-3)
    expect(limiter.ratio.value).toBe(20)
    expect(gains[3].connect).toHaveBeenCalledWith(gains[0])
    expect(oscillators).toHaveLength(1)

    setAudioPreferences({ enabled: true, volume: 100 })
    expect(gains[1].gain.setTargetAtTime).toHaveBeenLastCalledWith(1 / 3, 2, 0.01)
    setAudioPreferences({ enabled: false, volume: 100 })
    playCue('select')
    expect(AudioContextMock).toHaveBeenCalledTimes(1)
    expect(oscillators).toHaveLength(1)
  })
})
