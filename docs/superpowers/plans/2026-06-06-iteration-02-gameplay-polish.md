# Iteration 02 Gameplay Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把当前 MVP 从“规则能跑”推进到“玩家能顺滑玩完 1-10 关”的第二轮版本。

**Architecture:** 保持现有边界：`Match3Game`/`Board` 拥有规则状态，`GameScene` 只负责 Phaser 渲染、动画和输入适配，`Hud` 负责 DOM UI。新增能力优先通过小模块扩展，不把关卡、道具、动画状态混进单个大函数。

**Tech Stack:** Phaser 3, TypeScript, Vite, DOM/CSS HUD, browser cookie progress, Chrome DevTools/Playwright validation.

---

## Current Context

项目目录：`/Users/danielpan/AI_Workspace/projects/消消藏师傅`

当前已完成：
- `npm run build` 通过。
- 25 张表情素材已裁切到 `public/assets/tiles/`。
- `window.render_game_to_text()` 已可返回状态。
- `window.__xxcs_trySwap()` 可验证规则，但真实浏览器点击自动化还没有稳定覆盖。
- UI 已能显示棋盘、HUD、道具栏。

本轮不做：
- 账号登录。
- 后端服务。
- 云端存档。
- 排行榜。
- 音频。

## File Structure Map

### Existing Files To Modify

- `src/game/Board.ts`
  - 保持棋盘规则纯逻辑。
  - 可新增测试辅助方法，但不要引入 Phaser。

- `src/game/Match3Game.ts`
  - 新增道具库存、胜败推进、关卡重试/下一关状态。
  - 保持 cookie 写入在模型层完成。

- `src/game/ProgressStore.ts`
  - 如需存道具库存或最高关卡，扩展 cookie schema。
  - 读取失败必须回退默认值。

- `src/scenes/GameScene.ts`
  - 实现真实点击交互修复。
  - 实现交换、消除、下落、补新的可见动画。
  - 继续暴露测试钩子，但不要让 UI 依赖测试钩子。

- `src/ui/Hud.ts`
  - 增加关卡结果弹窗、关卡选择 UI、道具数量更新。
  - 刷新/提示按钮触发后要更新 DOM 状态。

- `src/styles/theme.css`
  - 增加关卡选择、道具禁用态、结果弹窗动效样式。

- `index.html`
  - 增加关卡选择入口容器，尽量少改结构。

- `progress.md`
  - 每个任务完成后追加 PDCA 记录。

### New Files To Create

- `src/game/ToolInventory.ts`
  - 负责道具库存默认值、扣减、序列化。

- `src/game/LevelProgress.ts`
  - 负责关卡解锁和下一关 id 计算。

- `src/game/BoardTestUtils.ts`
  - 仅放测试/验证辅助：查找可用交换、构造可通关局面。

- `src/ui/LevelPicker.ts`
  - 负责 DOM 关卡选择列表渲染。

- `scripts/verify-gameplay.mjs`
  - 使用浏览器自动化验证真实点击、状态变化、cookie 保存。

---

## Task 1: Real Click Validation And Input Mapping

**Files:**
- Modify: `src/scenes/GameScene.ts`
- Create: `src/game/BoardTestUtils.ts`
- Create: `scripts/verify-gameplay.mjs`
- Modify: `package.json`
- Modify: `progress.md`

- [ ] **Step 1: Add board utility for finding a valid move**

Create `src/game/BoardTestUtils.ts`:

```ts
import { Board, Position } from "./Board";

export type ValidMove = {
  from: Position;
  to: Position;
};

export function findValidMove(board: Board): ValidMove | null {
  for (let row = 0; row < board.height; row += 1) {
    for (let col = 0; col < board.width; col += 1) {
      const from = { row, col };
      const candidates = [
        { row, col: col + 1 },
        { row: row + 1, col },
      ];

      for (const to of candidates) {
        if (!board.isInside(to)) continue;
        board.swap(from, to);
        const hasMatch = board.findMatches().length > 0;
        board.swap(from, to);
        if (hasMatch) return { from, to };
      }
    }
  }
  return null;
}
```

- [ ] **Step 2: Use the utility in `Match3Game.collectHint`**

