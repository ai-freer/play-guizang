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
