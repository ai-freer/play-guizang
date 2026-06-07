import Phaser from "phaser";
import { Match3Game } from "../game/Match3Game";
import { Position, Tile } from "../game/Board";
import { Hud } from "../ui/Hud";
import { nextLevelId } from "../game/LevelProgress";
import { loadProgress, saveProgress } from "../game/ProgressStore";
import { LevelPicker } from "../ui/LevelPicker";
import { getLevel } from "../game/LevelConfig";
import { loadLevelTileImages, tileTextureKey } from "../game/TileAssets";

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => void;
    __xxcs_trySwap?: (from: Position, to: Position) => string;
    __xxcs_forceWin?: () => string;
  }
}

type TileView = {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  image: Phaser.GameObjects.Image;
  maskShape: Phaser.GameObjects.Graphics;
  pos: Position;
};

const PALETTE = {
  stageDeep: 0x0a1535,
  stageMid: 0x16245a,
  stageHi: 0x2a3f8a,
  stageGlow: 0x4b6dd6,
  gold: 0xf5c542,
  goldLight: 0xfff1a8,
  goldDeep: 0xb8810f,
  goldDark: 0x7a560a,
  cream: 0xfff5d7,
  slotDark: 0x05102c,
  pink: 0xff3d6e,
  inkDeep: 0x1a0c2e,
};

// 12 种糖果色，每个 tile type 一个，在深底上仍能彼此区分
// light: 顶部高光 / mid: 主体 / dark: 底部暗边
const TILE_COLORS: ReadonlyArray<{ light: number; mid: number; dark: number }> = [
  { light: 0xffd4a0, mid: 0xffa050, dark: 0xb05a10 }, // 1 橙
  { light: 0xa8e6ff, mid: 0x5cc2ee, dark: 0x1573a5 }, // 2 青
  { light: 0xffc0d8, mid: 0xff7aa8, dark: 0xb83a72 }, // 3 粉
  { light: 0xc4eec0, mid: 0x82d680, dark: 0x2f8a3a }, // 4 草绿
  { light: 0xd6c4ff, mid: 0xa888df, dark: 0x5a3da7 }, // 5 紫
  { light: 0xffdc8c, mid: 0xebbe44, dark: 0x916608 }, // 6 金
  { light: 0xb4ecdc, mid: 0x68cfb8, dark: 0x1f8068 }, // 7 薄荷
  { light: 0xffc8b0, mid: 0xe48679, dark: 0x9c2d22 }, // 8 珊瑚
  { light: 0xe2eea4, mid: 0xb8da65, dark: 0x6c801c }, // 9 嫩黄绿
  { light: 0xb8d2f5, mid: 0x83aee0, dark: 0x224d8c }, // 10 天蓝
  { light: 0xffc2d0, mid: 0xe77f9b, dark: 0xa42c4c }, // 11 玫瑰
  { light: 0xf0e498, mid: 0xd8c45f, dark: 0x806810 }, // 12 鹅黄
];

export class GameScene extends Phaser.Scene {
  private model = new Match3Game();
  private hud = new Hud();
  private levelPicker = new LevelPicker();
  private views = new Map<string, TileView>();
  private selected: Position | null = null;
  private hintPair: { from: Position; to: Position } | null = null;
  private busy = false;
  private activeTool: "swap" | "bomb" | null = null;

  private readonly cell = 104;
  private readonly gap = 10;
  private readonly boardX = 56;
  private readonly boardY = 50;

