// 自包含模拟器:忠实移植 play-guizang 的 Board / Scoring / resolve 逻辑
// 目的:量化评估每关在"贪心好玩家"策略下的可通关性。

let nextId = 1;
const makeTile = (type) => ({ id: `t${nextId++}`, type });

class Board {
  constructor(width, height, tileTypes) {
    this.width = width; this.height = height; this.tileTypes = tileTypes;
    this.cells = Array.from({ length: width * height }, () => null);
    this.fillInitial();
  }
  index(p) { return p.row * this.width + p.col; }
  isInside(p) { return p.row >= 0 && p.row < this.height && p.col >= 0 && p.col < this.width; }
  get(p) { return this.isInside(p) ? this.cells[this.index(p)] : null; }
  set(p, t) { if (this.isInside(p)) this.cells[this.index(p)] = t; }
  areAdjacent(a, b) { return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1; }
  swap(a, b) { const at = this.get(a), bt = this.get(b); this.set(a, bt); this.set(b, at); }

  findMatches() {
    const groups = [];
    for (let row = 0; row < this.height; row++) {
      let run = [], runType = null;
      for (let col = 0; col < this.width; col++) {
        const t = this.get({ row, col });
        if (t && t.type === runType) run.push({ row, col });
        else { if (runType !== null && run.length >= 3) groups.push({ positions: run, type: runType }); run = t ? [{ row, col }] : []; runType = t ? t.type : null; }
      }
      if (runType !== null && run.length >= 3) groups.push({ positions: run, type: runType });
    }
    for (let col = 0; col < this.width; col++) {
      let run = [], runType = null;
      for (let row = 0; row < this.height; row++) {
        const t = this.get({ row, col });
        if (t && t.type === runType) run.push({ row, col });
        else { if (runType !== null && run.length >= 3) groups.push({ positions: run, type: runType }); run = t ? [{ row, col }] : []; runType = t ? t.type : null; }
      }
      if (runType !== null && run.length >= 3) groups.push({ positions: run, type: runType });
    }
    return groups;
  }
  clearMatches(groups) {
    const cleared = [], seen = new Set();
    for (const g of groups) for (const p of g.positions) {
      const t = this.get(p);
      if (!t || seen.has(t.id)) continue;
      seen.add(t.id); cleared.push(t); this.set(p, null);
    }
    return cleared;
  }
  collapseAndFill() {
    for (let col = 0; col < this.width; col++) {
      const survivors = [];
      for (let row = this.height - 1; row >= 0; row--) { const t = this.get({ row, col }); if (t) survivors.push(t); }
      for (let row = 0; row < this.height; row++) this.set({ row, col }, null);
      let writeRow = this.height - 1;
      for (const t of survivors) { this.set({ row: writeRow, col }, t); writeRow--; }
      while (writeRow >= 0) { this.set({ row: writeRow, col }, makeTile(this.randomType())); writeRow--; }
    }
  }
  hasAnyAvailableMove() {
    for (let row = 0; row < this.height; row++) for (let col = 0; col < this.width; col++) {
      for (const next of [{ row, col: col + 1 }, { row: row + 1, col }]) {
        if (!this.isInside(next)) continue;
        this.swap({ row, col }, next);
        const has = this.findMatches().length > 0;
        this.swap({ row, col }, next);
        if (has) return true;
      }
    }
    return false;
  }
  reshuffle() {
    const types = this.cells.map((t) => (t ? t.type : this.randomType()));
    for (let a = 0; a < 80; a++) {
      const sh = [...types].sort(() => Math.random() - 0.5);
      this.cells = sh.map((ty) => makeTile(ty));
      if (this.findMatches().length === 0 && this.hasAnyAvailableMove()) return;
    }
    this.fillInitial();
  }
  fillInitial() {
    for (let a = 0; a < 80; a++) {
      for (let row = 0; row < this.height; row++) for (let col = 0; col < this.width; col++)
        this.set({ row, col }, makeTile(this.pickSafeType(row, col)));
      if (this.findMatches().length === 0 && this.hasAnyAvailableMove()) return;
    }
  }
  pickSafeType(row, col) {
    const opts = [...this.tileTypes].sort(() => Math.random() - 0.5);
    for (const type of opts) {
      const l1 = this.get({ row, col: col - 1 }), l2 = this.get({ row, col: col - 2 });
      const u1 = this.get({ row: row - 1, col }), u2 = this.get({ row: row - 2, col });
      const h = l1?.type === type && l2?.type === type;
      const v = u1?.type === type && u2?.type === type;
      if (!h && !v) return type;
    }
    return this.randomType();
  }
  randomType() { return this.tileTypes[Math.floor(Math.random() * this.tileTypes.length)]; }
  clone() {
    const b = Object.create(Board.prototype);
    b.width = this.width; b.height = this.height; b.tileTypes = this.tileTypes;
    b.cells = this.cells.map((t) => (t ? { id: t.id, type: t.type } : null));
    return b;
  }
}

