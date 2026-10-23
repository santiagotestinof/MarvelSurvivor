import Phaser from 'phaser';
import { BootScene } from '../scenes/BootScene';
import { GameScene } from '../scenes/GameScene';
import { HudScene } from '../scenes/HudScene';
import { ShopScene } from '../scenes/ShopScene';
import { MenuScene } from '../scenes/MenuScene';

export function createGameConfig(): Phaser.Types.Core.GameConfig {
  const debugPhysics = new URLSearchParams(window.location.search).has('debug');

  return {
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#0e1a12',
    // Pixel art nítido: sin suavizado y con posiciones redondeadas.
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: '100%',
      height: '100%',
    },
    physics: {
      default: 'arcade',
      arcade: { gravity: { x: 0, y: 0 }, debug: debugPhysics },
    },
    input: { activePointers: 3 },
    scene: [BootScene, MenuScene, ShopScene, GameScene, HudScene],
  };
}
