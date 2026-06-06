# 《消消藏师傅》开发实施计划

## PDCA 总体节奏

### Plan

目标：先做一个浏览器可玩的 MVP，而不是只做静态 mockup。

MVP 范围：
- 7x7 三消棋盘。
- 使用 25 宫格 meme 裁切出的全部表情素材。
- 支持相邻交换、匹配检测、消除、下落、补新、连锁。
- 支持关卡目标、分数、步数。
- 支持胜利 / 失败弹窗。
- 使用浏览器 cookie 保存本机进度。
- 不做账号登录、不接后端、不做云端持久化。

技术方向：
- Phaser 3 + TypeScript + Vite。
- Canvas 负责棋盘、动画、粒子。
- DOM/CSS 负责 HUD、道具栏、弹窗。
- 游戏规则状态独立于 Phaser Scene。

### Do

第 1 轮：
- 初始化 Vite/TypeScript/Phaser 项目。
- 从 `references/02-5x5-meme-matrix.png` 裁切 25 张 tile。
- 实现基础资源 manifest。
- 实现棋盘生成，避免初始死局和初始自动三连。

第 2 轮：
- 实现交换、匹配检测、消除、下落、补新。
- 实现基础动画。
- 实现分数、步数和目标扣减。

第 3 轮：
- 实现胜利 / 失败弹窗。
- 实现 cookie 进度：最高关卡、当前关卡、最近分数。
- 实现 1-10 关配置。

第 4 轮：
- 强化 UI：伪 3D 道具按钮、棋子外壳、连消反馈。
- 实现提示、刷新两个首版道具。
- 加入声音和更多动效可放到后续。

### Check

每个可运行阶段检查：
- `npm run build` 不报错。
- 本地 dev server 可打开。
- 棋盘可见，表情素材加载正确。
- `window.render_game_to_text()` 返回当前棋盘、关卡、分数、步数、目标。
- `window.advanceTime(ms)` 可用于自动化测试推进时间。
- 用 Playwright 截图验证 UI 不空白、不遮挡、不文字溢出。

### Act

根据检查结果调整：
- 如果交互不稳定，先修规则状态，不先加视觉。
- 如果视觉不够游戏化，优先改 CSS/Phaser 表现层，不改规则。
- 如果关卡过难，先降低表情种类数或增加步数。
- 如果 cookie 进度异常，优先保证不破坏新玩家默认状态。

## 目录结构

```text
public/
  assets/
    tiles/
src/
  main.ts
  game/
    Board.ts
    LevelConfig.ts
    Match3Game.ts
    ProgressStore.ts
    Rules.ts
    Scoring.ts
  scenes/
    BootScene.ts
    GameScene.ts
  ui/
    Hud.ts
  styles/
    theme.css
docs/
  game-design.md
  implementation-plan.md
references/
  01-9-grid-meme.png
  02-5x5-meme-matrix.png
  03-match3-game-mockup.png
```

## Cookie 存储

Cookie key：
- `xxcs_progress`

数据结构：

```json
{
  "version": 1,
  "highestUnlockedLevel": 1,
  "currentLevel": 1,
  "lastScore": 0,
  "updatedAt": "2026-06-05T00:00:00.000Z"
}
```

策略：
- 只存轻量进度，不存完整棋盘。
- cookie 有效期默认 365 天。
- 读取失败或 JSON 损坏时回退到默认进度。

## 首轮验收标准

- 浏览器打开后直接进入第 1 关。
- 棋盘上出现 meme 表情 tile。
- 点击两个相邻棋子可交换。
- 有效交换会消除并下落补新。
- 无效交换会回弹。
- HUD 显示关卡、分数、步数、目标。
- 过关后解锁下一关并写入 cookie。
- 刷新页面后仍能读取已解锁关卡。
