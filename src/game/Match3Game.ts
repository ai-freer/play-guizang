import { Board, MatchGroup, Position, Tile } from "./Board";
import { findValidMove } from "./BoardTestUtils";
import { CollectTarget, getLevel, LevelConfig } from "./LevelConfig";
import { nextLevelId } from "./LevelProgress";
import { loadProgress, saveProgress } from "./ProgressStore";
import { scoreForClear } from "./Scoring";
import { consumeTool, defaultTools, ToolInventory } from "./ToolInventory";

export type GameMode = "playing" | "animating" | "won" | "lost";

export type ResolutionStep = {
  groups: MatchGroup[];
  cleared: Tile[];
  scoreAdded: number;
  chain: number;
  drops: ReturnType<Board["collapseAndFill"]>["drops"];
  fills: ReturnType<Board["collapseAndFill"]>["fills"];
};

export type MoveResult =
  | { accepted: false; reason: "not-adjacent" | "no-match" | "busy" }
  | { accepted: true; steps: ResolutionStep[]; won: boolean; lost: boolean };

export class Match3Game {
  level: LevelConfig;
  board: Board;
  score = 0;
  movesLeft = 0;
  mode: GameMode = "playing";
  tools: ToolInventory = defaultTools();

  constructor(levelId = loadProgress().currentLevel) {
    this.level = getLevel(levelId);
    this.board = new Board(this.level.boardSize.width, this.level.boardSize.height, this.level.tileTypes);
    this.movesLeft = this.level.moveLimit;
  }

  restart(levelId = this.level.id): void {
    this.level = getLevel(levelId);
    this.board = new Board(this.level.boardSize.width, this.level.boardSize.height, this.level.tileTypes);
    this.score = 0;
    this.movesLeft = this.level.moveLimit;
    this.mode = "playing";
    this.tools = defaultTools();
    const progress = loadProgress();
    saveProgress({ ...progress, currentLevel: levelId, lastScore: 0 });
  }

  trySwap(a: Position, b: Position): MoveResult {
    if (this.mode !== "playing") return { accepted: false, reason: "busy" };
    if (!this.board.areAdjacent(a, b)) return { accepted: false, reason: "not-adjacent" };

    this.board.swap(a, b);
    if (this.board.findMatches().length === 0) {
      this.board.swap(a, b);
      return { accepted: false, reason: "no-match" };
    }

    this.movesLeft = Math.max(0, this.movesLeft - 1);
    const steps = this.resolveBoard();
    const won = this.isWon();
    const lost = !won && this.movesLeft <= 0;
    this.mode = won ? "won" : lost ? "lost" : "playing";
    this.persistIfNeeded(won);
    if (!this.board.hasAnyAvailableMove() && this.mode === "playing") {
      this.board.reshuffle();
    }
    return { accepted: true, steps, won, lost };
  }

  refreshBoard(): boolean {
    if (this.mode !== "playing" || this.movesLeft <= 0) return false;
    if (!consumeTool(this.tools, "refresh")) return false;
    this.movesLeft -= 1;
    this.board.reshuffle();
    if (this.movesLeft <= 0 && !this.isWon()) this.mode = "lost";
    return true;
  }

  useSwap(a: Position, b: Position): MoveResult {
    if (this.mode !== "playing") return { accepted: false, reason: "busy" };
    if (a.row === b.row && a.col === b.col) return { accepted: false, reason: "not-adjacent" };
    if (this.tools.swap <= 0) return { accepted: false, reason: "no-match" };
    consumeTool(this.tools, "swap");
    this.board.swap(a, b);
    const steps = this.resolveBoard();
    const won = this.isWon();
    const lost = !won && this.movesLeft <= 0;
    this.mode = won ? "won" : lost ? "lost" : "playing";
    this.persistIfNeeded(won);
    if (!this.board.hasAnyAvailableMove() && this.mode === "playing") this.board.reshuffle();
    return { accepted: true, steps, won, lost };
  }

  useBomb(center: Position): MoveResult {
    if (this.mode !== "playing") return { accepted: false, reason: "busy" };
    if (this.tools.bomb <= 0) return { accepted: false, reason: "no-match" };
    if (!this.board.isInside(center)) return { accepted: false, reason: "not-adjacent" };
    consumeTool(this.tools, "bomb");

    const cleared: Tile[] = [];
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        const pos = { row: center.row + dr, col: center.col + dc };
        const tile = this.board.get(pos);
        if (!tile) continue;
        cleared.push(tile);
        this.board.set(pos, null);
      }
    }
    const bombScore = scoreForClear(cleared.length, 2);
    this.score += bombScore;
    this.updateTargets(cleared);
    const movement = this.board.collapseAndFill();
    const bombStep: ResolutionStep = {
      groups: [{ positions: [center], type: 0 }],
      cleared,
      scoreAdded: bombScore,
      chain: 1,
      drops: movement.drops,
      fills: movement.fills,
    };
    const cascade = this.resolveBoard();
    const steps = [bombStep, ...cascade];
    const won = this.isWon();
    const lost = !won && this.movesLeft <= 0;
    this.mode = won ? "won" : lost ? "lost" : "playing";
    this.persistIfNeeded(won);
    if (!this.board.hasAnyAvailableMove() && this.mode === "playing") this.board.reshuffle();
    return { accepted: true, steps, won, lost };
  }

  collectHint(): { from: Position; to: Position } | null {
    return findValidMove(this.board);
  }

  useHint(): { from: Position; to: Position } | null {
    if (!consumeTool(this.tools, "hint")) return null;
    return this.collectHint();
  }

  toTextState(): string {
    return JSON.stringify({
      coordinateSystem: "board origin at top-left; row increases downward; col increases rightward",
      mode: this.mode,
      level: this.level.id,
      score: this.score,
      movesLeft: this.movesLeft,
      targets: this.level.targets,
      board: {
        width: this.board.width,
        height: this.board.height,
        cells: this.board.serialize(),
      },
      tools: this.tools,
      input: {
        cellSize: 104,
        gap: 10,
        boardX: 56,
        boardY: 50,
      },
    });
  }

  private resolveBoard(): ResolutionStep[] {
    const steps: ResolutionStep[] = [];
    let chain = 1;
    while (true) {
      const groups = this.board.findMatches();
      if (groups.length === 0) break;
      const cleared = this.board.clearMatches(groups);
      const scoreAdded = scoreForClear(cleared.length, chain);
      this.score += scoreAdded;
      this.updateTargets(cleared);
      const movement = this.board.collapseAndFill();
      steps.push({ groups, cleared, scoreAdded, chain, drops: movement.drops, fills: movement.fills });
      chain += 1;
      if (chain > 12) break;
    }
    return steps;
  }

  private updateTargets(cleared: Tile[]): void {
    for (const target of this.level.targets) {
      if (target.kind !== "collect") continue;
      const count = cleared.filter((tile) => tile.type === target.type).length;
      target.current = Math.min(target.count, target.current + count);
    }
  }

  private isWon(): boolean {
    return this.level.targets.every((target) => {
      if (target.kind === "score") return this.score >= target.score;
      return (target as CollectTarget).current >= target.count;
    });
  }

  private persistIfNeeded(won: boolean): void {
    const progress = loadProgress();
    const next = nextLevelId(this.level.id);
    const highestUnlockedLevel = won
      ? Math.max(progress.highestUnlockedLevel, next)
      : progress.highestUnlockedLevel;
    saveProgress({
      ...progress,
      currentLevel: won ? next : this.level.id,
      highestUnlockedLevel,
      lastScore: this.score,
    });
  }
}
