export type Tile = {
  id: string;
  type: number;
};

export type Position = {
  row: number;
  col: number;
};

export type MatchGroup = {
  positions: Position[];
  type: number;
};

export type DropMove = {
  tile: Tile;
  from: Position;
  to: Position;
};

export type FillMove = {
  tile: Tile;
  fromRow: number;
  to: Position;
};

let nextTileId = 1;

function makeTile(type: number): Tile {
  const id = `tile-${nextTileId}`;
  nextTileId += 1;
  return { id, type };
}

export class Board {
  readonly width: number;
  readonly height: number;
  readonly tileTypes: number[];
  cells: Array<Tile | null>;

  constructor(width: number, height: number, tileTypes: number[]) {
    this.width = width;
    this.height = height;
    this.tileTypes = tileTypes;
    this.cells = Array.from({ length: width * height }, () => null);
    this.fillInitial();
  }

  index(pos: Position): number {
    return pos.row * this.width + pos.col;
  }

  isInside(pos: Position): boolean {
    return pos.row >= 0 && pos.row < this.height && pos.col >= 0 && pos.col < this.width;
  }

  get(pos: Position): Tile | null {
    if (!this.isInside(pos)) return null;
    return this.cells[this.index(pos)];
  }

  set(pos: Position, tile: Tile | null): void {
    if (!this.isInside(pos)) return;
    this.cells[this.index(pos)] = tile;
  }

  areAdjacent(a: Position, b: Position): boolean {
    return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
  }

  swap(a: Position, b: Position): void {
    const aTile = this.get(a);
    const bTile = this.get(b);
    this.set(a, bTile);
    this.set(b, aTile);
  }

  serialize(): Array<number | null> {
    return this.cells.map((tile) => tile?.type ?? null);
  }

  findMatches(): MatchGroup[] {
    const groups: MatchGroup[] = [];

    for (let row = 0; row < this.height; row += 1) {
      let run: Position[] = [];
      let runType: number | null = null;
      for (let col = 0; col < this.width; col += 1) {
        const tile = this.get({ row, col });
        if (tile && tile.type === runType) {
          run.push({ row, col });
        } else {
          if (runType !== null && run.length >= 3) groups.push({ positions: run, type: runType });
          run = tile ? [{ row, col }] : [];
          runType = tile?.type ?? null;
        }
      }
      if (runType !== null && run.length >= 3) groups.push({ positions: run, type: runType });
    }

    for (let col = 0; col < this.width; col += 1) {
      let run: Position[] = [];
      let runType: number | null = null;
      for (let row = 0; row < this.height; row += 1) {
        const tile = this.get({ row, col });
        if (tile && tile.type === runType) {
          run.push({ row, col });
        } else {
          if (runType !== null && run.length >= 3) groups.push({ positions: run, type: runType });
          run = tile ? [{ row, col }] : [];
          runType = tile?.type ?? null;
        }
      }
      if (runType !== null && run.length >= 3) groups.push({ positions: run, type: runType });
    }

    return groups;
  }

  clearMatches(groups: MatchGroup[]): Tile[] {
    const cleared: Tile[] = [];
    const seen = new Set<string>();
    for (const group of groups) {
      for (const pos of group.positions) {
        const tile = this.get(pos);
        if (!tile || seen.has(tile.id)) continue;
        seen.add(tile.id);
        cleared.push(tile);
        this.set(pos, null);
      }
    }
    return cleared;
  }

  collapseAndFill(): { drops: DropMove[]; fills: FillMove[] } {
    const drops: DropMove[] = [];
    const fills: FillMove[] = [];

    for (let col = 0; col < this.width; col += 1) {
      const survivors: Array<{ tile: Tile; row: number }> = [];
      for (let row = this.height - 1; row >= 0; row -= 1) {
        const tile = this.get({ row, col });
        if (tile) survivors.push({ tile, row });
      }

      for (let row = 0; row < this.height; row += 1) {
        this.set({ row, col }, null);
      }

      let writeRow = this.height - 1;
      for (const item of survivors) {
        this.set({ row: writeRow, col }, item.tile);
        if (writeRow !== item.row) {
          drops.push({ tile: item.tile, from: { row: item.row, col }, to: { row: writeRow, col } });
        }
        writeRow -= 1;
      }

      while (writeRow >= 0) {
        const tile = makeTile(this.randomType());
        this.set({ row: writeRow, col }, tile);
        fills.push({ tile, fromRow: writeRow - 2, to: { row: writeRow, col } });
        writeRow -= 1;
      }
    }

    return { drops, fills };
  }

  hasAnyAvailableMove(): boolean {
    for (let row = 0; row < this.height; row += 1) {
      for (let col = 0; col < this.width; col += 1) {
        const pos = { row, col };
        for (const next of [{ row, col: col + 1 }, { row: row + 1, col }]) {
          if (!this.isInside(next)) continue;
          this.swap(pos, next);
          const hasMatch = this.findMatches().length > 0;
          this.swap(pos, next);
          if (hasMatch) return true;
        }
      }
    }
    return false;
  }

  reshuffle(): void {
    const types = this.cells.map((tile) => tile?.type ?? this.randomType());
    for (let attempts = 0; attempts < 80; attempts += 1) {
      const shuffled = [...types].sort(() => Math.random() - 0.5);
      this.cells = shuffled.map((type) => makeTile(type));
      if (this.findMatches().length === 0 && this.hasAnyAvailableMove()) return;
    }
    this.fillInitial();
  }

  private fillInitial(): void {
    for (let attempts = 0; attempts < 80; attempts += 1) {
      for (let row = 0; row < this.height; row += 1) {
        for (let col = 0; col < this.width; col += 1) {
          this.set({ row, col }, makeTile(this.pickSafeType(row, col)));
        }
      }
      if (this.findMatches().length === 0 && this.hasAnyAvailableMove()) return;
    }
  }

  private pickSafeType(row: number, col: number): number {
    const options = [...this.tileTypes].sort(() => Math.random() - 0.5);
    for (const type of options) {
      const left1 = this.get({ row, col: col - 1 });
      const left2 = this.get({ row, col: col - 2 });
      const up1 = this.get({ row: row - 1, col });
      const up2 = this.get({ row: row - 2, col });
      const horizontal = left1?.type === type && left2?.type === type;
      const vertical = up1?.type === type && up2?.type === type;
      if (!horizontal && !vertical) return type;
    }
    return this.randomType();
  }

  private randomType(): number {
    return this.tileTypes[Math.floor(Math.random() * this.tileTypes.length)];
  }
}
