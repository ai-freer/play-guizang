import Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload(): void {
    for (let i = 1; i <= 25; i += 1) {
      this.load.image(`tile-${i}`, `/assets/tiles/tile-${String(i).padStart(2, "0")}.png`);
    }
  }

  create(): void {
    this.scene.start("GameScene");
  }
}
