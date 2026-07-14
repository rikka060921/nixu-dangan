# 逆序档案

一款围绕“过去 / 现在 / 未来”因果编排展开的卡牌肉鸽。玩家不是削减敌人生命，而是在固定灾难发生前安排人物行动、证据、锚点与时间改写，建立足够的真相。

## 开发命令

```bash
pnpm install
pnpm dev
pnpm test
pnpm typecheck
pnpm build
pnpm simulate 1000
```

旧的完整闭环原型保留在 `nixu-dangan-demo/nixu-dangan-demo_9.html`。正式工程从根目录 `src/` 开始演进。

详细路线见 [开发计划](docs/DEVELOPMENT_PLAN.md)。

`pnpm simulate <局数>` 使用固定种子启发式代理批量跑完整三幕，输出胜率、章节到达率、死亡原因、楼层分布与终局资源，用于数值回归而不是替代真人试玩。
