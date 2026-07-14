import { CARDS } from '../content/cards'
import type { CardId, Era, IncidentDefinition } from './types'

const SPECIAL_HINTS: Partial<Record<CardId, Partial<Record<Era, string>>>> = {
  rescue: {
    0: '疏散过早：没有找到证人。',
    1: '及时疏散：真相 +1，保护证人。',
    2: '疏散过晚：没有找到证人。',
  },
  memory: {
    0: '追溯源头：真相 +4，悖论 +2。',
    1: '改写记忆：真相 +3，悖论 +2。',
    2: '改写记忆：真相 +3，悖论 +2。',
  },
  blackout: {
    0: '提前断电：取消固定事件，悖论 +2。',
    1: '停电太晚：无法取消事件。',
    2: '停电太晚：无法取消事件。',
  },
  annotation: {
    0: '普通批注：真相 +1。',
    1: '普通批注：真相 +1。',
    2: '来自未来的批注：真相 +3。',
  },
  thread: {
    0: '红线追迹：真相 +1。',
    1: '现场追迹：真相 +1，可信度 +1。',
    2: '红线追迹：真相 +1。',
  },
  delay: {
    0: '延迟灾害：抵挡本轮损伤。',
    1: '延迟灾害：抵挡本轮损伤。',
    2: '预留缓冲：抵挡本轮损伤，真相 +1。',
  },
  doorplate: {
    0: '在火前找到门牌：抵挡损伤，真相 +2。',
    1: '门牌示警：抵挡本轮损伤。',
    2: '门牌示警：抵挡本轮损伤。',
  },
  rewind: {
    0: '回到案发前：取消事件，回复 2，悖论 +2。',
    1: '回溯不够早：没有效果。',
    2: '回溯不够早：没有效果。',
  },
  secondhand: {
    0: '秒针错位：悖论 +1。',
    1: '秒针错位：悖论 +1。',
    2: '借用未来：真相 +2。',
  },
}

const UPGRADE_HINTS: Partial<Record<CardId, Partial<Record<Era, string>>>> = {
  rescue: {
    0: '疏散过早：没有找到证人。',
    1: '及时疏散：真相 +2，保护证人。',
    2: '疏散过晚：没有找到证人。',
  },
  memory: {
    0: '追溯源头：真相 +4，悖论 +1。',
    1: '改写记忆：真相 +3，悖论 +1。',
    2: '改写记忆：真相 +3，悖论 +1。',
  },
  blackout: {
    0: '提前断电：取消固定事件，时间线 +1，悖论 +2。',
    1: '停电太晚：无法取消事件。',
    2: '停电太晚：无法取消事件。',
  },
  annotation: { 0: '校注：真相 +2。', 1: '校注：真相 +2。', 2: '未来校注：真相 +4。' },
  thread: { 0: '红线追迹：真相 +2。', 1: '现场追迹：真相 +2，可信度 +1。', 2: '红线追迹：真相 +2。' },
  delay: { 0: '延迟灾害：抵挡本轮损伤。', 1: '延迟灾害：抵挡本轮损伤。', 2: '预留缓冲：抵挡损伤，真相 +2。' },
  doorplate: { 0: '在火前找到门牌：抵挡损伤，真相 +3。', 1: '门牌示警：抵挡本轮损伤。', 2: '门牌示警：抵挡本轮损伤。' },
  rewind: { 0: '回到案发前：取消事件，回复 4，悖论 +2。', 1: '回溯不够早：没有效果。', 2: '回溯不够早：没有效果。' },
  secondhand: { 0: '秒针错位：悖论 +1。', 1: '秒针错位：悖论 +1。', 2: '借用未来：真相 +3。' },
}

function relation(era: Era, incidentEra: Era): string {
  if (era < incidentEra) return '赶在事件之前'
  if (era === incidentEra) return '与事件同处一刻，行动先结算'
  return '发生在事件之后'
}

export function getPlacementHint(cardId: CardId, era: Era, incident: IncidentDefinition, upgraded = false): string {
  const special = (upgraded ? UPGRADE_HINTS[cardId]?.[era] : undefined) ?? SPECIAL_HINTS[cardId]?.[era]
  if (special) return `${relation(era, incident.era)} · ${special}`

  const before = era <= incident.era
  if (cardId === 'seal') {
    return `${relation(era, incident.era)} · ${before ? `防护会在固定事件前生效${upgraded ? '，真相 +1' : ''}。` : '来不及保护固定事件。'}`
  }
  if (cardId === 'clarify') {
    return `${relation(era, incident.era)} · 可信度 +${upgraded ? 2 : 1}${before ? `，可提前破解谣言${upgraded ? '并获得 1 点真相' : ''}。` : '，但来不及破解谣言。'}`
  }
  if (cardId === 'anchor') {
    return `${relation(era, incident.era)} · ${before ? `锚定真相，悖论 -${upgraded ? 2 : 1}。` : '来不及锚定本次事件。'}`
  }

  return `${relation(era, incident.era)} · ${upgraded ? CARDS[cardId].upgradeText : CARDS[cardId].text}`
}