  constructor() {
    super("GameScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#0a1535");
    this.drawStageBackdrop();
    this.hud.onContinue = () => {
      const nextLevel = this.model.mode === "won" ? nextLevelId(this.model.level.id) : this.model.level.id;
      void this.switchToLevel(nextLevel);
    };
    this.hud.onTool = (kind) => {
      if (this.busy) return;
      if (kind === "refresh") {
        const used = this.model.refreshBoard();
        if (!used) return;
        this.clearToolMode();
        this.selected = null;
        this.hintPair = null;
        this.drawBoard();
        this.syncHud();
        this.showEndStateIfNeeded();
        return;
      }
      if (kind === "hint") {
        this.hintPair = this.model.useHint();
        this.clearToolMode();
        this.syncHud();
        this.drawBoard();
        this.time.delayedCall(1300, () => {
          this.hintPair = null;
          this.drawBoard();
        });
        return;
      }
      // swap / bomb：切换工具模式
      if (this.model.tools[kind] <= 0) return;
      this.activeTool = this.activeTool === kind ? null : kind;
      this.selected = null;
      this.hintPair = null;
      this.hud.setActiveTool(this.activeTool);
      this.drawSelection();
    };
    this.levelPicker.onSelect = (levelId) => {
      const progress = loadProgress();
      if (levelId > progress.highestUnlockedLevel) return;
      void this.switchToLevel(levelId);
    };

    window.render_game_to_text = () => this.model.toTextState();
    window.advanceTime = (_ms: number) => {
      this.drawSelection();
    };
    window.__xxcs_trySwap = (from: Position, to: Position) => {
      const result = this.model.trySwap(from, to);
      this.selected = null;
      this.hintPair = null;
      this.drawBoard();
      this.syncHud();
      this.showEndStateIfNeeded();
      return JSON.stringify(result);
    };
    window.__xxcs_forceWin = () => {
      this.busy = false;
      this.selected = null;
      this.hintPair = null;
      this.clearToolMode();
      for (const target of this.model.level.targets) {
        if (target.kind === "collect") target.current = target.count;
      }
      this.model.score = Math.max(this.model.score, 9999);
      this.model.mode = "won";
      const progress = loadProgress();
      const nextLevel = nextLevelId(this.model.level.id);
      saveProgress({
        ...progress,
        currentLevel: nextLevel,
        highestUnlockedLevel: Math.max(progress.highestUnlockedLevel, nextLevel),
        lastScore: this.model.score,
      });
      this.syncHud();
      this.hud.showResult("won", this.model.score);
      return this.model.toTextState();
    };

    this.game.canvas.addEventListener("pointerdown", (event) => {
      const pos = this.positionFromCanvasEvent(event);
      if (pos) this.select(pos);
    });

    this.drawBoard();
    this.syncHud();

    // 首帧画完再隐藏 loader，避免 loader 消失瞬间棋盘还没出现的空窗
    const bootApi = (window as unknown as { __boot?: { set(p?: number, m?: string): void; hide(): void } }).__boot;
    if (bootApi) {
      bootApi.set(100, "开始游戏");
      this.time.delayedCall(180, () => bootApi.hide());
    }
  }

  private syncHud(): void {
    this.hud.update({
      level: this.model.level,
      score: this.model.score,
      movesLeft: this.model.movesLeft,
      tools: this.model.tools,
    });
    const progress = loadProgress();
    this.levelPicker.render({
      currentLevel: this.model.level.id,
      highestUnlockedLevel: progress.highestUnlockedLevel,
    });
  }

  private drawBoard(): void {
    for (const view of this.views.values()) {
      view.container.destroy(true);
      view.maskShape.destroy();
    }
    this.views.clear();

    this.addBoardBase();
    for (let row = 0; row < this.model.board.height; row += 1) {
      for (let col = 0; col < this.model.board.width; col += 1) {
        const tile = this.model.board.get({ row, col });
        if (!tile) continue;
        this.createTileView(tile, { row, col });
      }
    }
    this.drawSelection();
  }

  private drawStageBackdrop(): void {
    const old = this.children.getByName("stage-backdrop");
    if (old) old.destroy();

    const g = this.add.graphics();
    g.setName("stage-backdrop");
    g.setDepth(-30);

    g.fillStyle(PALETTE.stageDeep, 1);
    g.fillRect(0, 0, 900, 900);

    const specks: Array<[number, number, number, number]> = [
      [120, 140, 180, 0.28],
      [720, 100, 140, 0.22],
      [180, 720, 220, 0.18],
      [760, 760, 160, 0.22],
      [450, 450, 280, 0.16],
      [300, 250, 100, 0.2],
      [600, 580, 130, 0.18],
    ];
    for (const [x, y, r, a] of specks) {
      g.fillStyle(PALETTE.stageGlow, a);
      g.fillCircle(x, y, r);
    }

    g.fillStyle(0xffffff, 0.04);
    for (let i = 0; i < 60; i += 1) {
      const x = (i * 137) % 900;
      const y = (i * 211) % 900;
      g.fillCircle(x, y, 1.2);
    }
  }

