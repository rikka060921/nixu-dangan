import type {
  ChallengeDefinition,
  ChallengeId,
  EncounterDefinition,
  EncounterId,
  IncidentDefinition,
  IncidentId,
  MapNode,
  RelicDefinition,
  RelicId,
} from '../domain/types'

export const CHALLENGES: Record<ChallengeId, ChallengeDefinition> = {
  standard: {
    id: 'standard',
    name: '标准调查',
    timeline: 30,
    paradoxLimit: 8,
    targetMultiplier: 1,
    inkMultiplier: 1,
    text: '推荐首次游玩；规则完整，容错适中。',
  },
  paradox: {
    id: 'paradox',
    name: '悖论挑战',
    timeline: 26,
    paradoxLimit: 7,
    targetMultiplier: 1.15,
    inkMultiplier: 1.5,
    text: '案件真相要求 +15%，时间线与悖论上限降低。',
  },
  zero: {
    id: 'zero',
    name: '零时挑战',
    timeline: 22,
    paradoxLimit: 6,
    targetMultiplier: 1.3,
    inkMultiplier: 2,
    text: '案件真相要求 +30%，以一张伪造口供污染起始牌组。',
  },
}

export const RELICS: Record<RelicId, RelicDefinition> = {
  watch: { id: 'watch', name: '烧焦的怀表', text: '每场案件第一张牌费用为 0。' },
  crane: { id: 'crane', name: '折纸心灯', text: '进入每场案件时修复 2 点时间线。' },
  redthread: { id: 'redthread', name: '朱砂红线', text: '每回合第一张「证」额外获得 1 点真相。' },
  ash: { id: 'ash', name: '灰烬印章', text: '每次取消固定事件时修复 2 点时间线。' },
  mirror: { id: 'mirror', name: '镜面残片', text: '每回合首次增加悖论时获得 1 点真相。' },
}

export const INCIDENTS: Record<IncidentId, IncidentDefinition> = {
  fire: { id: 'fire', name: '固定事件：仓库火灾', era: 2, glyph: '火', intent: '未受保护：时间线 -4，证人死亡' },
  interrogation: { id: 'interrogation', name: '固定事件：监察官审讯', era: 1, glyph: '审', intent: '可信度不足：时间线 -3' },
  rumor: { id: 'rumor', name: '固定事件：伪造的报纸', era: 0, glyph: '伪', intent: '未被澄清：可信度归零，悖论 +1' },
  mirror: { id: 'mirror', name: '固定事件：镜像复述', era: 1, glyph: '镜', intent: '标签少于 2 种：时间线 -3' },
  theft: { id: 'theft', name: '固定事件：证物窃取', era: 1, glyph: '窃', intent: '未受保护：时间线 -3' },
  purge: { id: 'purge', name: '固定事件：档案销毁', era: 2, glyph: '毁', intent: '真相未锚定：失去 3 点真相' },
  rewrite: { id: 'rewrite', name: '固定事件：规则改写', era: 1, glyph: '改', intent: '未取消：悖论 +1，时间线 -2' },
  collapse: { id: 'collapse', name: '固定事件：零时坍塌', era: 2, glyph: '零', intent: '真相未锚定：时间线 -6，悖论 +1' },
  toll: { id: 'toll', name: '固定事件：第十三声钟响', era: 2, glyph: '钟', intent: '真相未锚定：时间线 -4' },
  silence: { id: 'silence', name: '固定事件：全城失语', era: 1, glyph: '默', intent: '本轮未打出「证」：时间线 -4' },
  inversion: { id: 'inversion', name: '固定事件：因果倒置', era: 0, glyph: '倒', intent: '本轮未打出「改」：悖论 +2' },
}

export const ENCOUNTERS: Record<EncounterId, EncounterDefinition> = {
  fire: {
    id: 'fire',
    name: '余烬证人',
    type: '普通案件',
    target: 7,
    incidents: ['fire', 'interrogation', 'fire'],
    story: '她已经在仓库里死过十七次。这一次，她在火起之前看见了你。',
  },
  mirror: {
    id: 'mirror',
    name: '镜廊审讯',
    type: '普通案件',
    target: 9,
    incidents: ['rumor', 'mirror', 'interrogation'],
    story: '监察官逐字复述你的供词，连停顿都一模一样——比你早半秒。',
  },
  bell: {
    id: 'bell',
    name: '逆行钟楼',
    type: '普通案件',
    target: 11,
    incidents: ['theft', 'toll', 'inversion', 'fire'],
    story: '钟楼每响一次，城市就倒退一分钟。守钟人已经比自己的出生更年轻。',
  },
  twins: {
    id: 'twins',
    name: '双生书吏',
    type: '精英案件',
    target: 13,
    incidents: ['theft', 'mirror', 'purge', 'theft'],
    story: '两个书吏共用一段过去。你删除其中一人，另一人便记起两次死亡。',
  },
  faceless: {
    id: 'faceless',
    name: '无面见证人',
    type: '精英案件',
    target: 15,
    incidents: ['rumor', 'silence', 'inversion', 'purge', 'collapse'],
    story: '所有证人都指向同一个凶手，却没有任何人记得那张脸。',
  },
  boss: {
    id: 'boss',
    name: '零时档案',
    type: '固定历史 · Boss',
    target: 20,
    incidents: ['rewrite', 'fire', 'purge', 'collapse', 'collapse'],
    story: '档案管理员摘下面具。那张脸属于三天后的你。',
  },
}

export const MAP_TEMPLATES: Record<string, MapNode> = {
  fire: { type: 'battle', id: 'fire', icon: '火', title: '余烬证人', sub: '普通案件', description: '救下仓库里的唯一证人' },
  mirror: { type: 'battle', id: 'mirror', icon: '镜', title: '镜廊审讯', sub: '普通案件', description: '监察官知道你下一句供词' },
  bell: { type: 'battle', id: 'bell', icon: '钟', title: '逆行钟楼', sub: '普通案件', description: '每一声钟响都让城市倒退' },
  twins: { type: 'elite', id: 'twins', icon: '双', title: '双生书吏', sub: '精英案件', description: '共享过去的两名守档人' },
  faceless: { type: 'elite', id: 'faceless', icon: '默', title: '无面见证人', sub: '精英案件', description: '全城都忘记了凶手的脸' },
  boss: { type: 'boss', id: 'boss', icon: '零', title: '零时档案', sub: '固定历史', description: '灾难真正的起点' },
  telegram: { type: 'event', id: 'telegram', icon: '函', title: '无字电报', sub: '异常事件', description: '一封来自明天的电报' },
  photo: { type: 'event', id: 'photo', icon: '像', title: '失真的合影', sub: '异常事件', description: '照片上多出一个你' },
  rest: { type: 'rest', id: 'rest', icon: '息', title: '回声室', sub: '安全节点', description: '修补时间线或精简牌组' },
  rest2: { type: 'rest', id: 'rest2', icon: '息', title: '午夜墨池', sub: '安全节点', description: '修补、校准或精简牌组' },
  shop: { type: 'shop', id: 'shop', icon: '铺', title: '倒悬书摊', sub: '交易节点', description: '用回声交换牌与遗物' },
}

