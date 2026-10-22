import Phaser from 'phaser';
import { EFFECT_ANIMS, TEXTURES } from '../config/assetKeys';
import type { Enemy } from './Enemy';

/** Diámetro del círculo dibujado en el PNG (corresponde al diámetro del área). */
const SPRITE_DIAMETER = 30;
const FADE_MS = 300;

/** Círculo de fuego plano en el piso: cada `tickMs` quema a los enemigos que estén dentro; se apaga solo. */
export class FireZone extends Phaser.GameObjects.Sprite {
  private nextTickAt: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly radius: number,
    private readonly expiresAt: number,
    now: number,
  ) {
    super(scene, x, y, TEXTURES.fire, 0);
    scene.add.existing(this);
    this.nextTickAt = now;
    const scale = (radius * 2) / SPRITE_DIAMETER;
    this.setScale(scale).setOrigin(0.5).setAlpha(0.75);
    // Por encima del suelo pero debajo de personajes, enemigos y gemas (que usan depth = y).
    this.setDepth(1);
    this.play({ key: EFFECT_ANIMS.fire, startFrame: Phaser.Math.Between(0, 2) });
  }

  get expired(): boolean {
    return !this.active;
  }

  /** Quema a los enemigos dentro del área cuando toca. Se destruye al terminar su tiempo. */
  update(now: number, enemies: Enemy[], damage: number, tickMs: number): void {
    if (now >= this.expiresAt) {
      this.destroy();
      return;
    }
    const left = this.expiresAt - now;
    if (left < FADE_MS) this.setAlpha(0.75 * (left / FADE_MS));

    if (now < this.nextTickAt) return;
    this.nextTickAt = now + tickMs;
    // Quema a los que tengan los pies dentro del círculo.
    const radiusSq = this.radius * this.radius;
    for (const enemy of enemies) {
      if (!enemy.active || enemy.dying) continue;
      if ((enemy.x - this.x) ** 2 + (enemy.y - this.y) ** 2 <= radiusSq) enemy.takeDamage(damage);
    }
  }
}
