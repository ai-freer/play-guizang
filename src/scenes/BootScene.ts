import Phaser from "phaser";
import { getLevel } from "../game/LevelConfig";
import { loadProgress } from "../game/ProgressStore";
import { queueLevelTileImages } from "../game/TileAssets";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload(): void {
    queueLevelTileImages(this, getLevel(loadProgress().currentLevel));
  }

  create(): void {
    this.scene.start("GameScene");
  }
}
