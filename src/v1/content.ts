import type { ChapterDefinition, V1CardDefinition, V1CardId } from './types'

export const V1_CARDS: Record<V1CardId, V1CardDefinition> = {
  seed: { id: 'seed', name: '留下线索', glyph: '因', lane: 'past', effect: 'seed', power: 2, rarity: '常规', brief: '线索 +1', link: '未来牌会利用它加分' },
  witness: { id: 'witness', name: '救下证人', glyph: '人', lane: 'past', effect: 'witness', power: 3, rarity: '常规', brief: '证人 +1', link: '证言牌会因此加分' },
  anchor: { id: 'anchor', name: '稳住现场', glyph: '锚', lane: 'past', effect: 'anchor', power: 3, rarity: '常规', brief: '稳定 +1', link: '本轮结算额外加分' },
  signal: { id: 'signal', name: '提前传话', glyph: '信', lane: 'past', effect: 'signal', power: 2, rarity: '闪光', brief: '利用未来能量', link: '过去未来都有牌时更强' },
  echo: { id: 'echo', name: '查看结果', glyph: '见', lane: 'future', effect: 'echo', power: 2, rarity: '常规', brief: '按过去的准备加分', link: '准备越充分越强' },
  testimony: { id: 'testimony', name: '公开证言', glyph: '证', lane: 'future', effect: 'testimony', power: 3, rarity: '常规', brief: '按证人数量加分', link: '证人越多越强' },
  resonance: { id: 'resonance', name: '引爆线索', glyph: '鸣', lane: 'future', effect: 'resonance', power: 3, rarity: '闪光', brief: '按线索数量加分', link: '线索越多越强' },
  backflow: { id: 'backflow', name: '时间回传', glyph: '逆', lane: 'future', effect: 'backflow', power: 2, rarity: '闪光', brief: '选择前面的过去牌', link: '从那里开始重新结算' },
  rewrite: { id: 'rewrite', name: '改写现场', glyph: '改', lane: 'past', effect: 'rewrite', power: 4, rarity: '闪光', brief: '利用未来信息', link: '未来准备越多越强' },
  cascade: { id: 'cascade', name: '总分翻涌', glyph: '潮', lane: 'future', effect: 'cascade', power: 4, rarity: '失控', brief: '汇总当前分数', link: '放在最后通常最强' },
  paradox: { id: 'paradox', name: '全场爆发', glyph: '爆', lane: 'future', effect: 'paradox', power: 5, rarity: '失控', brief: '引爆所有积累', link: '积累越多越强' },
  synchronize: { id: 'synchronize', name: '红蓝同步', glyph: '合', lane: 'past', effect: 'synchronize', power: 4, rarity: '失控', brief: '按换色次数加分', link: '红蓝交替时最强' },
}

export const START_DECK_V1: V1CardId[] = [
  'seed', 'seed', 'witness', 'anchor', 'signal',
  'echo', 'testimony', 'resonance', 'backflow', 'rewrite',
]

