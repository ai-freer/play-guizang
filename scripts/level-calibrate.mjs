// 自动校准器:在忠实移植的引擎上,逐关搜索 (目标缩放, 步数微调),
// 使通关率落入 [75,90] 并贴近"平滑递增"的目标曲线。

let nextId = 1;
const makeTile = (type) => ({ id: `t${nextId++}`, type });
class Board {
  constructor(w, h, types) { this.width = w; this.height = h; this.tileTypes = types; this.cells = Array.from({ length: w * h }, () => null); this.fillInitial(); }
  index(p) { return p.row * this.width + p.col; }
  isInside(p) { return p.row >= 0 && p.row < this.height && p.col >= 0 && p.col < this.width; }
  get(p) { return this.isInside(p) ? this.cells[this.index(p)] : null; }
  set(p, t) { if (this.isInside(p)) this.cells[this.index(p)] = t; }
  swap(a, b) { const at = this.get(a), bt = this.get(b); this.set(a, bt); this.set(b, at); }
  findMatches() {
    const g = [];
    for (let row = 0; row < this.height; row++) { let run = [], rt = null; for (let col = 0; col < this.width; col++) { const t = this.get({ row, col }); if (t && t.type === rt) run.push({ row, col }); else { if (rt !== null && run.length >= 3) g.push({ positions: run, type: rt }); run = t ? [{ row, col }] : []; rt = t ? t.type : null; } } if (rt !== null && run.length >= 3) g.push({ positions: run, type: rt }); }
    for (let col = 0; col < this.width; col++) { let run = [], rt = null; for (let row = 0; row < this.height; row++) { const t = this.get({ row, col }); if (t && t.type === rt) run.push({ row, col }); else { if (rt !== null && run.length >= 3) g.push({ positions: run, type: rt }); run = t ? [{ row, col }] : []; rt = t ? t.type : null; } } if (rt !== null && run.length >= 3) g.push({ positions: run, type: rt }); }
    return g;
  }
  clearMatches(groups) { const cleared = [], seen = new Set(); for (const gr of groups) for (const p of gr.positions) { const t = this.get(p); if (!t || seen.has(t.id)) continue; seen.add(t.id); cleared.push(t); this.set(p, null); } return cleared; }
  collapseAndFill() { for (let col = 0; col < this.width; col++) { const surv = []; for (let row = this.height - 1; row >= 0; row--) { const t = this.get({ row, col }); if (t) surv.push(t); } for (let row = 0; row < this.height; row++) this.set({ row, col }, null); let w = this.height - 1; for (const t of surv) { this.set({ row: w, col }, t); w--; } while (w >= 0) { this.set({ row: w, col }, makeTile(this.randomType())); w--; } } }
  hasAnyAvailableMove() { for (let row = 0; row < this.height; row++) for (let col = 0; col < this.width; col++) for (const n of [{ row, col: col + 1 }, { row: row + 1, col }]) { if (!this.isInside(n)) continue; this.swap({ row, col }, n); const h = this.findMatches().length > 0; this.swap({ row, col }, n); if (h) return true; } return false; }
  reshuffle() { const types = this.cells.map((t) => (t ? t.type : this.randomType())); for (let a = 0; a < 80; a++) { const sh = [...types].sort(() => Math.random() - 0.5); this.cells = sh.map((ty) => makeTile(ty)); if (this.findMatches().length === 0 && this.hasAnyAvailableMove()) return; } this.fillInitial(); }
  fillInitial() { for (let a = 0; a < 80; a++) { for (let row = 0; row < this.height; row++) for (let col = 0; col < this.width; col++) this.set({ row, col }, makeTile(this.pickSafeType(row, col))); if (this.findMatches().length === 0 && this.hasAnyAvailableMove()) return; } }
  pickSafeType(row, col) { const opts = [...this.tileTypes].sort(() => Math.random() - 0.5); for (const type of opts) { const l1 = this.get({ row, col: col - 1 }), l2 = this.get({ row, col: col - 2 }), u1 = this.get({ row: row - 1, col }), u2 = this.get({ row: row - 2, col }); if (!(l1?.type === type && l2?.type === type) && !(u1?.type === type && u2?.type === type)) return type; } return this.randomType(); }
  randomType() { return this.tileTypes[Math.floor(Math.random() * this.tileTypes.length)]; }
  clone() { const b = Object.create(Board.prototype); b.width = this.width; b.height = this.height; b.tileTypes = this.tileTypes; b.cells = this.cells.map((t) => (t ? { id: t.id, type: t.type } : null)); return b; }
}
const scoreForClear = (n, chain) => Math.round(n * 60 * (1 + Math.max(0, chain - 1) * 0.5));
function resolve(board) { let chain = 1, score = 0; const byType = {}; while (true) { const g = board.findMatches(); if (g.length === 0) break; const c = board.clearMatches(g); score += scoreForClear(c.length, chain); for (const t of c) byType[t.type] = (byType[t.type] || 0) + 1; board.collapseAndFill(); chain++; if (chain > 12) break; } return { score, byType }; }
function candidates(board) { const l = []; for (let row = 0; row < board.height; row++) for (let col = 0; col < board.width; col++) for (const n of [{ row, col: col + 1 }, { row: row + 1, col }]) { if (board.isInside(n)) l.push([{ row, col }, n]); } return l; }
function pickMove(board, targets) {
  const ct = new Set(targets.filter(t => t.kind === "collect").map(t => t.type));
  let best = null, bv = -1, bt = -1;
  for (const [a, b] of candidates(board)) { const c = board.clone(); c.swap(a, b); const g = c.findMatches(); if (g.length === 0) continue; const cl = c.clearMatches(g); let hits = 0; for (const t of cl) if (ct.has(t.type)) hits++; const tot = cl.length; const val = ct.size > 0 ? hits : tot; if (val > bv || (val === bv && tot > bt)) { bv = val; bt = tot; best = [a, b]; } }
  return best;
}
function playOnce(L) {
  const board = new Board(L.w, L.h, L.types); let score = 0, movesLeft = L.moves; const collected = {};
  for (const t of L.targets) if (t.kind === "collect") collected[t.type] = 0;
  const counts = {}; for (const t of L.targets) if (t.kind === "collect") counts[t.type] = t.count;
  const won = () => L.targets.every(t => t.kind === "score" ? score >= t.score : (collected[t.type] || 0) >= t.count);
  while (movesLeft > 0 && !won()) {
    let mv = pickMove(board, L.targets);
    if (!mv) { board.reshuffle(); mv = pickMove(board, L.targets); if (!mv) break; }
    board.swap(mv[0], mv[1]); const r = resolve(board); score += r.score;
    for (const ty in r.byType) if (ty in collected) collected[ty] = Math.min(counts[ty], collected[ty] + r.byType[ty]);
    movesLeft--; if (!board.hasAnyAvailableMove()) board.reshuffle();
  }
  return won();
}
function winRate(L, trials) { let w = 0; for (let i = 0; i < trials; i++) if (playOnce(L)) w++; return 100 * w / trials; }

