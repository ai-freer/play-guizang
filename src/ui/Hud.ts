import { LevelConfig } from "../game/LevelConfig";

export type HudSnapshot = {
  level: LevelConfig;
  score: number;
  movesLeft: number;
  tools: Record<"swap" | "bomb" | "refresh" | "hint", number>;
};

export class Hud {
  private levelLabel = document.querySelector<HTMLSpanElement>("#level-label");
  private scoreValue = document.querySelector<HTMLElement>("#score-value");
  private movesValue = document.querySelector<HTMLElement>("#moves-value");
  private targets = document.querySelector<HTMLElement>("#targets");
  private dialog = document.querySelector<HTMLDialogElement>("#result-dialog");
  private resultTitle = document.querySelector<HTMLElement>("#result-title");
  private resultBody = document.querySelector<HTMLElement>("#result-body");
  private resultAction = document.querySelector<HTMLButtonElement>("#result-action");
  private refreshButton = document.querySelector<HTMLButtonElement>("#tool-refresh");
  private hintButton = document.querySelector<HTMLButtonElement>("#tool-hint");

  onContinue?: () => void;
  onRefresh?: () => void;
  onHint?: () => void;

  constructor() {
    this.resultAction?.addEventListener("click", () => {
      this.dialog?.close();
      this.onContinue?.();
    });
    this.refreshButton?.addEventListener("click", () => this.onRefresh?.());
    this.hintButton?.addEventListener("click", () => this.onHint?.());
  }

  update(snapshot: HudSnapshot): void {
    if (this.levelLabel) this.levelLabel.textContent = `第 ${snapshot.level.id} 关`;
    if (this.scoreValue) this.scoreValue.textContent = snapshot.score.toLocaleString("zh-CN");
    if (this.movesValue) this.movesValue.textContent = String(snapshot.movesLeft);
    this.renderTargets(snapshot);
    this.updateTools(snapshot.tools);
  }

  showResult(kind: "won" | "lost", score: number): void {
    if (!this.dialog || !this.resultTitle || !this.resultBody || !this.resultAction) return;
    this.resultTitle.textContent = kind === "won" ? "过关！" : "没步数了";
    this.resultBody.textContent =
      kind === "won"
        ? `本关得分 ${score.toLocaleString("zh-CN")}，下一关继续加码。`
        : `本关得分 ${score.toLocaleString("zh-CN")}，再试一次。`;
    this.resultAction.textContent = kind === "won" ? "下一关" : "重试";
    if (!this.dialog.open) this.dialog.showModal();
  }

  private renderTargets(snapshot: HudSnapshot): void {
    if (!this.targets) return;
    this.targets.innerHTML = "";
    const accents = ["#ff4f73", "#ffb936", "#45d1a9"];

    for (const [index, target] of snapshot.level.targets.entries()) {
      const card = document.createElement("article");
      card.className = "target-card";
      card.style.setProperty("--accent", accents[index % accents.length]);

      if (target.kind === "collect") {
        const progress = Math.min(100, Math.round((target.current / target.count) * 100));
        card.style.setProperty("--progress", `${progress}%`);
        card.innerHTML = `
          <img src="/assets/tiles/tile-${String(target.type + 1).padStart(2, "0")}.jpg" alt="" />
          <div>
            <strong>收集 ${target.current}/${target.count}</strong>
            <div class="bar"><span></span></div>
          </div>
        `;
      } else {
        const progress = Math.min(100, Math.round((snapshot.score / target.score) * 100));
        card.style.setProperty("--progress", `${progress}%`);
        card.innerHTML = `
          <img src="/assets/tiles/tile-08.jpg" alt="" />
          <div>
            <strong>分数 ${Math.min(snapshot.score, target.score).toLocaleString("zh-CN")}/${target.score.toLocaleString("zh-CN")}</strong>
            <div class="bar"><span></span></div>
          </div>
        `;
      }

      this.targets.append(card);
    }
  }

  private updateTools(tools: HudSnapshot["tools"]): void {
    const map = [
      ["#tool-swap", tools.swap],
      ["#tool-bomb", tools.bomb],
      ["#tool-refresh", tools.refresh],
      ["#tool-hint", tools.hint],
    ] as const;

    for (const [selector, count] of map) {
      const button = document.querySelector<HTMLButtonElement>(selector);
      const badge = button?.querySelector<HTMLElement>(".tool-badge");
      if (!button || !badge) continue;
      badge.textContent = String(count);
      button.disabled = count <= 0;
      button.classList.toggle("disabled", count <= 0);
    }
  }
}
