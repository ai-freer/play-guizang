import Phaser from "phaser";
import { getLevel } from "../game/LevelConfig";
import { loadProgress } from "../game/ProgressStore";
import { queueLevelTileImages } from "../game/TileAssets";

type BootApi = { set(pct?: number, msg?: string): void; hide(): void };

function boot(): BootApi | undefined {
  return (window as unknown as { __boot?: BootApi }).__boot;
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload(): void {
    boot()?.set(18, "加载素材…");
    const queued = queueLevelTileImages(this, getLevel(loadProgress().currentLevel));
    if (queued === 0) {
      boot()?.set(90, "准备就绪");
      return;
    }
    // Phaser progress 0–1 映射到 18–90
    this.load.on("progress", (value: number) => {
      boot()?.set(18 + value * 72, "加载素材…");
    });
    this.load.on("complete", () => {
      boot()?.set(90, "准备就绪");
    });
  }

  create(): void {
    this.scene.start("GameScene");
  }
}
