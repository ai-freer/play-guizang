# 消消藏师傅 — 糖果消消乐质感 UI 优化 spec

## 目标

把当前 UI 从「奶油色 + 鲜艳分块」推到 Royal Match 调性的高级糖果消消乐质感：深色舞台、金色框架、宝石化分数块、tile 像浮在凹槽里的 3D 糖块。保留全部游戏逻辑、meme 头像和现有横屏/竖屏布局结构。

## 视觉系统 token

```
--stage-deep      #0a1b3a   舞台底色
--stage-mid       #16285a   舞台中段
--stage-glow      #2b3f8a   舞台高光
--gold            #f5c542   金色主色
--gold-deep       #b8810f   金色阴影
--gold-light      #fff1a8   金色高光
--gem-pink        #ff3d6e   宝石粉（步数）
--gem-pink-dark   #a8123c
--gem-cyan        #38d2ff   宝石青（分数）
--gem-cyan-dark   #0a5b88
--cream           #fff5d7
--ink-deep        #1a0c2e   深色文字
--radius-shell    32px
--radius-card     22px
--radius-pill     999px
--shadow-stack    0 14px 0 var(--gold-deep), 0 22px 40px rgba(0,0,0,0.35)
```

字体保留 PingFang SC，但标题加 webkit-text-stroke 烫金描边。

## 各组件改造

**外壳 #game-shell**
- 背景：径向暗角 `radial-gradient` + 深紫蓝渐变 + 高光散斑（伪元素，绝对定位）
- 边框：金色三层（外亮金 / 中深金 / 内亮金）
- 顶部加 1 道 sheen 高光（白色 6% linear-gradient）

**HUD（标题 + 分数 + 步数）**
- 整体改为「皇冠绶带」造型：金底斜切 + 顶部 ribbon 尾巴（::before/::after）
- 标题"消消藏师傅"：深紫色文字 + 金色描边 + 投影
- 关卡 pill：金底深紫文字
- 分数卡：cyan 宝石卡（顶部白高光 + 底部深色阴影 + 圆角 22px）
- 步数 orb：粉色宝石球，保留圆形 + inset 高光 + drop shadow

**关卡条**
- 每个 chip 改为「金币」造型：金渐变圆 + 内阴影 + 内白边
- 当前关卡：粉宝石填充 + 金外圈
- 锁定关卡：灰金 + 锁图（::before 用 unicode 锁符号）

**目标条（收集 0/6）**
- 卡片底改成深色玻璃（rgba(10,27,58,0.85) + 1px 内白光 + 金边）
- 头像金边框 + 阴影
- 进度条：金底 + cyan 宝石填充 + 顶部白色高光

**道具栏**
- 标题改成金色 ribbon 带
- 4 个按钮改成水晶按钮：
  - 上半部：彩色玻璃顶（保留各自配色）+ inner white sheen
  - 下半部：白色平台 + 道具名圆角胶囊
  - 选中态：金光呼吸 outline + 微浮起
  - 角标：金圆 + 白描边

**结果弹窗**
- 弹窗卡片：深色玻璃 + 金外框 + 顶部 sheen
- 标题改金色描边
- 按钮改宝石粉

## Phaser canvas 棋盘改造

**棋盘外框（addBoardBase）**
- 背景从 `#123a43` 改成深蓝大理石：
  - 底层 `#0a1b3a` 实心圆角矩形
  - 上层径向 `#2b3f8a` 50% alpha 散斑（4-6 个）
  - 内嵌 4px 暗影 + 2px 金高光
- 外圈从粉 + 金双层改成「金 + 深金 + 金」三层（更厚重）

**每个 tile slot（每格凹槽）**
- 在 tile 浮起之前，画一个底色凹槽：
  - 圆角矩形 `rgba(0,0,0,0.35)` 内阴影感
  - 不再用 12 色 BOARD_COLORS 给每个 tile 染不同背景
- meme 头像盖在凹槽上方，向上偏移 4px 表现「糖块浮起」

**tile 3D 浮感**
- bg 改成：
  - 底部投影 6px（不变）
  - 主体改为「单一统一的奶白底 + 顶部白色 sheen」
  - 边框改细金（1.5px）替代彩色 8px 边
  - meme 头像填到 cell-12 大小
- 这样 meme 表情自己就是主色，不再被边框噪声压住

**选中态**
- 当前淡 cyan 7px stroke → 改为：
  - 金色双层 stroke（外 9px + 内 4px）
  - 加 glow（用一个稍大的半透明金色矩形垫底）

**提示态**
- 金色 pulse → 保留但加 scale 呼吸 tween

**floatText 加分飘字**
- 字体改成 `36px 黑体`，金色填充 + 深紫描边
- 连消文字改金色 + 深紫描边

## 横屏/竖屏布局

不动 grid-template-areas，只改各组件视觉。验证两种布局都不会破。

## 落地阶段

1. 写 spec（本文件）
2. 改 `src/styles/theme.css`：全套 CSS token + 组件改造
3. 改 `src/scenes/GameScene.ts`：`addBoardBase`、`createTileView`、`drawSelection`、`floatText`
4. 改 `src/main.ts`：canvas backgroundColor 改深色
5. 起 dev server，chrome-devtools 截横屏 + 竖屏对比

## 不在范围

- 不改游戏逻辑（Match3Game / Board / LevelConfig 全部不动）
- 不改 tile 资源（meme 头像不变）
- 不加新音效/粒子（保留作为后续）
- 不改 HTML 结构（只调样式 + canvas 绘制）

## 验证

- `npm run build` 通过
- chrome-devtools 截图：桌面横屏 1440×900 + 移动竖屏 414×896
- 第 1 关默认视图，看头像清晰 + 整体质感统一
