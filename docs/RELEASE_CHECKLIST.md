# 0.1.0-rc.1 发布检查

## 功能

- [x] 标题、路线、战斗、事件、休整、商店、奖励、章节与结局均可进入和退出。
- [x] 三幕必经案件、策略分叉、章节压力与最终 Boss 正常工作。
- [x] 卡牌奖励、升级、删除、商店购买和遗物钩子有状态机守卫。
- [x] 三种挑战模式可通过模拟完整跑局。

## 数据与恢复

- [x] 相同种子与相同决策保持确定性。
- [x] V2/V3/V4/V5 存档加载、迁移和损坏回退有回归测试。
- [x] 存储写入失败不会中断当前游戏。
- [x] 最小牌组与非法内容修复避免不可玩存档。

## 可访问性与响应式

- [x] 键盘快捷键不拦截当前交互控件的 Enter。
- [x] 换屏、休整/商店子视图和弹窗具有焦点管理。
- [x] 弹窗约束焦点，Escape 可退出，背景设为 inert。
- [x] 商店购买按钮包含具体商品名称。
- [x] 375px 竖屏无页面横向溢出；320px 高横屏引导可滚动。
- [x] `prefers-reduced-motion` 会关闭非必要动画。

## 自动化

- [x] `pnpm test`
- [x] `pnpm typecheck`
- [x] `pnpm build`
- [x] `pnpm package:offline`
- [x] 离线 HTML 无外部资源，ZIP 包含使用说明与第三方许可声明。
- [x] `pnpm simulate 2000 combat standard`
- [x] `pnpm simulate 2000 balanced standard`
- [x] `pnpm simulate 1000 balanced paradox`
- [x] `pnpm simulate 2000 balanced zero`
- [x] 浏览器控制台无 warning/error。
