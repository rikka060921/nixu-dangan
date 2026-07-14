import { simulateRun } from '../src/simulation/heuristic'

const requested = Number(process.argv[2] ?? 1000)
const runCount = Number.isFinite(requested) ? Math.max(1, Math.min(100_000, Math.floor(requested))) : 1000
const results = Array.from({ length: runCount }, (_, index) => simulateRun(`balance-${index}`))
const wins = results.filter((result) => result.won)
const floorDistribution = Object.fromEntries(
  [...new Set(results.map((result) => result.floor))]
    .sort((left, right) => left - right)
    .map((floor) => [floor, results.filter((result) => result.floor === floor).length]),
)
const lossReasonDistribution = Object.fromEntries(
  [...new Set(results.filter((result) => !result.won).map((result) => result.reason ?? '未结束'))]
    .map((reason) => [reason, results.filter((result) => !result.won && (result.reason ?? '未结束') === reason).length]),
)

const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)

console.log(
  JSON.stringify(
    {
      runs: results.length,
      wins: wins.length,
      winRate: wins.length / results.length,
      actReach: {
        act2: results.filter((result) => result.floor >= 6).length / results.length,
        act3: results.filter((result) => result.floor >= 12).length / results.length,
        cleared: wins.length / results.length,
      },
      floorDistribution,
      lossReasonDistribution,
      averageActions: average(results.map((result) => result.actions)),
      averageTerminalTimeline: average(results.map((result) => result.timeline)),
      averageTerminalParadox: average(results.map((result) => result.paradox)),
    },
    null,
    2,
  ),
)
