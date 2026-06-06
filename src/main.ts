import Phaser from "phaser";
import "./styles/theme.css";
import { BootScene } from "./scenes/BootScene";
import { GameScene } from "./scenes/GameScene";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game-container",
  width: 900,
  height: 900,
  backgroundColor: "#f3f8ee",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, GameScene],
});
