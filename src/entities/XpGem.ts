import Phaser from 'phaser';
import { TEXTURES } from '../config/assetKeys';

/** Gema de experiencia que suelta un enemigo. Va hacia el jugador cuando éste se acerca. */
export class XpGem extends Phaser.GameObjects.Image {
  readonly value: number;
  private magnetized = false;
  private pull = 60;
  private readonly bob: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, x: number, y: number, value: number) {
    super(scene, x, y, TEXTURES.gem);
    this.value = value;
    scene.add.existing(this);
    this.setDepth(y - 1);
    this.bob = scene.tweens.add({ targets: this, y: y - 2, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  get isMagnetized(): boolean {
    return this.magnetized;
  }

  /** Empieza a ir hacia el jugador. Corta el flote: si no, el tween pisa `y` y la gema solo se mueve en `x`. */
  magnetize(): void {
    this.magnetized = true;
    this.bob.remove();
  }

  /** Mueve la gema hacia el jugador (cada vez más rápido). Devuelve true si llegó. */
  moveToward(targetX: number, targetY: number, deltaMs: number): boolean {
    this.pull += deltaMs * 0.45;
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const distance = Math.hypot(dx, dy);
    const step = (this.pull * deltaMs) / 1000;
    if (distance <= step + 3) return true;
    this.x += (dx / distance) * step;
    this.y += (dy / distance) * step;
    return false;
  }
}
