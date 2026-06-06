import { chromium } from "playwright";

const url = process.env.GAME_URL ?? "http://127.0.0.1:5173/";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 900, height: 1400 } });
const errors = [];

page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
page.on("pageerror", (err) => errors.push(err.message));

await page.goto(url, { waitUntil: "networkidle" });
await page.waitForFunction(() => typeof window.render_game_to_text === "function");
await page.waitForTimeout(500);

const before = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
const move = await page.evaluate(() => {
  const state = JSON.parse(window.render_game_to_text());
  const { width, height, cells } = state.board;
  const idx = (row, col) => row * width + col;
  const findMatches = (board) => {
    const matches = [];
    for (let row = 0; row < height; row += 1) {
      let run = [0];
      for (let col = 1; col <= width; col += 1) {
        if (col < width && board[idx(row, col)] === board[idx(row, col - 1)]) run.push(col);
        else {
          if (run.length >= 3) matches.push(run.map((runCol) => [row, runCol]));
          run = [col];
        }
      }
    }
    for (let col = 0; col < width; col += 1) {
      let run = [0];
      for (let row = 1; row <= height; row += 1) {
        if (row < height && board[idx(row, col)] === board[idx(row - 1, col)]) run.push(row);
        else {
          if (run.length >= 3) matches.push(run.map((runRow) => [runRow, col]));
          run = [row];
        }
      }
    }
    return matches;
  };

  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      for (const to of [{ row, col: col + 1 }, { row: row + 1, col }]) {
        if (to.row >= height || to.col >= width) continue;
        const next = cells.slice();
        [next[idx(row, col)], next[idx(to.row, to.col)]] = [next[idx(to.row, to.col)], next[idx(row, col)]];
        if (findMatches(next).length > 0) return { from: { row, col }, to };
      }
    }
  }
  return null;
});

if (!move) throw new Error("No valid move found");

const canvasBox = await page.locator("canvas").boundingBox();
if (!canvasBox) throw new Error("Canvas not found");

const { input } = before;
const point = (pos) => ({
  x: canvasBox.x + ((input.boardX + pos.col * (input.cellSize + input.gap) + input.cellSize / 2) / 900) * canvasBox.width,
  y: canvasBox.y + ((input.boardY + pos.row * (input.cellSize + input.gap) + input.cellSize / 2) / 900) * canvasBox.height,
});

await page.mouse.click(point(move.from).x, point(move.from).y);
await page.waitForTimeout(120);
await page.mouse.click(point(move.to).x, point(move.to).y);
await page.waitForTimeout(900);

const after = JSON.parse(await page.evaluate(() => window.render_game_to_text()));

if (errors.length > 0) throw new Error(`Console errors: ${errors.join("\n")}`);
if (after.movesLeft !== before.movesLeft - 1) {
  throw new Error(`Expected movesLeft ${before.movesLeft - 1}, got ${after.movesLeft}`);
}
if (after.score <= before.score) {
  throw new Error(`Expected score to increase from ${before.score}, got ${after.score}`);
}

await page.evaluate(() => window.__xxcs_forceWin());
await page.locator("#result-action").click();
await page.waitForTimeout(500);
const progressed = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
if (progressed.level !== before.level + 1) {
  throw new Error(`Expected next level ${before.level + 1}, got ${progressed.level}`);
}
const cookie = await page.context().cookies(url);
if (!cookie.some((item) => item.name === "xxcs_progress")) {
  throw new Error("Expected xxcs_progress cookie to be written");
}

await page.screenshot({ path: "output/web-game/verify-real-click.png", fullPage: true });
await browser.close();

console.log(JSON.stringify({ ok: true, before: { score: before.score, movesLeft: before.movesLeft }, after: { score: after.score, movesLeft: after.movesLeft }, progressed: { level: progressed.level }, move }, null, 2));
