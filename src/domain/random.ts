const STEP = 0x6d2b79f5

export function seedHash(value: string): number {
  let hash = 2166136261
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function nextRandom(state: number): { state: number; value: number } {
  const nextState = (state + STEP) >>> 0
  let value = nextState
  value = Math.imul(value ^ (value >>> 15), value | 1)
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
  return { state: nextState, value: ((value ^ (value >>> 14)) >>> 0) / 4294967296 }
}

export function shuffleSeeded<T>(items: readonly T[], initialState: number): { items: T[]; state: number } {
  const result = [...items]
  let state = initialState
  for (let index = result.length - 1; index > 0; index -= 1) {
    const random = nextRandom(state)
    state = random.state
    const target = Math.floor(random.value * (index + 1))
    ;[result[index], result[target]] = [result[target], result[index]]
  }
  return { items: result, state }
}

export function sampleWeighted<T>(
  items: readonly T[],
  getWeight: (item: T) => number,
  count: number,
  initialState: number,
): { items: T[]; state: number } {
  const pool = [...items]
  const selected: T[] = []
  let state = initialState

  while (pool.length && selected.length < count) {
    const weights = pool.map((item) => Math.max(0, getWeight(item)))
    const total = weights.reduce((sum, weight) => sum + weight, 0)
    const random = nextRandom(state)
    state = random.state
    let threshold = random.value * (total || pool.length)
    let selectedIndex = pool.length - 1

    for (let index = 0; index < pool.length; index += 1) {
      threshold -= total ? weights[index] : 1
      if (threshold <= 0) {
        selectedIndex = index
        break
      }
    }
    selected.push(pool[selectedIndex])
    pool.splice(selectedIndex, 1)
  }

  return { items: selected, state }
}