const scoreForClear = (n, chain) => Math.round(n * 60 * (1 + Math.max(0, chain - 1) * 0.5));

// resolve 一步交换的全部级联,返回 {score, byType}
function resolve(board) {
  let chain = 1, score = 0; const byType = {};
  while (true) {
    const groups = board.findMatches();
    if (groups.length === 0) break;
    const cleared = board.clearMatches(groups);
    score += scoreForClear(cleared.length, chain);
    for (const t of cleared) byType[t.type] = (byType[t.type] || 0) + 1;
    board.collapseAndFill();
    chain++;
    if (chain > 12) break;
  }
  return { score, byType };
}

// 列出所有相邻候选交换
function candidates(board) {
  const list = [];
  for (let row = 0; row < board.height; row++) for (let col = 0; col < board.width; col++) {
    for (const next of [{ row, col: col + 1 }, { row: row + 1, col }]) {
      if (!board.isInside(next)) continue;
      list.push([{ row, col }, next]);
    }
  }
  return list;
}

// 与 src/game/LevelConfig.ts 保持同步(校准后)
const LEVELS = [
  { id: 1, w: 7, h: 7, types: [0,1,2,3,4], moves: 22, targets: [{ kind: "collect", type: 0, count: 6 }] },
  { id: 2, w: 7, h: 7, types: [0,1,2,3,4,7], moves: 21, targets: [{ kind: "collect", type: 7, count: 10 }] },
  { id: 3, w: 7, h: 7, types: [0,1,2,3,4,5], moves: 19, targets: [{ kind: "collect", type: 0, count: 7 }, { kind: "collect", type: 4, count: 7 }] },
  { id: 4, w: 7, h: 7, types: [0,1,2,3,4,5,6], moves: 19, targets: [{ kind: "score", score: 4200 }] },
  { id: 5, w: 7, h: 7, types: [0,1,2,3,4,5,6,7,15,16], moves: 18, targets: [{ kind: "collect", type: 15, count: 3 }, { kind: "collect", type: 16, count: 3 }] },
  { id: 6, w: 7, h: 7, types: [0,1,2,3,4,5,6,7,8], moves: 19, targets: [{ kind: "collect", type: 6, count: 3 }, { kind: "score", score: 3800 }] },
  { id: 7, w: 7, h: 7, types: [0,1,2,3,4,5,6,7,8], moves: 15, targets: [{ kind: "collect", type: 8, count: 3 }, { kind: "collect", type: 6, count: 3 }] },
  { id: 8, w: 7, h: 7, types: [0,1,2,3,4,5,6,7,8,9], moves: 17, targets: [{ kind: "collect", type: 2, count: 3 }, { kind: "collect", type: 7, count: 3 }, { kind: "collect", type: 5, count: 3 }] },
  { id: 9, w: 7, h: 7, types: [0,1,2,3,4,5,6,7,8,9,10], moves: 19, targets: [{ kind: "collect", type: 7, count: 3 }, { kind: "score", score: 3600 }] },
  { id: 10, w: 7, h: 7, types: [0,1,2,3,4,5,6,7,8,9,10,11], moves: 14, targets: [{ kind: "collect", type: 0, count: 3 }, { kind: "collect", type: 6, count: 3 }] },
];

