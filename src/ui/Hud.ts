import { LevelConfig } from "../game/LevelConfig";
import { tileAssetUrl } from "../game/TileAssets";
import { ToolKind } from "../game/ToolInventory";

export type HudSnapshot = {
  level: LevelConfig;
  score: number;
  movesLeft: number;
  tools: Record<ToolKind, number>;
};

const TOOL_BUTTONS: Array<[string, ToolKind]> = [
  ["#tool-swap", "swap"],
  ["#tool-bomb", "bomb"],
  ["#tool-refresh", "refresh"],
  ["#tool-hint", "hint"],
];

export class Hud {
  private levelLabel = document.querySelector<HTMLSpanElement>("#level-label");
  private scoreValue = document.querySelector<HTMLElement>("#score-value");
  private movesValue = document.querySelector<HTMLElement>("#moves-value");
  private targets = document.querySelector<HTMLElement>("#targets");
  private dialog = document.querySelector<HTMLDialogElement>("#result-dialog");
  private resultTitle = document.querySelector<HTMLElement>("#result-title");
  private resultBody = document.querySelector<HTMLElement>("#result-body");
  private resultAction = document.querySelector<HTMLButtonElement>("#result-action");

  onContinue?: () => void;
  onTool?: (kind: ToolKind) => void;

  constructor() {
    this.resultAction?.addEventListener("click", () => {
      this.dialog?.close();
      this.onContinue?.();
    });
    for (const [selector, kind] of TOOL_BUTTONS) {
      document.querySelector<HTMLButtonElement>(selector)?.addEventListener("click", () => {
        this.onTool?.(kind);
      });
    }
    // 移除 HTML 里初始的 selected 类（旧逻辑没用）
    document.querySelector("#tool-swap")?.classList.remove("selected");
  }

  update(snapshot: HudSnapshot): void {
    if (this.levelLabel) this.levelLabel.textContent = `第 ${snapshot.level.id} 关`;
    if (this.scoreValue) {
      const text = snapshot.score.toLocaleString("zh-CN");
      this.scoreValue.textContent = text;
      // 把字符串长度透传给 .score-card 让 CSS 按长度切字号
      this.scoreValue.parentElement?.setAttribute("data-length", String(text.length));
    }
    if (this.movesValue) {
      const text = String(snapshot.movesLeft);
      this.movesValue.textContent = text;
      this.movesValue.parentElement?.setAttribute("data-length", String(text.length));
    }
    this.renderTargets(snapshot);
    this.updateTools(snapshot.tools);
  }

  setActiveTool(kind: ToolKind | null): void {
    for (const [selector, k] of TOOL_BUTTONS) {
      const btn = document.querySelector<HTMLButtonElement>(selector);
      if (!btn) continue;
      btn.classList.toggle("selected", kind === k);
    }
  }

  showResult(kind: "won" | "lost" | "completed" | "final-replay", score: number): void {
    if (!this.dialog || !this.resultTitle || !this.resultBody || !this.resultAction) return;
    const dialogCard = this.dialog.querySelector<HTMLElement>(".dialog-card");
    // 移除之前可能挂上的 kind class
    dialogCard?.classList.remove("dialog-completed", "dialog-final-replay");

    const niceScore = score.toLocaleString("zh-CN");

    switch (kind) {
      case "completed":
        dialogCard?.classList.add("dialog-completed");
        this.resultTitle.textContent = "🎉 通关！";
        this.resultBody.innerHTML = `恭喜成为<strong style="color:#f5c542">消消藏师傅</strong>！<br/>你已通关全部 10 关。<br/>从上方关卡条选任意一关继续练习。`;
        this.resultAction.textContent = "回到选关";
        break;
      case "final-replay":
        dialogCard?.classList.add("dialog-final-replay");
        this.resultTitle.textContent = "再次拿下 L10";
        this.resultBody.textContent = `本关得分 ${niceScore}，从上方关卡条选其他关继续练习。`;
        this.resultAction.textContent = "去选关";
        break;
      case "won":
        this.resultTitle.textContent = "过关！";
        this.resultBody.textContent = `本关得分 ${niceScore}，下一关继续加码。`;
        this.resultAction.textContent = "下一关";
        break;
      case "lost":
      default:
        this.resultTitle.textContent = "没步数了";
        this.resultBody.textContent = `本关得分 ${niceScore}，再试一次。`;
        this.resultAction.textContent = "重试";
        break;
    }
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
          <img src="${tileAssetUrl(target.type)}" alt="" />
          <div>
            <strong>收集 ${target.current}/${target.count}</strong>
            <div class="bar"><span></span></div>
          </div>
        `;
      } else {
        const progress = Math.min(100, Math.round((snapshot.score / target.score) * 100));
        card.style.setProperty("--progress", `${progress}%`);
        card.innerHTML = `
          <img src="${tileAssetUrl(7)}" alt="" />
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
    for (const [selector, kind] of TOOL_BUTTONS) {
      const button = document.querySelector<HTMLButtonElement>(selector);
      const badge = button?.querySelector<HTMLElement>(".tool-badge");
      if (!button || !badge) continue;
      const count = tools[kind];
      badge.textContent = String(count);
      // count=0 时藏角标，避免和 disabled 灰化视觉打架
      badge.style.display = count > 0 ? "" : "none";
      button.disabled = count <= 0;
      button.classList.toggle("disabled", count <= 0);
    }
  }
}