Modify `src/game/Match3Game.ts`:

```ts
import { findValidMove } from "./BoardTestUtils";
```

Replace `collectHint()` with:

```ts
collectHint(): { from: Position; to: Position } | null {
  return findValidMove(this.board);
}
```

- [ ] **Step 3: Add board coordinate metadata to text state**

Modify `toTextState()` in `src/game/Match3Game.ts` so tests can map board cells to pixels:

```ts
board: {
  width: this.board.width,
  height: this.board.height,
  cells: this.board.serialize(),
},
input: {
  cellSize: 104,
  gap: 10,
  boardX: 56,
  boardY: 50,
}
```

Expected: `window.render_game_to_text()` includes `input`.

- [ ] **Step 4: Add a verification script**

Create `scripts/verify-gameplay.mjs`:

```js
import { chromium } from "playwright";

const url = process.env.GAME_URL ?? "http://127.0.0.1:5173/";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 900, height: 1400 } });
const errors = [];

page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
page.on("pageerror", (err) => errors.push(err.message));

await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(500);

const before = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
const move = await page.evaluate(() => {
  const state = JSON.parse(window.render_game_to_text());
  const { width, height, cells } = state.board;
  const idx = (row, col) => row * width + col;
  const findMatches = (board) => {
    const matches = [];
    for (let row = 0; row < height; row += 1) {
      let run = [0];
      for (let col = 1; col <= width; col += 1) {
        if (col < width && board[idx(row, col)] === board[idx(row, col - 1)]) run.push(col);
        else {
          if (run.length >= 3) matches.push(run.map((runCol) => [row, runCol]));
          run = [col];
        }
      }
    }
    for (let col = 0; col < width; col += 1) {
      let run = [0];
      for (let row = 1; row <= height; row += 1) {
        if (row < height && board[idx(row, col)] === board[idx(row - 1, col)]) run.push(row);
        else {
          if (run.length >= 3) matches.push(run.map((runRow) => [runRow, col]));
          run = [row];
        }
      }
    }
    return matches;
  };

  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      for (const to of [{ row, col: col + 1 }, { row: row + 1, col }]) {
        if (to.row >= height || to.col >= width) continue;
        const next = cells.slice();
        [next[idx(row, col)], next[idx(to.row, to.col)]] = [next[idx(to.row, to.col)], next[idx(row, col)]];
        if (findMatches(next).length > 0) return { from: { row, col }, to };
      }
    }
  }
  return null;
});

if (!move) throw new Error("No valid move found");

const canvasBox = await page.locator("canvas").boundingBox();
if (!canvasBox) throw new Error("Canvas not found");

const { input } = before;
const point = (pos) => ({
  x: canvasBox.x + ((input.boardX + pos.col * (input.cellSize + input.gap) + input.cellSize / 2) / 900) * canvasBox.width,
  y: canvasBox.y + ((input.boardY + pos.row * (input.cellSize + input.gap) + input.cellSize / 2) / 900) * canvasBox.height,
});

await page.mouse.click(point(move.from).x, point(move.from).y);
await page.waitForTimeout(120);
await page.mouse.click(point(move.to).x, point(move.to).y);
await page.waitForTimeout(900);

const after = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
await page.screenshot({ path: "output/web-game/verify-real-click.png", fullPage: true });
await browser.close();

if (errors.length > 0) throw new Error(`Console errors: ${errors.join("\\n")}`);
if (after.movesLeft !== before.movesLeft - 1) {
  throw new Error(`Expected movesLeft ${before.movesLeft - 1}, got ${after.movesLeft}`);
}
if (after.score <= before.score) {
  throw new Error(`Expected score to increase from ${before.score}, got ${after.score}`);
}

console.log(JSON.stringify({ ok: true, before: { score: before.score, movesLeft: before.movesLeft }, after: { score: after.score, movesLeft: after.movesLeft }, move }, null, 2));
```

- [ ] **Step 5: Add npm script**

Modify `package.json`:

```json
"verify:gameplay": "node scripts/verify-gameplay.mjs"
```

- [ ] **Step 6: Run validation**

Run:

