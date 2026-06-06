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

// 关卡难度经无头模拟器逐关校准:每关在"贪心好玩家"策略下通关率约 75-90%
// (前几关颜色少、天然偏易，>90% 作为新手引导)。详见 docs/level-balance.md。
export const levels: LevelConfig[] = [
  { id: 1, boardSize: { width: 7, height: 7 }, tileTypes: [0, 1, 2, 3, 4], moveLimit: 22, targets: [collect(0, 6)] },
  { id: 2, boardSize: { width: 7, height: 7 }, tileTypes: [0, 1, 2, 3, 4, 7], moveLimit: 21, targets: [collect(7, 10)] },
  { id: 3, boardSize: { width: 7, height: 7 }, tileTypes: [0, 1, 2, 3, 4, 5], moveLimit: 19, targets: [collect(0, 7), collect(4, 7)] },
  { id: 4, boardSize: { width: 7, height: 7 }, tileTypes: [0, 1, 2, 3, 4, 5, 6], moveLimit: 19, targets: [{ kind: "score", score: 4200 }] },
  { id: 5, boardSize: { width: 7, height: 7 }, tileTypes: [0, 1, 2, 3, 4, 5, 6, 7, 15, 16], moveLimit: 18, targets: [collect(15, 3), collect(16, 3)] },
  { id: 6, boardSize: { width: 7, height: 7 }, tileTypes: [0, 1, 2, 3, 4, 5, 6, 7, 8], moveLimit: 19, targets: [collect(6, 3), { kind: "score", score: 3800 }] },
  { id: 7, boardSize: { width: 7, height: 7 }, tileTypes: [0, 1, 2, 3, 4, 5, 6, 7, 8], moveLimit: 15, targets: [collect(8, 3), collect(6, 3)] },
  { id: 8, boardSize: { width: 7, height: 7 }, tileTypes: Array.from({ length: 10 }, (_, i) => i), moveLimit: 17, targets: [collect(2, 3), collect(7, 3), collect(5, 3)] },
  { id: 9, boardSize: { width: 7, height: 7 }, tileTypes: Array.from({ length: 11 }, (_, i) => i), moveLimit: 19, targets: [collect(7, 3), { kind: "score", score: 3600 }] },
  { id: 10, boardSize: { width: 7, height: 7 }, tileTypes: Array.from({ length: 12 }, (_, i) => i), moveLimit: 14, targets: [collect(0, 3), collect(6, 3)] },
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
