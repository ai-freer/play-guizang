export type CollectTarget = {
  kind: "collect";
  type: number;
  count: number;
  current: number;
};

export type ScoreTarget = {
  kind: "score";
  score: number;
};

export type LevelTarget = CollectTarget | ScoreTarget;

export type LevelConfig = {
  id: number;
  boardSize: { width: number; height: number };
  tileTypes: number[];
  moveLimit: number;
  targets: LevelTarget[];
};

const collect = (type: number, count: number): CollectTarget => ({
  kind: "collect",
  type,
  count,
  current: 0,
});

export const levels: LevelConfig[] = [
  { id: 1, boardSize: { width: 7, height: 7 }, tileTypes: [0, 1, 2, 3, 4], moveLimit: 22, targets: [collect(0, 6)] },
  { id: 2, boardSize: { width: 7, height: 7 }, tileTypes: [0, 1, 2, 3, 4, 7], moveLimit: 20, targets: [collect(7, 7)] },
  { id: 3, boardSize: { width: 7, height: 7 }, tileTypes: [0, 1, 2, 3, 4, 5], moveLimit: 20, targets: [collect(0, 5), collect(4, 5)] },
  { id: 4, boardSize: { width: 7, height: 7 }, tileTypes: [0, 1, 2, 3, 4, 5, 6], moveLimit: 19, targets: [{ kind: "score", score: 8000 }] },
  { id: 5, boardSize: { width: 7, height: 7 }, tileTypes: [0, 1, 2, 3, 4, 5, 6, 7, 15, 16], moveLimit: 18, targets: [collect(15, 6), collect(16, 6)] },
  { id: 6, boardSize: { width: 7, height: 7 }, tileTypes: [0, 1, 2, 3, 4, 5, 6, 7, 8], moveLimit: 18, targets: [collect(6, 8), { kind: "score", score: 10000 }] },
  { id: 7, boardSize: { width: 7, height: 7 }, tileTypes: [0, 1, 2, 3, 4, 5, 6, 7, 8], moveLimit: 17, targets: [collect(8, 7), collect(9, 7)] },
  { id: 8, boardSize: { width: 7, height: 7 }, tileTypes: Array.from({ length: 10 }, (_, i) => i), moveLimit: 18, targets: [collect(2, 5), collect(7, 5), collect(15, 5)] },
  { id: 9, boardSize: { width: 7, height: 7 }, tileTypes: Array.from({ length: 11 }, (_, i) => i), moveLimit: 17, targets: [collect(7, 8), { kind: "score", score: 14000 }] },
  { id: 10, boardSize: { width: 7, height: 7 }, tileTypes: Array.from({ length: 12 }, (_, i) => i), moveLimit: 16, targets: [collect(0, 8), collect(15, 8)] },
];

export function getLevel(id: number): LevelConfig {
  const level = levels.find((item) => item.id === id) ?? levels[0];
  return {
    ...level,
    boardSize: { ...level.boardSize },
    tileTypes: [...level.tileTypes],
    targets: level.targets.map((target) => ({ ...target })),
  };
}
