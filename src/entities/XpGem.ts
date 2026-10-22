import Phaser from 'phaser';
import { TEXTURES } from '../config/assetKeys';

/** Gema de experiencia que suelta un enemigo. Va hacia el jugador cuando éste se acerca. */
export class XpGem extends Phaser.GameObjects.Image {
  readonly value: number;
  magnetized = false;
  private pullSpeed = 90;

  constructor(scene: Phaser.Scene, x: number, y: number, value: number) {
    super(scene, x, y, TEXTURES.gem);
    this.value = value;
    scene.add.existing(this);
    this.setDepth(y - 1);
  }

  /** Atrae la gema continuamente hacia el jugador y devuelve true al llegar al punto de recolección. */
  moveToward(targetX: number, targetY: number, deltaMs: number): boolean {
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const distance = Math.hypot(dx, dy);
    const step = (this.pullSpeed * deltaMs) / 1000;

    if (distance <= Math.max(step, 8)) {
      this.setPosition(targetX, targetY);
      return true;
    }

    this.pullSpeed = Math.min(this.pullSpeed + deltaMs * 0.8, 700);
    this.setPosition(this.x + (dx / distance) * step, this.y + (dy / distance) * step);
    this.setDepth(this.y - 1);
    return false;
  }
}