```bash
npm run build
```

Expected: `tsc && vite build` succeeds.

Run with dev server already active:

```bash
npm run verify:gameplay
```

Expected output includes:

```json
{
  "ok": true
}
```

- [ ] **Step 7: Update progress**

Append to `progress.md`:

```markdown
- Check：真实点击验证脚本 `npm run verify:gameplay` 通过，截图保存到 `output/web-game/verify-real-click.png`。
```

---

## Task 2: Visible Swap, Clear, Drop, And Refill Animation

**Files:**
- Modify: `src/scenes/GameScene.ts`
- Modify: `src/game/Match3Game.ts`
- Modify: `src/game/Board.ts`
- Modify: `progress.md`

- [ ] **Step 1: Return drop/fill data from resolution**

Modify `ResolutionStep` in `src/game/Match3Game.ts`:

```ts
export type ResolutionStep = {
  groups: MatchGroup[];
  cleared: Tile[];
  scoreAdded: number;
  chain: number;
  drops: ReturnType<Board["collapseAndFill"]>["drops"];
  fills: ReturnType<Board["collapseAndFill"]>["fills"];
};
```

Modify `resolveBoard()`:

```ts
const movement = this.board.collapseAndFill();
steps.push({ groups, cleared, scoreAdded, chain, drops: movement.drops, fills: movement.fills });
```

Ensure this replaces the existing sequence where `steps.push(...)` happens before `collapseAndFill()`.

- [ ] **Step 2: Add animation helpers in `GameScene`**

Add methods to `src/scenes/GameScene.ts`:

```ts
private tweenTo(view: TileView, pos: Position, duration = 180): Promise<void> {
  return new Promise((resolve) => {
    this.tweens.add({
      targets: view.container,
      x: this.toX(pos.col),
      y: this.toY(pos.row),
      duration,
      ease: "Back.easeOut",
      onComplete: () => resolve(),
    });
  });
}

private fadeAndPop(view: TileView): Promise<void> {
  return new Promise((resolve) => {
    this.tweens.add({
      targets: view.container,
      scale: 1.18,
      alpha: 0,
      duration: 180,
      ease: "Cubic.easeOut",
      onComplete: () => {
        view.container.destroy(true);
        resolve();
      },
    });
  });
}
```

- [ ] **Step 3: Animate accepted swap before resolving final board**

Current `trySwap()` resolves model immediately. Keep rules simple, but in `GameScene.attemptSwap()` animate visual swap first using the current views:

```ts
const aTile = this.model.board.get(a);
const bTile = this.model.board.get(b);
const aView = aTile ? this.views.get(aTile.id) : null;
const bView = bTile ? this.views.get(bTile.id) : null;
if (aView && bView) {
  await Promise.all([this.tweenTo(aView, b), this.tweenTo(bView, a)]);
}
const result = this.model.trySwap(a, b);
```

If `result.accepted === false`, animate both views back.

- [ ] **Step 4: Animate clear and then redraw board**

After `result.accepted === true`, use first step cleared tiles:

```ts
for (const step of result.steps) {
  await Promise.all(step.cleared.map((tile) => {
    const view = this.views.get(tile.id);
    return view ? this.fadeAndPop(view) : Promise.resolve();
  }));
  this.floatText(`+${step.scoreAdded}`, a, step.chain > 1 ? 0xffd447 : 0xff4f73);
  await this.wait(120);
}
this.drawBoard();
```

This is intentionally simple: it shows clear animation before final redraw. More exact drop animation can come after this passes.

- [ ] **Step 5: Validate animation still preserves state**

Run:

```bash
npm run build
npm run verify:gameplay
```

Expected:
- Build passes.
- Verification passes.
- `output/web-game/verify-real-click.png` shows updated score and changed board.

- [ ] **Step 6: Update progress**

Append:

```markdown
- Do：已增加交换、消除 pop、加分飘字动画；当前下落补新仍以终态重绘为主。
```

---

## Task 3: Result Dialog, Level Progression, And Cookie Validation

