import Phaser from "phaser";
import "./styles/theme.css";
import { BootScene } from "./scenes/BootScene";
import { GameScene } from "./scenes/GameScene";

// JS bundle 下载完，停止内联 0–15% 慢爬，推进到 15% 让 Phaser 接管
type BootApi = { set(pct?: number, msg?: string): void; hide(): void };
const win = window as unknown as { __bootDone?: boolean; __boot?: BootApi };
win.__bootDone = true;
win.__boot?.set(15, "初始化引擎…");

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game-container",
  width: 900,
  height: 900,
  backgroundColor: "#0a1535",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, GameScene],
});
