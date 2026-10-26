import Phaser from 'phaser';
import { TEXTURES } from '../config/assetKeys';
import { Direction } from '../core/direction';
import type { Character } from '../entities/Character';
import type { Enemy } from '../entities/Enemy';

/** Direcciones en las que el sprite de Strange va espejado. */
const LEFT_FACING = new Set([Direction.DownLeft, Direction.Left, Direction.UpLeft]);

export const TIME_STOP = {
  durationMs: 5000,
  cooldownMs: 35_000,
} as const;

/**
 * "Tiempo detenido" (ulti de Doctor Strange, el Ojo de Agamotto): congela a todos los enemigos unos segundos.
 * El daño que reciben mientras tanto se guarda y se descarga de golpe cuando el tiempo vuelve a correr.
 * Mientras dura, a Strange le salen los 6 brazos de atrás.
 */
export class TimeStopUltimate {
  private endsAt = 0;
  private arms: Phaser.GameObjects.Image | null = null;
  private tint: Phaser.GameObjects.Rectangle | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Character,
  ) {}

  isActive(now: number): boolean {
    return this.endsAt > 0 && now < this.endsAt;
  }

  remainingMs(now: number): number {
    return this.isActive(now) ? this.endsAt - now : 0;
  }

  start(now: number): void {
    this.endsAt = now + TIME_STOP.durationMs;
    this.arms?.destroy();
    this.arms = this.scene.add
      .image(this.player.x, this.player.y, TEXTURES.strangeArms)
      .setOrigin(this.player.originX, this.player.originY)
      .setAlpha(0);
    this.scene.tweens.add({ targets: this.arms, alpha: 1, duration: 250 });

    // Velo verdoso (el ojo de Agamotto) fijo en pantalla.
    const { width, height } = this.scene.scale;
    this.tint?.destroy();
    this.tint = this.scene.add
      .rectangle(0, 0, width, height, 0x2fd18a, 0.16)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(999_000)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.shockwave(0.5, 5, 500, 0.9);
  }

  /** Cada cuadro mientras dura: congela a los que aparecen y acomoda los brazos. */
  /** Devuelve true en el cuadro en que termina. */
  update(now: number, enemies: Iterable<Enemy>): boolean {
    if (this.endsAt === 0) return false;
    if (now >= this.endsAt) {
      this.finish(enemies);
      return true;
    }
    for (const enemy of enemies) if (enemy.active && !enemy.dying) enemy.freeze();
    this.arms
      ?.setPosition(this.player.x, this.player.y + Math.sin(now / 160) * 1.5)
      .setFlipX(LEFT_FACING.has(this.player.direction))
      .setDepth(this.player.y - 0.2);
    return false;
  }

  /** Corta la ulti ya (fin de ronda). */
  cancel(enemies: Iterable<Enemy>): void {
    if (this.endsAt === 0) return;
    this.finish(enemies);
  }

  private finish(enemies: Iterable<Enemy>): void {
    this.endsAt = 0;
    this.scene.tweens.add({
      targets: this.arms,
      alpha: 0,
      duration: 200,
      onComplete: () => this.arms?.destroy(),
    });
    this.arms = null;
    this.tint?.destroy();
    this.tint = null;
    this.shockwave(0.3, 4, 350, 1);
    for (const enemy of [...enemies]) enemy.thaw();
  }

  private shockwave(from: number, to: number, ms: number, alpha: number): void {
    const ring = this.scene.add
      .image(this.player.x, this.player.y - 4, TEXTURES.auraOuter)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(999_001)
      .setScale(from)
      .setAlpha(alpha);
    this.scene.tweens.add({ targets: ring, scale: to, alpha: 0, duration: ms, onComplete: () => ring.destroy() });
  }
}