**Files:**
- Create: `src/game/LevelProgress.ts`
- Modify: `src/game/ProgressStore.ts`
- Modify: `src/game/Match3Game.ts`
- Modify: `src/ui/Hud.ts`
- Modify: `scripts/verify-gameplay.mjs`
- Modify: `progress.md`

- [ ] **Step 1: Add level progression helper**

Create `src/game/LevelProgress.ts`:

```ts
import { levels } from "./LevelConfig";

export function clampLevelId(levelId: number): number {
  const max = levels[levels.length - 1]?.id ?? 1;
  return Math.min(Math.max(1, levelId), max);
}

export function nextLevelId(currentLevel: number): number {
  return clampLevelId(currentLevel + 1);
}

export function isFinalLevel(levelId: number): boolean {
  const max = levels[levels.length - 1]?.id ?? 1;
  return levelId >= max;
}
```

- [ ] **Step 2: Use helper in `Match3Game.persistIfNeeded`**

Modify imports:

```ts
import { nextLevelId } from "./LevelProgress";
```

Modify `persistIfNeeded`:

```ts
const next = nextLevelId(this.level.id);
const highestUnlockedLevel = won ? Math.max(progress.highestUnlockedLevel, next) : progress.highestUnlockedLevel;
saveProgress({
  ...progress,
  currentLevel: won ? next : this.level.id,
  highestUnlockedLevel,
  lastScore: this.score,
});
```

- [ ] **Step 3: Add forced win test hook**

Modify `GameScene.create()`:

```ts
window.__xxcs_forceWin = () => {
  for (const target of this.model.level.targets) {
    if (target.kind === "collect") target.current = target.count;
  }
  this.model.score = Math.max(this.model.score, 9999);
  this.model.mode = "won";
  this.syncHud();
  this.hud.showResult("won", this.model.score);
  return this.model.toTextState();
};
```

Also extend the `Window` declaration:

```ts
__xxcs_forceWin?: () => string;
```

- [ ] **Step 4: Extend verification script for cookie progress**

Add this block to `scripts/verify-gameplay.mjs` after the real-click assertion:

```js
await page.evaluate(() => window.__xxcs_forceWin());
await page.locator("#result-action").click();
await page.waitForTimeout(500);
const progressed = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
if (progressed.level !== before.level + 1) {
  throw new Error(`Expected next level ${before.level + 1}, got ${progressed.level}`);
}
const cookie = await page.context().cookies(url);
if (!cookie.some((item) => item.name === "xxcs_progress")) {
  throw new Error("Expected xxcs_progress cookie to be written");
}
```

- [ ] **Step 5: Validate**

Run:

```bash
npm run build
npm run verify:gameplay
```

Expected:
- Build passes.
- Script verifies level progression and cookie exists.

- [ ] **Step 6: Update progress**

Append:

```markdown
- Check：胜利弹窗、下一关推进和 `xxcs_progress` cookie 写入通过自动化验证。
```

---

## Task 4: Tool Inventory And Button State

**Files:**
- Create: `src/game/ToolInventory.ts`
- Modify: `src/game/Match3Game.ts`
- Modify: `src/ui/Hud.ts`
- Modify: `src/styles/theme.css`
- Modify: `progress.md`

- [ ] **Step 1: Add tool inventory model**

Create `src/game/ToolInventory.ts`:

```ts
export type ToolKind = "swap" | "bomb" | "refresh" | "hint";

export type ToolInventory = Record<ToolKind, number>;

export function defaultTools(): ToolInventory {
  return {
    swap: 4,
    bomb: 3,
    refresh: 2,
    hint: 1,
  };
}

export function consumeTool(inventory: ToolInventory, kind: ToolKind): boolean {
  if (inventory[kind] <= 0) return false;
  inventory[kind] -= 1;
  return true;
}
```

- [ ] **Step 2: Add inventory to `Match3Game`**

Modify `Match3Game`:

```ts
import { consumeTool, defaultTools, ToolInventory } from "./ToolInventory";
```

Add property:

```ts
tools: ToolInventory = defaultTools();
```

Modify `refreshBoard()`:

```ts
refreshBoard(): boolean {
  if (this.mode !== "playing" || this.movesLeft <= 0) return false;
  if (!consumeTool(this.tools, "refresh")) return false;
  this.movesLeft -= 1;
  this.board.reshuffle();
  if (this.movesLeft <= 0 && !this.isWon()) this.mode = "lost";
  return true;
}
```

