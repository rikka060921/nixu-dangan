# 逆序档案

一款围绕“过去 / 现在 / 未来”因果编排展开的卡牌肉鸽。玩家不是削减敌人生命，而是在固定灾难发生前安排人物行动、证据、锚点与时间改写，建立足够的真相。

当前 `0.1.0-rc.1` 包含十八层三幕战役、20 张可独立升级的卡牌、11 件遗物、18 个战斗案件、6 个异常事件、线索驱动终局，以及 V2 至 V5 的存档迁移与损坏恢复。

## 在线游玩

[打开《逆序档案》在线版](https://rikka060921.github.io/nixu-dangan/)。存档保存在当前浏览器本地。

## 下载游玩

从 GitHub Releases 下载文件名以 `-offline.zip` 结尾的版本，解压后双击 `Reverse-Archive.html` 即可离线游玩，不需要安装 Node.js。存档保存在打开游戏的浏览器本地。

## 开发命令

```bash
pnpm install
pnpm dev
pnpm test
pnpm typecheck
pnpm build
pnpm build:pages
pnpm package:offline
pnpm simulate 1000
pnpm simulate 1000 balanced
pnpm simulate 1000 balanced paradox
```

旧的完整闭环原型保留在 `nixu-dangan-demo/nixu-dangan-demo_9.html`。正式工程从根目录 `src/` 开始演进。

详细路线见 [开发计划](docs/DEVELOPMENT_PLAN.md)。

当前发布状态、平衡指标与限制见 [开发状态](docs/STATUS.md)，发布验收项见 [发布检查](docs/RELEASE_CHECKLIST.md)。

`pnpm simulate <局数> [combat|balanced] [standard|paradox|zero]` 可选择全战斗或策略代理与三种挑战模式。两类代理都会输出胜率、章节到达率、死亡原因、楼层分布与终局资源，用于数值回归而不是替代真人试玩。