// ---- 基础关卡(已把缺失类型改成棋盘上真实存在的类型)----
const BASE = [
  { id: 1, w: 7, h: 7, types: [0,1,2,3,4], moves: 22, targets: [{ kind: "collect", type: 0, count: 6 }] },
  { id: 2, w: 7, h: 7, types: [0,1,2,3,4,7], moves: 20, targets: [{ kind: "collect", type: 7, count: 7 }] },
  { id: 3, w: 7, h: 7, types: [0,1,2,3,4,5], moves: 20, targets: [{ kind: "collect", type: 0, count: 5 }, { kind: "collect", type: 4, count: 5 }] },
  { id: 4, w: 7, h: 7, types: [0,1,2,3,4,5,6], moves: 19, targets: [{ kind: "score", score: 8000 }] },
  { id: 5, w: 7, h: 7, types: [0,1,2,3,4,5,6,7,15,16], moves: 18, targets: [{ kind: "collect", type: 15, count: 6 }, { kind: "collect", type: 16, count: 6 }] },
  { id: 6, w: 7, h: 7, types: [0,1,2,3,4,5,6,7,8], moves: 18, targets: [{ kind: "collect", type: 6, count: 8 }, { kind: "score", score: 10000 }] },
  { id: 7, w: 7, h: 7, types: [0,1,2,3,4,5,6,7,8], moves: 17, targets: [{ kind: "collect", type: 8, count: 7 }, { kind: "collect", type: 6, count: 7 }] }, // #9 -> #6
  { id: 8, w: 7, h: 7, types: [0,1,2,3,4,5,6,7,8,9], moves: 18, targets: [{ kind: "collect", type: 2, count: 5 }, { kind: "collect", type: 7, count: 5 }, { kind: "collect", type: 5, count: 5 }] }, // #15 -> #5
  { id: 9, w: 7, h: 7, types: [0,1,2,3,4,5,6,7,8,9,10], moves: 17, targets: [{ kind: "collect", type: 7, count: 8 }, { kind: "score", score: 14000 }] },
  { id: 10, w: 7, h: 7, types: [0,1,2,3,4,5,6,7,8,9,10,11], moves: 16, targets: [{ kind: "collect", type: 0, count: 8 }, { kind: "collect", type: 6, count: 8 }] }, // #15 -> #6
];