Add:

```ts
useHint(): { from: Position; to: Position } | null {
  if (!consumeTool(this.tools, "hint")) return null;
  return this.collectHint();
}
```

Extend `toTextState()`:

```ts
tools: this.tools
```

- [ ] **Step 3: Update HUD interface**

Modify `HudSnapshot`:

```ts
tools: Record<"swap" | "bomb" | "refresh" | "hint", number>;
```

In `Hud.update()`, call:

```ts
this.updateTools(snapshot.tools);
```

Add:

```ts
private updateTools(tools: HudSnapshot["tools"]): void {
  const map = [
    ["#tool-swap", tools.swap],
    ["#tool-bomb", tools.bomb],
    ["#tool-refresh", tools.refresh],
    ["#tool-hint", tools.hint],
  ] as const;

  for (const [selector, count] of map) {
    const button = document.querySelector<HTMLButtonElement>(selector);
    const badge = button?.querySelector<HTMLElement>(".tool-badge");
    if (!button || !badge) continue;
    badge.textContent = String(count);
    button.disabled = count <= 0;
    button.classList.toggle("disabled", count <= 0);
  }
}
```

- [ ] **Step 4: Wire HUD snapshot in `GameScene.syncHud`**

Modify:

```ts
this.hud.update({
  level: this.model.level,
  score: this.model.score,
  movesLeft: this.model.movesLeft,
  tools: this.model.tools,
});
```

Modify hint callback:

```ts
this.hintPair = this.model.useHint();
this.syncHud();
```

Modify refresh callback:

```ts
const used = this.model.refreshBoard();
if (!used) return;
```

- [ ] **Step 5: Add disabled visual state**

Add to `src/styles/theme.css`:

```css
.tool-button:disabled,
.tool-button.disabled {
  cursor: not-allowed;
  filter: grayscale(0.85) brightness(0.78);
  opacity: 0.72;
}
```

- [ ] **Step 6: Validate**

Run:

```bash
npm run build
```

Open browser, click `提示`, expected:
- `提示` badge changes from `1` to `0`.
- Button appears disabled.
- One valid pair is highlighted briefly.

Run:

```bash
npm run verify:gameplay
```

Expected: still passes.

- [ ] **Step 7: Update progress**

Append:

```markdown
- Do：刷新/提示道具已接入库存扣减；HUD 数量和禁用态可见。
```

---

## Task 5: Level Picker UI For 1-10

**Files:**
- Create: `src/ui/LevelPicker.ts`
- Modify: `index.html`
- Modify: `src/ui/Hud.ts`
- Modify: `src/scenes/GameScene.ts`
- Modify: `src/styles/theme.css`
- Modify: `progress.md`

- [ ] **Step 1: Add DOM container**

Modify `index.html`, inside `#game-shell` after HUD:

```html
<section class="level-picker" id="level-picker" aria-label="关卡选择"></section>
```

- [ ] **Step 2: Create level picker**

Create `src/ui/LevelPicker.ts`:

```ts
import { levels } from "../game/LevelConfig";

export type LevelPickerSnapshot = {
  currentLevel: number;
  highestUnlockedLevel: number;
};

export class LevelPicker {
  private root = document.querySelector<HTMLElement>("#level-picker");
  onSelect?: (levelId: number) => void;

  render(snapshot: LevelPickerSnapshot): void {
    if (!this.root) return;
    this.root.innerHTML = "";

    for (const level of levels) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "level-chip";
      button.textContent = String(level.id);
      button.disabled = level.id > snapshot.highestUnlockedLevel;
      button.classList.toggle("active", level.id === snapshot.currentLevel);
      button.addEventListener("click", () => this.onSelect?.(level.id));
      this.root.append(button);
    }
  }
}
```

- [ ] **Step 3: Add styles**

Add to `src/styles/theme.css`:

