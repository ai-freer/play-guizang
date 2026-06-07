import { levels } from "../game/LevelConfig";

export type LevelPickerSnapshot = {
  currentLevel: number;
  highestUnlockedLevel: number;
  clearedLevels?: number[];
};

export class LevelPicker {
  private root = document.querySelector<HTMLElement>("#level-picker");
  onSelect?: (levelId: number) => void;

  render(snapshot: LevelPickerSnapshot): void {
    if (!this.root) return;
    this.root.innerHTML = "";

    const cleared = new Set(snapshot.clearedLevels ?? []);

    for (const level of levels) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "level-chip";
      button.textContent = String(level.id);
      button.disabled = level.id > snapshot.highestUnlockedLevel;
      button.classList.toggle("active", level.id === snapshot.currentLevel);
      button.classList.toggle("cleared", cleared.has(level.id));
      button.addEventListener("click", () => this.onSelect?.(level.id));
      this.root.append(button);
    }
  }
}