  private addBoardBase(): void {
    const oldBase = this.children.getByName("board-base");
    if (oldBase) oldBase.destroy();
    const oldSlots = this.children.getByName("board-slots");
    if (oldSlots) oldSlots.destroy();

    const pad = 24;
    const width = this.model.board.width * this.cell + (this.model.board.width - 1) * this.gap + pad * 2;
    const height = this.model.board.height * this.cell + (this.model.board.height - 1) * this.gap + pad * 2;
    const baseX = this.boardX - pad;
    const baseY = this.boardY - pad;

    const base = this.add.graphics();
    base.setName("board-base");
    base.setDepth(-15);

    base.fillStyle(0x000000, 0.45);
    base.fillRoundedRect(baseX + 4, baseY + 8, width, height, 26);

    base.fillStyle(PALETTE.stageDeep, 1);
    base.fillRoundedRect(baseX, baseY, width, height, 26);

    const glowSpecks: Array<[number, number, number, number]> = [
      [baseX + width * 0.22, baseY + height * 0.18, 120, 0.2],
      [baseX + width * 0.78, baseY + height * 0.22, 100, 0.18],
      [baseX + width * 0.16, baseY + height * 0.82, 110, 0.18],
      [baseX + width * 0.84, baseY + height * 0.78, 130, 0.22],
      [baseX + width * 0.5, baseY + height * 0.5, 220, 0.14],
    ];
    for (const [x, y, r, a] of glowSpecks) {
      base.fillStyle(PALETTE.stageHi, a);
      base.fillCircle(x, y, r);
    }

    base.lineStyle(6, PALETTE.gold, 1);
    base.strokeRoundedRect(baseX, baseY, width, height, 26);
    base.lineStyle(2.5, PALETTE.goldDark, 0.9);
    base.strokeRoundedRect(baseX + 4, baseY + 4, width - 8, height - 8, 22);
    base.lineStyle(1.5, PALETTE.goldLight, 0.85);
    base.strokeRoundedRect(baseX + 7, baseY + 7, width - 14, height - 14, 19);

    const slots = this.add.graphics();
    slots.setName("board-slots");
    slots.setDepth(-12);
    for (let row = 0; row < this.model.board.height; row += 1) {
      for (let col = 0; col < this.model.board.width; col += 1) {
        const x = this.toX(col);
        const y = this.toY(row);
        slots.fillStyle(0x000000, 0.55);
        slots.fillRoundedRect(x - 2, y - 1, this.cell + 4, this.cell + 4, 20);
        slots.fillStyle(PALETTE.slotDark, 1);
        slots.fillRoundedRect(x, y, this.cell, this.cell, 18);
        slots.lineStyle(1.2, 0x1a2a5e, 0.9);
        slots.strokeRoundedRect(x + 0.5, y + 0.5, this.cell - 1, this.cell - 1, 18);
      }
    }
  }

  private createTileView(tile: Tile, pos: Position): void {
    const x = this.toX(pos.col);
    const y = this.toY(pos.row);
    const container = this.add.container(x, y);
    const bg = this.add.graphics();
    const c = TILE_COLORS[tile.type % TILE_COLORS.length];
    const image = this.add.image(this.cell / 2, this.cell / 2 - 2, tileTextureKey(tile.type));
    const imageSize = this.cell - 22;
    const imageInset = (this.cell - imageSize) / 2;
    const maskShape = this.add.graphics({ x, y: y - 2 });

    // 凹槽阴影：让 tile 像"坐"在格子里
    bg.fillStyle(0x000000, 0.45);
    bg.fillRoundedRect(2, 7, this.cell - 4, this.cell - 4, 18);

    // 糖果三层渐变：底部暗 -> 中部主色 -> 顶部高光
    bg.fillStyle(c.dark, 1);
    bg.fillRoundedRect(0, 0, this.cell, this.cell - 2, 18);
    bg.fillStyle(c.mid, 1);
    bg.fillRoundedRect(0, 0, this.cell, this.cell - 8, 18);
    bg.fillStyle(c.light, 1);
    bg.fillRoundedRect(0, 0, this.cell, Math.floor(this.cell * 0.5), 18);

    // 顶部白色 sheen 高光
    bg.fillStyle(0xffffff, 0.42);
    bg.fillRoundedRect(8, 5, this.cell - 16, 11, 5);
    bg.fillStyle(0xffffff, 0.16);
    bg.fillRoundedRect(8, 16, this.cell - 16, 4, 2);

    // 外圈深色描边强化糖果轮廓
    bg.lineStyle(2, c.dark, 0.95);
    bg.strokeRoundedRect(1, 1, this.cell - 2, this.cell - 4, 17);
    bg.lineStyle(1.2, c.light, 0.6);
    bg.strokeRoundedRect(2.5, 2.5, this.cell - 5, this.cell - 8, 16);

    maskShape.fillStyle(0xffffff, 1);
    maskShape.fillRoundedRect(imageInset, imageInset, imageSize, imageSize, 12);
    maskShape.setVisible(false);

    image.setDisplaySize(imageSize, imageSize);
    image.setPosition(this.cell / 2, this.cell / 2 - 2);
    image.setMask(maskShape.createGeometryMask());

    container.add([bg, image]);
    container.setSize(this.cell, this.cell);
    this.views.set(tile.id, { container, bg, image, maskShape, pos });
  }

