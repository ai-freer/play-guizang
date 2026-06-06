import type Phaser from "phaser";
import { LevelConfig } from "./LevelConfig";

export function tileTextureKey(type: number): string {
  return `tile-${type + 1}`;
}

export function tileAssetUrl(type: number): string {
  return `/assets/tiles/tile-${String(type + 1).padStart(2, "0")}.jpg`;
}

export function tileTypesForLevel(level: LevelConfig): number[] {
  const types = new Set(level.tileTypes);
  for (const target of level.targets) {
    if (target.kind === "collect") types.add(target.type);
  }
  return [...types].sort((a, b) => a - b);
}

export function queueLevelTileImages(scene: Phaser.Scene, level: LevelConfig): number {
  let queued = 0;
  for (const type of tileTypesForLevel(level)) {
    const key = tileTextureKey(type);
    if (scene.textures.exists(key)) continue;
    scene.load.image(key, tileAssetUrl(type));
    queued += 1;
  }
  return queued;
}

export function loadLevelTileImages(scene: Phaser.Scene, level: LevelConfig): Promise<void> {
  const queued = queueLevelTileImages(scene, level);
  if (queued === 0) return Promise.resolve();

  return new Promise((resolve) => {
    scene.load.once("complete", () => resolve());
    scene.load.start();
  });
}
