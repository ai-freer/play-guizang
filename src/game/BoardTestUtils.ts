import { Board, Position } from "./Board";

export type ValidMove = {
  from: Position;
  to: Position;
};

export function findValidMove(board: Board): ValidMove | null {
  for (let row = 0; row < board.height; row += 1) {
    for (let col = 0; col < board.width; col += 1) {
      const from = { row, col };
      const candidates = [
        { row, col: col + 1 },
        { row: row + 1, col },
      ];

      for (const to of candidates) {
        if (!board.isInside(to)) continue;
        board.swap(from, to);
        const hasMatch = board.findMatches().length > 0;
        board.swap(from, to);
        if (hasMatch) return { from, to };
      }
    }
  }
  return null;
}