  private drawSelection(): void {
    const old = this.children.getByName("selection-layer");
    if (old) old.destroy();

    const layer = this.add.graphics();
    layer.setName("selection-layer");
    layer.setDepth(50);

    if (this.selected) {
      const x = this.toX(this.selected.col);
      const y = this.toY(this.selected.row);
      const tint = this.activeTool === "swap" ? PALETTE.pink : PALETTE.gold;
      layer.fillStyle(PALETTE.goldLight, 0.22);
      layer.fillRoundedRect(x - 10, y - 10, this.cell + 20, this.cell + 20, 26);
      layer.lineStyle(7, tint, 1);
      layer.strokeRoundedRect(x - 5, y - 5, this.cell + 10, this.cell + 10, 22);
      layer.lineStyle(2.5, PALETTE.goldLight, 1);
      layer.strokeRoundedRect(x - 1.5, y - 1.5, this.cell + 3, this.cell + 3, 20);
    }

    if (this.hintPair) {
      for (const pos of [this.hintPair.from, this.hintPair.to]) {
        const x = this.toX(pos.col);
        const y = this.toY(pos.row);
        layer.fillStyle(PALETTE.gold, 0.18);
        layer.fillRoundedRect(x - 12, y - 12, this.cell + 24, this.cell + 24, 28);
        layer.lineStyle(8, PALETTE.gold, 1);
        layer.strokeRoundedRect(x - 7, y - 7, this.cell + 14, this.cell + 14, 24);
        layer.lineStyle(3, PALETTE.cream, 1);
        layer.strokeRoundedRect(x - 2, y - 2, this.cell + 4, this.cell + 4, 21);
      }
    }

    this.syncToolBanner();
  }

  private syncToolBanner(): void {
    const el = document.querySelector<HTMLElement>("#tool-banner");
    if (!el) return;
    if (!this.activeTool) {
      el.classList.add("hidden");
      return;
    }
    el.textContent = this.activeTool === "swap"
      ? (this.selected ? "再点一个完成换位" : "换位：选择 2 个格子")
      : "炸弹：点击格子（3x3 爆破）";
    el.classList.remove("hidden");
    el.dataset.tool = this.activeTool;
  }

  private select(pos: Position): void {
    if (this.busy || this.model.mode !== "playing") return;

    if (this.activeTool === "bomb") {
      void this.executeBomb(pos);
      return;
    }

    if (this.activeTool === "swap") {
      if (!this.selected) {
        this.selected = pos;
        this.drawSelection();
        return;
      }
      if (this.selected.row === pos.row && this.selected.col === pos.col) {
        this.selected = null;
        this.drawSelection();
        return;
      }
      void this.executeToolSwap(this.selected, pos);
      return;
    }

    if (!this.selected) {
      this.selected = pos;
      this.drawSelection();
      return;
    }
    if (this.selected.row === pos.row && this.selected.col === pos.col) {
      this.selected = null;
      this.drawSelection();
      return;
    }
    if (!this.model.board.areAdjacent(this.selected, pos)) {
      this.selected = pos;
      this.drawSelection();
      return;
    }
    void this.attemptSwap(this.selected, pos);
  }

  private clearToolMode(): void {
    this.activeTool = null;
    this.hud.setActiveTool(null);
    this.syncToolBanner();
  }