// 贪心:每步在所有候选交换里,选"即时收益"最大的;
// 收集目标 -> 即时清除中目标类型数量优先,其次总清除数;纯分数 -> 即时清除数。
function pickMove(board, targets) {
  const collectTypes = new Set(targets.filter(t => t.kind === "collect").map(t => t.type));
  let best = null, bestVal = -1, bestTot = -1;
  for (const [a, b] of candidates(board)) {
    const c = board.clone();
    c.swap(a, b);
    const groups = c.findMatches();
    if (groups.length === 0) continue;
    const cleared = c.clearMatches(groups);
    let targetHits = 0;
    for (const t of cleared) if (collectTypes.has(t.type)) targetHits++;
    const tot = cleared.length;
    const val = collectTypes.size > 0 ? targetHits : tot;
    if (val > bestVal || (val === bestVal && tot > bestTot)) { bestVal = val; bestTot = tot; best = [a, b]; }
  }
  return best;
}

function playOnce(L) {
  const board = new Board(L.w, L.h, L.types);
  let score = 0, movesLeft = L.moves;
  const collected = {};
  for (const t of L.targets) if (t.kind === "collect") collected[t.type] = 0;
  const isWon = () => L.targets.every(t => t.kind === "score" ? score >= t.score : (collected[t.type] || 0) >= t.count);

  while (movesLeft > 0 && !isWon()) {
    let mv = pickMove(board, L.targets);
    if (!mv) { board.reshuffle(); mv = pickMove(board, L.targets); if (!mv) break; }
    board.swap(mv[0], mv[1]);            // 已知有匹配
    const r = resolve(board);
    score += r.score;
    for (const ty in r.byType) if (ty in collected) collected[ty] = Math.min(
      L.targets.find(t => t.kind === "collect" && t.type === +ty).count, collected[ty] + r.byType[ty]);
    movesLeft--;
    if (!board.hasAnyAvailableMove()) board.reshuffle();
  }
  return { won: isWon(), score, collected, movesUsed: L.moves - movesLeft };
}

const TRIALS = +(process.argv[2] || 400);
console.log(`# play-guizang 可通关性模拟  (贪心最优单步, ${TRIALS} 次/关)\n`);
for (const L of LEVELS) {
  // 静态检查:收集目标类型是否在棋盘上
  const missing = L.targets.filter(t => t.kind === "collect" && !L.types.includes(t.type)).map(t => t.type);
  let wins = 0, scoreSum = 0, scoreMax = 0; const collSum = {};
  for (const t of L.targets) if (t.kind === "collect") collSum[t.type] = 0;
  for (let i = 0; i < TRIALS; i++) {
    const r = playOnce(L);
    if (r.won) wins++;
    scoreSum += r.score; scoreMax = Math.max(scoreMax, r.score);
    for (const ty in collSum) collSum[ty] += r.collected[ty];
  }
  const tdesc = L.targets.map(t => t.kind === "score" ? `分数≥${t.score}` : `收集#${t.type}×${t.count}`).join(" + ");
  const rate = (100 * wins / TRIALS).toFixed(1);
  let extra = "";
  if (L.targets.some(t => t.kind === "score")) extra += `  均分≈${Math.round(scoreSum / TRIALS)} 峰值${scoreMax}`;
  const collInfo = Object.entries(collSum).map(([ty, s]) => `#${ty}均收≈${(s / TRIALS).toFixed(1)}`).join(" ");
  if (collInfo) extra += `  ${collInfo}`;
  const flag = missing.length ? `  ❌硬伤:目标类型 ${missing.join(",")} 不在棋盘` : (rate < 60 ? "  ⚠️偏难" : "");
  console.log(`L${String(L.id).padStart(2)} [${L.moves}步] ${tdesc}`);
  console.log(`     通关率 ${rate}%${extra}${flag}\n`);
}