const scaleTargets = (base, mult) => base.targets.map(t =>
  t.kind === "score" ? { ...t, score: Math.max(500, Math.round(t.score * mult / 100) * 100) }
                     : { ...t, count: Math.max(3, Math.round(t.count * mult)) });

const SEARCH_TRIALS = 220, FINAL_TRIALS = 1000;
const desired = (i) => 90 - (i) * (90 - 76) / 9; // i=0..9 -> 90..76

console.log("# 自动校准 (搜索目标缩放 + 步数微调)\n");
const chosen = [];
for (let idx = 0; idx < BASE.length; idx++) {
  const base = BASE[idx];
  const want = desired(idx);
  const scales = [1.6,1.45,1.3,1.2,1.1,1.0,0.92,0.84,0.76,0.68,0.6,0.52,0.45,0.38,0.32,0.26];
  const deltas = [0, 1, 2, -1, 3, -2, 4];
  let bestCand = null;
  for (const d of deltas) {
    for (const s of scales) {
      const cfg = { ...base, moves: Math.max(10, base.moves + d), targets: scaleTargets(base, s) };
      const rate = winRate(cfg, SEARCH_TRIALS);
      const inBand = rate >= 75 && rate <= 90;
      const cand = { cfg, rate, d, s, inBand, dist: Math.abs(rate - want), ad: Math.abs(d), as: Math.abs(s - 1) };
      if (!bestCand) { bestCand = cand; continue; }
      // 优先 in-band;再按到目标曲线距离;再步数改动最小;再缩放最接近1
      const better =
        (cand.inBand !== bestCand.inBand) ? cand.inBand :
        (Math.abs(cand.dist - bestCand.dist) > 3) ? cand.dist < bestCand.dist :
        (cand.ad !== bestCand.ad) ? cand.ad < bestCand.ad :
        cand.as < bestCand.as;
      if (better) bestCand = cand;
    }
  }
  // 终评
  const finalRate = winRate(bestCand.cfg, FINAL_TRIALS);
  chosen.push({ ...bestCand, finalRate });
  const t = bestCand.cfg.targets.map(x => x.kind === "score" ? `分数≥${x.score}` : `收集#${x.type}×${x.count}`).join(" + ");
  console.log(`L${String(base.id).padStart(2)} 目标曲线${want.toFixed(0)}%  ->  [${bestCand.cfg.moves}步] ${t}`);
  console.log(`     Δ步=${bestCand.d} 缩放=${bestCand.s}  终评通关率=${finalRate.toFixed(1)}%\n`);
}

console.log("\n# === 生成 levels 数组(粘贴进 LevelConfig.ts)===\n");
for (const c of chosen) {
  const b = c.cfg;
  const typesStr = b.id >= 8 ? `Array.from({ length: ${b.types.length} }, (_, i) => i)` : `[${b.types.join(", ")}]`;
  const tg = b.targets.map(t => t.kind === "score" ? `{ kind: "score", score: ${t.score} }` : `collect(${t.type}, ${t.count})`).join(", ");
  console.log(`  { id: ${b.id}, boardSize: { width: ${b.w}, height: ${b.h} }, tileTypes: ${typesStr}, moveLimit: ${b.moves}, targets: [${tg}] },`);
}