  private async executeToolSwap(a: Position, b: Position): Promise<void> {
    this.busy = true;
    this.selected = null;
    this.drawSelection();

    const aTile = this.model.board.get(a);
    const bTile = this.model.board.get(b);
    const aView = aTile ? this.views.get(aTile.id) : null;
    const bView = bTile ? this.views.get(bTile.id) : null;
    if (aView && bView) {
      await Promise.all([this.tweenTo(aView, b), this.tweenTo(bView, a)]);
    }

    const result = this.model.useSwap(a, b);
    this.clearToolMode();
    if (!result.accepted) {
      this.busy = false;
      this.syncHud();
      return;
    }

    // 无消除：显式提示道具已扣，避免用户疑惑"按了没反应"
    if (result.steps.length === 0) {
      this.floatText("换位 -1", { row: Math.min(a.row, b.row), col: Math.floor((a.col + b.col) / 2) }, PALETTE.gold);
      this.drawBoard();
      this.syncHud();
      await this.wait(360);
      this.busy = false;
      this.showEndStateIfNeeded();
      return;
    }

    for (const step of result.steps) {
      await Promise.all(
        step.cleared.map((tile) => {
          const view = this.views.get(tile.id);
          return view ? this.fadeAndPop(view) : Promise.resolve();
        }),
      );
      if (step.scoreAdded > 0) {
        this.floatText(`+${step.scoreAdded}`, a, step.chain > 1 ? PALETTE.goldLight : PALETTE.pink);
      }
      await this.wait(120);
    }
    if (result.steps.length > 1) this.floatText(`连消 x${result.steps.length}`, b, PALETTE.goldLight);
    this.drawBoard();
    this.syncHud();
    await this.wait(260);
    this.busy = false;
    this.showEndStateIfNeeded();
  }

