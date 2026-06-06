import Phaser from "phaser";
import { levels } from "../game/LevelConfig";

const tileTypesToPreload = Array.from(
  new Set(
    levels.flatMap((level) => [
      ...level.tileTypes,
      ...level.targets.flatMap((target) => (target.kind === "collect" ? [target.type] : [])),
    ]),
  ),
).sort((a, b) => a - b);

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload(): void {
    for (const type of tileTypesToPreload) {
      const assetId = type + 1;
      this.load.image(`tile-${assetId}`, `/assets/tiles/tile-${String(assetId).padStart(2, "0")}.jpg`);
    }
  }

  create(): void {
    this.scene.start("GameScene");
  }
}
