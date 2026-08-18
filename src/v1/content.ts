import type { ChapterDefinition, V1CardDefinition, V1CardId } from './types'

export const V1_CARDS: Record<V1CardId, V1CardDefinition> = {
  seed: { id: 'seed', name: '埋下伏笔', glyph: '因', lane: 'past', effect: 'seed', power: 2, rarity: '常规', brief: '留下一个起因', link: '未来可以引爆' },
  witness: { id: 'witness', name: '救下证人', glyph: '人', lane: 'past', effect: 'witness', power: 3, rarity: '常规', brief: '创造一名证人', link: '证言会倍增' },
  anchor: { id: 'anchor', name: '钉死此刻', glyph: '锚', lane: 'past', effect: 'anchor', power: 3, rarity: '常规', brief: '固定一段历史', link: '提高本轮收益' },
  signal: { id: 'signal', name: '提前留言', glyph: '信', lane: 'past', effect: 'signal', power: 2, rarity: '闪光', brief: '向未来发出信号', link: '换线时加速' },
  echo: { id: 'echo', name: '未来回声', glyph: '回', lane: 'future', effect: 'echo', power: 2, rarity: '常规', brief: '引爆过去的积累', link: '产生一枚回声' },
  testimony: { id: 'testimony', name: '公开证言', glyph: '证', lane: 'future', effect: 'testimony', power: 3, rarity: '常规', brief: '每名证人都爆发', link: '证人越多越强' },
  resonance: { id: 'resonance', name: '因果共振', glyph: '鸣', lane: 'future', effect: 'resonance', power: 3, rarity: '闪光', brief: '同时点燃全部伏笔', link: '伏笔越多越强' },
  backflow: { id: 'backflow', name: '答案回流', glyph: '逆', lane: 'future', effect: 'backflow', power: 2, rarity: '闪光', brief: '将两枚回声送回过去', link: '下张过去牌连续触发' },
  rewrite: { id: 'rewrite', name: '改写昨日', glyph: '改', lane: 'past', effect: 'rewrite', power: 4, rarity: '闪光', brief: '消耗回声重写过去', link: '回声越多越强' },
  cascade: { id: 'cascade', name: '明日倾泻', glyph: '潮', lane: 'future', effect: 'cascade', power: 4, rarity: '失控', brief: '汇总两条时间线', link: '适合放在最后' },
  paradox: { id: 'paradox', name: '悖论爆炸', glyph: '爆', lane: 'future', effect: 'paradox', power: 5, rarity: '失控', brief: '引爆当前所有能量', link: '场面越大越强' },
  synchronize: { id: 'synchronize', name: '双线同步', glyph: '合', lane: 'past', effect: 'synchronize', power: 4, rarity: '失控', brief: '按换线次数追加爆发', link: '来回切换时最强' },
}

export const START_DECK_V1: V1CardId[] = [
  'seed', 'seed', 'witness', 'anchor', 'signal',
  'echo', 'testimony', 'resonance', 'backflow', 'rewrite',
]