```css
.level-picker {
  display: flex;
  gap: 8px;
  margin: 14px 0;
  overflow-x: auto;
  padding-bottom: 4px;
}

.level-chip {
  min-width: 42px;
  height: 42px;
  border: 3px solid #ffe983;
  border-radius: 999px;
  background: #fff5d7;
  color: #223041;
  font-weight: 900;
  cursor: pointer;
  box-shadow: 0 5px 0 #ad6a0a;
}

.level-chip.active {
  background: #ff4f73;
  color: white;
  box-shadow: 0 5px 0 #a8183a;
}

.level-chip:disabled {
  cursor: not-allowed;
  opacity: 0.45;
  filter: grayscale(1);
}
```

- [ ] **Step 4: Wire picker in `GameScene`**

Add imports:

```ts
import { LevelPicker } from "../ui/LevelPicker";
import { loadProgress, saveProgress } from "../game/ProgressStore";
```

Add field:

```ts
private levelPicker = new LevelPicker();
```

In `create()`:

```ts
this.levelPicker.onSelect = (levelId) => {
  const progress = loadProgress();
  if (levelId > progress.highestUnlockedLevel) return;
  saveProgress({ ...progress, currentLevel: levelId });
  this.model.restart(levelId);
  this.selected = null;
  this.hintPair = null;
  this.drawBoard();
  this.syncHud();
};
```

In `syncHud()`:

```ts
const progress = loadProgress();
this.levelPicker.render({
  currentLevel: this.model.level.id,
  highestUnlockedLevel: progress.highestUnlockedLevel,
});
```

- [ ] **Step 5: Validate**

Run:

```bash
npm run build
```

Manual browser checks:
- Page shows chips `1` through `10`.
- Only unlocked levels are clickable.
- Current level chip is pink.
- Clicking unlocked level restarts board at that level.

- [ ] **Step 6: Update progress**

Append:

```markdown
- Do：已增加 1-10 关关卡选择条，未解锁关卡不可点击。
```

---

## Task 6: Full PDCA Checkpoint

**Files:**
- Modify: `progress.md`
- Create/Update: `output/web-game/iteration-02-final.png`

- [ ] **Step 1: Run build**

Run:

```bash
npm run build
```

Expected:
- Exit code `0`.
- Vite chunk warning allowed for Phaser MVP.

- [ ] **Step 2: Run gameplay verification**

Run:

```bash
npm run verify:gameplay
```

Expected:
- Exit code `0`.
- Output includes `"ok": true`.

- [ ] **Step 3: Capture final screenshot**

Use Chrome DevTools or Playwright MCP to save:

```text
output/web-game/iteration-02-final.png
```

Expected screenshot:
- HUD visible.
- Level picker visible.
- Board visible with 25-meme style tiles.
- Tool counts visible and at least one disabled/used state can be demonstrated after interaction.

- [ ] **Step 4: Check console**

Using Chrome DevTools:

```text
list_console_messages(types=["error"])
```

Expected:

```text
<no console messages found>
```

- [ ] **Step 5: Update progress**

Append:

```markdown
- Check：Iteration 02 build and gameplay verification passed.
- Check：Final screenshot saved to `output/web-game/iteration-02-final.png`.
- Act：下一轮建议补更精细的下落路径动画、道具“炸弹/换位”真实功能和音效。
```

---

## Self-Review

Spec coverage:
- 真实点击验证：Task 1。
- 动画加强：Task 2。
- 胜败/关卡切换：Task 3。
- 道具次数：Task 4。
- 1-10 关选择：Task 5。
- PDCA 验收：Task 6。

Placeholder scan:
- 本计划没有使用 `TBD`、`TODO`、`implement later`。
- 每个代码变更任务包含具体路径、代码片段和验证命令。

Type consistency:
- `Position` 来自 `src/game/Board.ts`。
- `ToolKind`/`ToolInventory` 只在 Task 4 引入并使用。
- `LevelPickerSnapshot` 只在 Task 5 引入并使用。

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-06-iteration-02-gameplay-polish.md`.

Two execution options:

1. **Subagent-Driven (recommended)** - 每个任务由新执行上下文处理，任务之间做检查。
2. **Inline Execution** - 在当前会话按任务顺序执行，每个任务后做 build / 截图 / 状态验证。