export const CHAPTERS_V1: ChapterDefinition[] = [
  {
    id: 'missing-murder', number: '01', title: '没有发生的谋杀', subtitle: '双线苏醒', target: 24,
    story: '未来的验尸报告记录了一名仍在过去行走的死者。',
    opening: { speaker: '系统', text: '23:57，一份来自明天的死亡报告落入你的终端。死者林默仍活着，批准删除他的人却写着你的名字。' },
    ending: { speaker: '林默', text: '“你在过去救了我，所以我才能从未来把答案送回来。可这份删除命令，为什么会有你的签名？”' },
    pastChoices: [
      {
        id: 'save-inspector', title: '救下监察官', glyph: '救', brief: '让死者活着走进未来', result: '未来出现了一名不应存在的活证人。', bonus: { witnesses: 2 },
        futures: [
          { id: 'living-court', title: '活人法庭', glyph: '庭', brief: '让幸存者当众作证', result: '证言穿过十八次循环回到今夜。', bonus: { echoes: 1, witnesses: 1 }, openingCard: 'testimony', dialogue: { speaker: '林默', text: '“这是我们第一次见面，但你已经在另一个昨天救过我。”' }, battleRule: '开局拥有额外证人；公开证言会更容易得到高分。' },
          { id: 'empty-morgue', title: '空白验尸室', glyph: '空', brief: '调查一具消失的尸体', result: '没有尸体的死亡证明被送回过去。', bonus: { echoes: 2 }, openingCard: 'backflow', dialogue: { speaker: '系统', text: '验尸台上没有尸体，只有一张写着“请把我送回昨天”的标签。' }, battleRule: '开局必定抽到时间回传；用它选择一张过去牌并重放。' },
        ],
      },
      {
        id: 'steal-report', title: '偷走死亡报告', glyph: '盗', brief: '让结果早于谋杀出现', result: '一份来自明天的报告成了今夜的起因。', bonus: { seeds: 2, anchors: 1 },
        futures: [
          { id: 'complete-proof', title: '完整罪证', glyph: '卷', brief: '让未来追溯每一条线索', result: '所有线索被同时点亮。', bonus: { seeds: 1 }, openingCard: 'resonance', dialogue: { speaker: '林默的录音', text: '“如果你听见这句话，说明我没能活到未来。别相信报告上的签名。”' }, battleRule: '开局拥有额外线索；引爆线索会更强。' },
          { id: 'ash-safe', title: '灰烬保险库', glyph: '灰', brief: '从毁掉的未来取回一把钥匙', result: '未来送回的钥匙打开了它被烧毁前的门。', bonus: { echoes: 2, anchors: 1 }, openingCard: 'rewrite', dialogue: { speaker: '系统', text: '保险库已经烧毁，钥匙却比火灾早一天出现在你的手中。' }, battleRule: '未来信息与稳定效果更强，适合改写现场。' },
        ],
      },
    ],
  },
  {
    id: 'reverse-bell', number: '02', title: '逆行钟楼', subtitle: '倒走的城市', target: 34,
    story: '钟声每响一次，未来就会向过去塌缩一分钟。',
    opening: { speaker: '林默', text: '“零点前有四分钟从所有监控里消失了。有人正用钟楼反复修改同一场案件。”' },
    ending: { speaker: '系统', text: '钟楼的修改权限来自你的管理员编号。有人在未来使用着另一个你的身份。' },
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
          { id: 'echo-square', title: '同步广场', glyph: '鸣', brief: '让全城同时听见你的名字', result: '钟声把所有线索串成了一条线。', bonus: { seeds: 2 }, openingCard: 'resonance' },
          { id: 'young-keeper', title: '尚未出生的守钟人', glyph: '子', brief: '请未来的守钟人教你修钟', result: '答案比问题早了二十年回到过去。', bonus: { echoes: 3 }, openingCard: 'backflow' },
        ],
      },
    ],
  },
  {
    id: 'tomorrow-paper', number: '03', title: '明日报社', subtitle: '先有结果', target: 46,
    story: '报纸每天只印明天的结局，却从不记录今天的原因。',
    opening: { speaker: '明日报社', text: '今日头版已经印好：“零号管理员于零点删除整座城市。”报道下方仍然是你的签名。' },
    ending: { speaker: '林默', text: '“也许未来的你不是想杀死谁。也许他认为，只剩删除整条时间线这一条路。”' },
    pastChoices: [
      {
        id: 'print-cause', title: '印下一个原因', glyph: '印', brief: '在头版留下关键线索', result: '未来的所有结局开始追溯这行字。', bonus: { seeds: 4 },
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
    opening: { speaker: '零号管理员', text: '“两条时间线继续共存，城市就会在零点崩塌。我已经失败过十八次，这一次必须删除其中一个我们。”' },
    ending: { speaker: '林默', text: '“过去不是命令，未来也不是答案。它们只是你还可以重新选择的两边。”' },
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