export const CHAPTERS_V1: ChapterDefinition[] = [
  {
    id: 'missing-murder', number: '01', title: '没有发生的谋杀', subtitle: '双线苏醒', target: 24,
    story: '未来的验尸报告记录了一名仍在过去行走的死者。',
    pastChoices: [
      {
        id: 'save-inspector', title: '救下监察官', glyph: '救', brief: '让死者活着走进未来', result: '未来出现了一名不应存在的活证人。', bonus: { witnesses: 2 },
        futures: [
          { id: 'living-court', title: '活人法庭', glyph: '庭', brief: '让幸存者当众作证', result: '证言穿过十八次循环回到今夜。', bonus: { echoes: 1, witnesses: 1 }, openingCard: 'testimony' },
          { id: 'empty-morgue', title: '空白验尸室', glyph: '空', brief: '调查一具消失的尸体', result: '没有尸体的死亡证明被送回过去。', bonus: { echoes: 2 }, openingCard: 'backflow' },
        ],
      },
      {
        id: 'steal-report', title: '偷走死亡报告', glyph: '盗', brief: '让结果早于谋杀出现', result: '一份来自明天的报告成了今夜的起因。', bonus: { seeds: 2, anchors: 1 },
        futures: [
          { id: 'complete-proof', title: '完整罪证', glyph: '卷', brief: '让未来追溯每一处伏笔', result: '所有伏笔被同时点亮。', bonus: { seeds: 1 }, openingCard: 'resonance' },
          { id: 'ash-safe', title: '灰烬保险库', glyph: '灰', brief: '从毁掉的未来取回一把钥匙', result: '钥匙的回声打开了它被烧毁前的门。', bonus: { echoes: 2, anchors: 1 }, openingCard: 'rewrite' },
        ],
      },
    ],
  },
  {
    id: 'reverse-bell', number: '02', title: '逆行钟楼', subtitle: '倒走的城市', target: 34,
    story: '钟声每响一次，未来就会向过去塌缩一分钟。',
    pastChoices: [
      {
        id: 'stop-bell', title: '按住第一声钟', glyph: '止', brief: '把城市钉在 23:57', result: '未来保留了一条没有倒退的街道。', bonus: { anchors: 2 },
        futures: [
          { id: 'still-street', title: '静止长街', glyph: '静', brief: '从停止的时钟中取回信号', result: '一段未来留言开始在过去播放。', bonus: { anchors: 1, echoes: 1 }, openingCard: 'signal' },
          { id: 'clock-heart', title: '钟楼心脏', glyph: '心', brief: '让两个时刻同时跳动', result: '过去与未来暂时进入同一拍。', bonus: { anchors: 2 }, openingCard: 'synchronize' },
        ],
      },
      {
        id: 'mark-bell', title: '在钟锤上留名', glyph: '名', brief: '让每次钟响都记得你', result: '未来的所有钟声都指向同一个原因。', bonus: { seeds: 3 },
        futures: [
          { id: 'echo-square', title: '回声广场', glyph: '鸣', brief: '让全城同时听见你的名字', result: '钟声把所有伏笔串成了一条线。', bonus: { seeds: 2 }, openingCard: 'resonance' },
          { id: 'young-keeper', title: '尚未出生的守钟人', glyph: '子', brief: '请未来的守钟人教你修钟', result: '答案比问题早了二十年回到过去。', bonus: { echoes: 3 }, openingCard: 'backflow' },
        ],
      },
    ],
  },
  {
    id: 'tomorrow-paper', number: '03', title: '明日报社', subtitle: '先有结果', target: 46,
    story: '报纸每天只印明天的结局，却从不记录今天的原因。',
    pastChoices: [
      {
        id: 'print-cause', title: '印下一个原因', glyph: '印', brief: '在头版留下今夜的伏笔', result: '未来的所有结局开始追溯这行字。', bonus: { seeds: 4 },
        futures: [
          { id: 'cause-edition', title: '因由特刊', glyph: '因', brief: '让全城翻阅同一个原因', result: '每一份报纸都变成了连锁的一环。', bonus: { seeds: 2, echoes: 1 }, openingCard: 'resonance' },
          { id: 'blank-frontpage', title: '空白头版', glyph: '白', brief: '让未来为空白自己填写答案', result: '一份未曾印刷的报纸逆流回今夜。', bonus: { echoes: 3 }, openingCard: 'rewrite' },
        ],
      },
      {
        id: 'save-editor', title: '保住主编的记忆', glyph: '忆', brief: '让一个人记得每次循环', result: '未来出现了一名拥有十八份证言的编辑。', bonus: { witnesses: 3, anchors: 1 },
        futures: [
          { id: 'eighteen-testimonies', title: '十八份证言', glyph: '证', brief: '一次公开所有循环的记忆', result: '不同时间线的证言同时出庭。', bonus: { witnesses: 3 }, openingCard: 'testimony' },
          { id: 'last-broadcast', title: '最后广播', glyph: '播', brief: '把真相送进所有时刻', result: '过去与未来开始交替应答。', bonus: { witnesses: 1, echoes: 2 }, openingCard: 'synchronize' },
        ],
      },
    ],
  },
  {
    id: 'zero-archive', number: '04', title: '零时档案', subtitle: '闭合双线', target: 62,
    story: '档案管理员同时站在今夜和明天，准备删除其中一个你。',
    pastChoices: [
      {
        id: 'keep-both', title: '保留两个自己', glyph: '双', brief: '拒绝选择唯一历史', result: '两条时间线在零时之门前同时存在。', bonus: { anchors: 2, witnesses: 2, seeds: 2 },
        futures: [
          { id: 'double-dawn', title: '双重黎明', glyph: '曙', brief: '让两个结局一起降临', result: '历史不再选择，而是开始共振。', bonus: { echoes: 2, anchors: 2 }, openingCard: 'synchronize' },
          { id: 'paradox-city', title: '悖论白塔城', glyph: '悖', brief: '把互斥的未来叠在一起', result: '整座城市成为一枚即将爆炸的悖论。', bonus: { echoes: 3, seeds: 2 }, openingCard: 'paradox' },
        ],
      },
      {
        id: 'erase-future-self', title: '删除未来的自己', glyph: '删', brief: '把明天的死亡变成今夜的武器', result: '未来留下的空白开始向过去倾泻。', bonus: { seeds: 3, echoes: 2 },
        futures: [
          { id: 'archive-collapse', title: '档案倾泻', glyph: '潮', brief: '让所有被删除的结果一次归来', result: '整座档案馆沿着因果链倒向过去。', bonus: { seeds: 2, echoes: 2 }, openingCard: 'cascade' },
          { id: 'final-answer', title: '最后的答案', glyph: '答', brief: '把答案送回第一页档案', result: '循环的终点成了它自己的起点。', bonus: { echoes: 4, anchors: 1 }, openingCard: 'backflow' },
        ],
      },
    ],
  },
]

export const REWARD_POOL_V1: V1CardId[] = ['signal', 'backflow', 'rewrite', 'cascade', 'paradox', 'synchronize', 'resonance', 'testimony']