  private async executeBomb(center: Position): Promise<void> {
    this.busy = true;
    this.selected = null;
    this.drawSelection();

    // 收集 3x3 范围内的 view，做爆炸动效
    const blastViews: TileView[] = [];
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        const tile = this.model.board.get({ row: center.row + dr, col: center.col + dc });
        if (!tile) continue;
        const view = this.views.get(tile.id);
        if (view) blastViews.push(view);
      }
    }
    this.drawBombFlash(center);

    const result = this.model.useBomb(center);
    this.clearToolMode();
    if (!result.accepted) {
      this.busy = false;
      this.syncHud();
      return;
    }

    await Promise.all(blastViews.map((v) => this.fadeAndPop(v)));
    if (result.steps.length > 0 && result.steps[0].scoreAdded > 0) {
      this.floatText(`+${result.steps[0].scoreAdded}`, center, PALETTE.goldLight);
    }
    await this.wait(120);

    for (let i = 1; i < result.steps.length; i += 1) {
      const step = result.steps[i];
      await Promise.all(
        step.cleared.map((tile) => {
          const view = this.views.get(tile.id);
          return view ? this.fadeAndPop(view) : Promise.resolve();
        }),
      );
      if (step.scoreAdded > 0) this.floatText(`+${step.scoreAdded}`, center, PALETTE.goldLight);
      await this.wait(120);
    }
    if (result.steps.length > 1) this.floatText(`连消 x${result.steps.length}`, center, PALETTE.goldLight);
    this.drawBoard();
    this.syncHud();
    await this.wait(260);
    this.busy = false;
    this.showEndStateIfNeeded();
  }

  private drawBombFlash(center: Position): void {
    const flash = this.add.graphics();
    flash.setDepth(70);
    const cx = this.toX(center.col) + this.cell / 2;
    const cy = this.toY(center.row) + this.cell / 2;
    const r = this.cell * 1.6;
    flash.fillStyle(0xffd54a, 0.85);
    flash.fillCircle(cx, cy, r * 0.4);
    flash.fillStyle(0xff7a2a, 0.55);
    flash.fillCircle(cx, cy, r * 0.7);
    flash.fillStyle(0xff3d6e, 0.35);
    flash.fillCircle(cx, cy, r);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.25,
      duration: 360,
      ease: "Cubic.easeOut",
      onComplete: () => flash.destroy(),
    });
  }

  private async attemptSwap(a: Position, b: Position): Promise<void> {
    this.busy = true;
    this.selected = null;
    this.hintPair = null;
    this.drawSelection();

    const aTile = this.model.board.get(a);
    const bTile = this.model.board.get(b);
    const aView = aTile ? this.views.get(aTile.id) : null;
    const bView = bTile ? this.views.get(bTile.id) : null;
    if (aView && bView) {
      await Promise.all([this.tweenTo(aView, b), this.tweenTo(bView, a)]);
    }

    const result = this.model.trySwap(a, b);
    if (!result.accepted) {
      if (aView && bView) {
        await Promise.all([this.tweenTo(aView, a, 120), this.tweenTo(bView, b, 120)]);
      }
      this.shakePair(a, b);
      this.busy = false;
      return;
    }

    for (const step of result.steps) {
      await Promise.all(
        step.cleared.map((tile) => {
          const view = this.views.get(tile.id);
          return view ? this.fadeAndPop(view) : Promise.resolve();
        }),
      );
      this.floatText(`+${step.scoreAdded}`, a, step.chain > 1 ? PALETTE.goldLight : PALETTE.pink);
      await this.wait(120);
    }
    if (result.steps.length > 1) this.floatText(`连消 x${result.steps.length}`, b, PALETTE.goldLight);
    this.drawBoard();
    this.syncHud();
    await this.wait(260);
    this.busy = false;
    this.showEndStateIfNeeded();
  }

  private showEndStateIfNeeded(): void {
    if (this.model.mode === "won" || this.model.mode === "lost") {
      this.clearToolMode();
    }
    if (this.model.mode === "won") this.hud.showResult("won", this.model.score);
    if (this.model.mode === "lost") this.hud.showResult("lost", this.model.score);
  }

  private async switchToLevel(levelId: number): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    await loadLevelTileImages(this, getLevel(levelId));
    this.model.restart(levelId);
    this.selected = null;
    this.hintPair = null;
    this.clearToolMode();
    this.drawBoard();
    this.syncHud();
    this.busy = false;
  }

  private shakePair(a: Position, b: Position): void {
    for (const pos of [a, b]) {
      const tile = this.model.board.get(pos);
      if (!tile) continue;
      const view = this.views.get(tile.id);
      if (!view) continue;
      this.tweens.add({
        targets: view.container,
        x: view.container.x + 8,
        yoyo: true,
        repeat: 3,
        duration: 40,
      });
    }
  }

  private floatText(text: string, pos: Position, color = PALETTE.goldLight): void {
    const label = this.add.text(this.toX(pos.col) + 40, this.toY(pos.row) - 18, text, {
      fontFamily: "PingFang SC, sans-serif",
      fontSize: "38px",
      fontStyle: "bold",
      color: `#${color.toString(16).padStart(6, "0")}`,
      stroke: "#1a0c2e",
      strokeThickness: 6,
      shadow: { offsetX: 0, offsetY: 4, color: "#000000", blur: 6, fill: true },
    });
    label.setDepth(80);
    label.setScale(0.6);
    this.tweens.add({
      targets: label,
      scale: 1,
      duration: 180,
      ease: "Back.easeOut",
    });
    this.tweens.add({
      targets: label,
      y: label.y - 56,
      alpha: 0,
      duration: 800,
      delay: 80,
      ease: "Cubic.easeOut",
      onComplete: () => label.destroy(),
    });
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }

  private tweenTo(view: TileView, pos: Position, duration = 180): Promise<void> {
    return new Promise((resolve) => {
      this.tweens.add({
        targets: [view.container, view.maskShape],
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
          view.maskShape.destroy();
          resolve();
        },
      });
    });
  }

  private positionFromCanvasEvent(event: PointerEvent): Position | null {
    const rect = this.game.canvas.getBoundingClientRect();
    const worldX = ((event.clientX - rect.left) / rect.width) * 900;
    const worldY = ((event.clientY - rect.top) / rect.height) * 900;
    const stride = this.cell + this.gap;
    const col = Math.floor((worldX - this.boardX) / stride);
    const row = Math.floor((worldY - this.boardY) / stride);
    const localX = worldX - this.boardX - col * stride;
    const localY = worldY - this.boardY - row * stride;
    const pos = { row, col };
    if (!this.model.board.isInside(pos)) return null;
    if (localX < 0 || localY < 0 || localX > this.cell || localY > this.cell) return null;
    return pos;
  }

  private toX(col: number): number {
    return this.boardX + col * (this.cell + this.gap);
  }

  private toY(row: number): number {
    return this.boardY + row * (this.cell + this.gap);
  }
}
