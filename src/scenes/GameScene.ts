import Phaser from "phaser";
import { Match3Game } from "../game/Match3Game";
import { Position, Tile } from "../game/Board";
import { Hud } from "../ui/Hud";
import { nextLevelId } from "../game/LevelProgress";
import { loadProgress, saveProgress } from "../game/ProgressStore";
import { LevelPicker } from "../ui/LevelPicker";

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

const BOARD_COLORS = [
  0xeecb5a,
  0x66c6e0,
  0xe77cac,
  0x75d67f,
  0xa888df,
  0xe7a35f,
  0x68cfb8,
  0xe48679,
  0xb8da65,
  0x83aee0,
  0xe77f9b,
  0xd8c45f,
];

export class GameScene extends Phaser.Scene {
  private model = new Match3Game();
  private hud = new Hud();
  private levelPicker = new LevelPicker();
  private views = new Map<string, TileView>();
  private selected: Position | null = null;
  private hintPair: { from: Position; to: Position } | null = null;
  private busy = false;

  private readonly cell = 104;
  private readonly gap = 10;
  private readonly boardX = 56;
  private readonly boardY = 50;

  constructor() {
    super("GameScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#f3f8ee");
    this.hud.onContinue = () => {
      const nextLevel = this.model.mode === "won" ? nextLevelId(this.model.level.id) : this.model.level.id;
      this.model.restart(nextLevel);
      this.selected = null;
      this.hintPair = null;
      this.drawBoard();
      this.syncHud();
    };
    this.hud.onRefresh = () => {
      if (this.busy) return;
      const used = this.model.refreshBoard();
      if (!used) return;
      this.selected = null;
      this.hintPair = null;
      this.drawBoard();
      this.syncHud();
      this.showEndStateIfNeeded();
    };
    this.hud.onHint = () => {
      if (this.busy) return;
      this.hintPair = this.model.useHint();
      this.syncHud();
      this.drawBoard();
      this.time.delayedCall(1300, () => {
        this.hintPair = null;
        this.drawBoard();
      });
    };
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

  private addBoardBase(): void {
    const oldBase = this.children.getByName("board-base");
    if (oldBase) oldBase.destroy();

    const width = this.model.board.width * this.cell + (this.model.board.width - 1) * this.gap + 52;
    const height = this.model.board.height * this.cell + (this.model.board.height - 1) * this.gap + 52;
    const base = this.add.graphics();
    base.setName("board-base");
    base.fillStyle(0x123a43, 1);
    base.fillRoundedRect(this.boardX - 26, this.boardY - 26, width, height, 28);
    base.lineStyle(8, 0xff4f73, 1);
    base.strokeRoundedRect(this.boardX - 26, this.boardY - 26, width, height, 28);
    base.lineStyle(4, 0xffe983, 1);
    base.strokeRoundedRect(this.boardX - 16, this.boardY - 16, width - 20, height - 20, 22);
    base.setDepth(-10);
  }

  private createTileView(tile: Tile, pos: Position): void {
    const x = this.toX(pos.col);
    const y = this.toY(pos.row);
    const container = this.add.container(x, y);
    const bg = this.add.graphics();
    const image = this.add.image(this.cell / 2, this.cell / 2, `tile-${tile.type + 1}`);
    const imageSize = this.cell - 16;
    const imageInset = (this.cell - imageSize) / 2;
    const color = BOARD_COLORS[tile.type % BOARD_COLORS.length];
    const maskShape = this.add.graphics({ x, y });

    bg.fillStyle(0x000000, 0.26);
    bg.fillRoundedRect(6, 10, this.cell, this.cell, 20);
    bg.fillStyle(color, 1);
    bg.fillRoundedRect(0, 0, this.cell, this.cell, 22);
    bg.fillStyle(0xffffff, 0.16);
    bg.fillRoundedRect(10, 7, this.cell - 20, 18, 9);

    maskShape.fillStyle(0xffffff, 1);
    maskShape.fillRoundedRect(imageInset, imageInset, imageSize, imageSize, 16);
    maskShape.setVisible(false);

    image.setDisplaySize(imageSize, imageSize);
    image.setPosition(this.cell / 2, this.cell / 2);
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
      layer.lineStyle(7, 0x39dcff, 1);
      layer.strokeRoundedRect(this.toX(this.selected.col) - 6, this.toY(this.selected.row) - 6, this.cell + 12, this.cell + 12, 24);
    }

    if (this.hintPair) {
      for (const pos of [this.hintPair.from, this.hintPair.to]) {
        layer.lineStyle(8, 0xffd447, 1);
        layer.strokeRoundedRect(this.toX(pos.col) - 8, this.toY(pos.row) - 8, this.cell + 16, this.cell + 16, 24);
      }
    }
  }

  private select(pos: Position): void {
    if (this.busy || this.model.mode !== "playing") return;
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
      this.floatText(`+${step.scoreAdded}`, a, step.chain > 1 ? 0xffd447 : 0xff4f73);
      await this.wait(120);
    }
    if (result.steps.length > 1) this.floatText(`连消 x${result.steps.length}`, b, 0xffd447);
    this.drawBoard();
    this.syncHud();
    await this.wait(260);
    this.busy = false;
    this.showEndStateIfNeeded();
  }

  private showEndStateIfNeeded(): void {
    if (this.model.mode === "won") this.hud.showResult("won", this.model.score);
    if (this.model.mode === "lost") this.hud.showResult("lost", this.model.score);
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

  private floatText(text: string, pos: Position, color = 0xff4f73): void {
    const label = this.add.text(this.toX(pos.col) + 40, this.toY(pos.row) - 18, text, {
      fontFamily: "PingFang SC, sans-serif",
      fontSize: "34px",
      fontStyle: "bold",
      color: `#${color.toString(16).padStart(6, "0")}`,
      stroke: "#421622",
      strokeThickness: 5,
    });
    label.setDepth(80);
    this.tweens.add({
      targets: label,
      y: label.y - 48,
      alpha: 0,
      duration: 700,
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
